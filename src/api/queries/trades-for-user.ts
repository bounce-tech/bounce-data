import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Address } from "viem";

export enum TradeType {
  MINT = "MINT",
  REDEEM = "REDEEM",
}

export interface Trade {
  timestamp: Date;
  type: TradeType;
  baseAssetAmount: bigint;
  leveragedTokenAmount: bigint;
  leveragedToken: Address;
}

const getTradesForUser = async (user: Address): Promise<Trade[]> => {
  try {
    const tradesData = await db
      .select({
        timestamp: schema.trade.timestamp,
        isBuy: schema.trade.isBuy,
        baseAssetAmount: schema.trade.baseAssetAmount,
        leveragedTokenAmount: schema.trade.leveragedTokenAmount,
        leveragedToken: schema.trade.leveragedToken,
      })
      .from(schema.trade)
      .where(eq(schema.trade.recipient, user as Address));
    return tradesData.map((trade) => ({
      timestamp: new Date(Number(trade.timestamp)),
      type: trade.isBuy ? TradeType.MINT : TradeType.REDEEM,
      baseAssetAmount: trade.baseAssetAmount,
      leveragedTokenAmount: trade.leveragedTokenAmount,
      leveragedToken: trade.leveragedToken as Address,
    }));
  } catch (error) {
    throw new Error("Failed to fetch trades for user");
  }
};

export default getTradesForUser;
