import { db } from "ponder:api";
import { eq, and } from "drizzle-orm";
import { Address } from "viem";
import schema from "ponder:schema";

const getUsersTrades = async (user: Address, asset?: string) => {
  let where = null;
  if (asset) {
    where = and(
      eq(schema.trade.recipient, user as Address),
      eq(schema.leveragedToken.assets, asset)
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
    })
    .from(schema.trade)
    .innerJoin(
      schema.leveragedToken,
      eq(schema.trade.leveragedToken, schema.leveragedToken.address)
    )
    .where(where);
  return tradesData;
};

export default getUsersTrades;
