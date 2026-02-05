import { db } from "ponder:api";
import schema from "ponder:schema";
import { gt, sql, eq } from "drizzle-orm";
import bigIntToNumber from "../utils/big-int-to-number";

const BASE_ASSET_DECIMALS = BigInt(1e6);
const LEVERAGE_DECIMALS = BigInt(1e18);

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
        unrealizedProfit: sql<bigint>`SUM((${schema.balance.totalBalance} * ${schema.leveragedToken.exchangeRate}) / ${BASE_ASSET_DECIMALS} - ${schema.balance.purchaseCost} * (${LEVERAGE_DECIMALS - BASE_ASSET_DECIMALS}))`
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
      return {
        address: user.address,
        tradeCount: user.tradeCount,
        mintVolumeNominal: bigIntToNumber(user.mintVolumeNominal, 6),
        redeemVolumeNominal: bigIntToNumber(user.redeemVolumeNominal, 6),
        totalVolumeNominal: bigIntToNumber(user.totalVolumeNominal, 6),
        mintVolumeNotional: bigIntToNumber(user.mintVolumeNotional, 6),
        redeemVolumeNotional: bigIntToNumber(user.redeemVolumeNotional, 6),
        totalVolumeNotional: bigIntToNumber(user.totalVolumeNotional, 6),
        lastTradeTimestamp: bigIntToNumber(user.lastTradeTimestamp, 0),
        realizedProfit: bigIntToNumber(user.realizedProfit, 6),
        unrealizedProfit: Number(user.unrealizedProfit || 0),
        totalProfit: bigIntToNumber(user.realizedProfit, 6) + Number(user.unrealizedProfit || 0),
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
