import { db } from "ponder:api";
import schema from "ponder:schema";
import { gt } from "drizzle-orm";
import getExchangeRates from "../queries/exchange-rates";
import getAllBalances from "../queries/all-balances";
import getUnrealizedPnl from "../utils/unrealized-pnl";
import { Address } from "viem";
import bigIntToNumber from "../utils/big-int-to-number";

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
    const [users, balances, exchangeRates] = await Promise.all([
      db
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
        })
        .from(schema.user)
        .where(gt(schema.user.tradeCount, 0)),
      getAllBalances(),
      getExchangeRates(),
    ]);

    const items = users.map((user) => {
      const balance = balances[user.address];
      if (!balance) throw new Error(`Balance for user ${user.address} not found`);
      const unrealizedProfit = getUnrealizedPnl(Object.keys(balance) as Address[], balance, exchangeRates);
      const totalProfit = bigIntToNumber(user.realizedProfit, 6) + unrealizedProfit;
      return ({
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
        unrealizedProfit,
        totalProfit,
      })
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
