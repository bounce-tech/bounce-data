import { db } from "ponder:api";
import schema from "ponder:schema";
import { gt, sql, eq } from "drizzle-orm";
import bigIntToNumber from "../utils/big-int-to-number";
import { stringToBigInt } from "../utils/scaled-number";

const BASE_ASSET_DECIMALS = BigInt(1e6);
const LEVERAGE_DECIMALS = BigInt(1e18);
const DECIMAL_CONVERSION = LEVERAGE_DECIMALS / BASE_ASSET_DECIMALS;

// A holder is flagged when the value of their external (peer-to-peer) transfers
// exceeds this share of their total nominal trading volume. External transfers
// carry no cost basis, so above this threshold they materially distort PnL.
const TRANSFER_FLAG_THRESHOLD = 0.05;

export interface UserSummary {
  address: string;
  tradeCount: number;
  mintVolumeNominal: number;
  redeemVolumeNominal: number;
  totalVolumeNominal: number;
  mintVolumeNotional: number;
  redeemVolumeNotional: number;
  totalVolumeNotional: number;
  lastTradeTimestamp: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  transfersDetected: boolean;
  transferShare: number | null;
}

const getAllUsers = async (): Promise<UserSummary[]> => {
  try {
    const users = await db
      .select({
        address: schema.user.address,
        tradeCount: schema.user.tradeCount,
        mintVolumeNominal: schema.user.mintVolumeNominal,
        redeemVolumeNominal: schema.user.redeemVolumeNominal,
        totalVolumeNominal: schema.user.totalVolumeNominal,
        mintVolumeNotional: schema.user.mintVolumeNotional,
        redeemVolumeNotional: schema.user.redeemVolumeNotional,
        totalVolumeNotional: schema.user.totalVolumeNotional,
        lastTradeTimestamp: schema.user.lastTradeTimestamp,
        realizedProfit: schema.user.realizedProfit,
        unrealizedProfit: sql<string>`SUM((${schema.balance.totalBalance} * ${schema.leveragedToken.exchangeRate}) / ${LEVERAGE_DECIMALS} - ${schema.balance.purchaseCost} * ${DECIMAL_CONVERSION})`,
        // USD value of gross external transfers, priced at the current exchange
        // rate (historical rates are not indexed). Mirrors the market-value half
        // of the unrealized PnL expression above.
        transferValue: sql<string>`COALESCE(SUM((${schema.balance.externalTransferAmount} * ${schema.leveragedToken.exchangeRate}) / ${LEVERAGE_DECIMALS}), 0)`
      })
      .from(schema.user)
      .leftJoin(
        schema.balance,
        eq(schema.user.address, schema.balance.user)
      )
      .leftJoin(
        schema.leveragedToken,
        eq(schema.balance.leveragedToken, schema.leveragedToken.address)
      )
      .where(gt(schema.user.tradeCount, 0))
      .groupBy(schema.user.address);


    // Note: PnL calculations can be spoofed via token transfers. If tokens are transferred out,
    // the balance decreases but purchase cost remains unchanged, making PnL appear worse. If tokens
    // are transferred in, the balance increases with no associated cost, making PnL appear as pure profit.
    // This is acceptable for our current use case but integrators should be aware of this limitation.
    const items = users.map((user) => {
      const unrealizedProfit = bigIntToNumber(stringToBigInt(user.unrealizedProfit, 0), 18);
      const realizedProfit = bigIntToNumber(user.realizedProfit, 6);
      const totalVolumeNominal = bigIntToNumber(user.totalVolumeNominal, 6);

      // Value of external transfers relative to how much the user actually
      // traded. With zero volume but nonzero transfers the share is undefined
      // (effectively infinite), so we report it as null and still flag the user.
      const transferValue = bigIntToNumber(stringToBigInt(user.transferValue, 0), 18);
      const transferShare =
        totalVolumeNominal > 0
          ? transferValue / totalVolumeNominal
          : transferValue > 0
            ? null
            : 0;
      const transfersDetected =
        totalVolumeNominal > 0
          ? transferValue / totalVolumeNominal > TRANSFER_FLAG_THRESHOLD
          : transferValue > 0;

      return {
        address: user.address,
        tradeCount: user.tradeCount,
        mintVolumeNominal: bigIntToNumber(user.mintVolumeNominal, 6),
        redeemVolumeNominal: bigIntToNumber(user.redeemVolumeNominal, 6),
        totalVolumeNominal,
        mintVolumeNotional: bigIntToNumber(user.mintVolumeNotional, 6),
        redeemVolumeNotional: bigIntToNumber(user.redeemVolumeNotional, 6),
        totalVolumeNotional: bigIntToNumber(user.totalVolumeNotional, 6),
        lastTradeTimestamp: bigIntToNumber(user.lastTradeTimestamp, 0),
        realizedProfit,
        unrealizedProfit,
        totalProfit: realizedProfit + unrealizedProfit,
        transfersDetected,
        transferShare,
      };
    });

    return items;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch all users");
  }
};

export default getAllUsers;
