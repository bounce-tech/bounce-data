import { db } from "ponder:api";
import { eq, and } from "drizzle-orm";
import { Address } from "viem";
import schema from "ponder:schema";

const getUsersTrades = async (
  user: Address,
  asset?: string,
  leveragedTokenAddress?: Address
) => {
  try {
    let where = null;
    if (asset && leveragedTokenAddress) {
      where = and(
        eq(schema.trade.recipient, user as Address),
        eq(schema.leveragedToken.asset, asset),
        eq(schema.leveragedToken.address, leveragedTokenAddress)
      );
    } else if (asset) {
      where = and(
        eq(schema.trade.recipient, user as Address),
        eq(schema.leveragedToken.asset, asset)
      );
    } else if (leveragedTokenAddress) {
      where = and(
        eq(schema.trade.recipient, user as Address),
        eq(schema.leveragedToken.address, leveragedTokenAddress)
      );
    } else {
      where = eq(schema.trade.recipient, user as Address);
    }
    const tradesData = await db
      .select({
        id: schema.trade.id,
        txHash: schema.trade.txHash,
        timestamp: schema.trade.timestamp,
        isBuy: schema.trade.isBuy,
        baseAssetAmount: schema.trade.baseAssetAmount,
        leveragedTokenAmount: schema.trade.leveragedTokenAmount,
        leveragedToken: schema.trade.leveragedToken,
        targetLeverage: schema.leveragedToken.targetLeverage,
        isLong: schema.leveragedToken.isLong,
        asset: schema.leveragedToken.asset,
      })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .where(where);
    return tradesData;
  } catch (error) {
    throw new Error("Failed to fetch user trades");
  }
};

export default getUsersTrades;
