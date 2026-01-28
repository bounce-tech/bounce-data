import { db } from "ponder:api";
import { eq, desc } from "drizzle-orm";
import schema from "ponder:schema";

const getLatestTrades = async () => {
    const tradesData = await db
        .select({
            id: schema.trade.id,
            txHash: schema.trade.txHash,
            timestamp: schema.trade.timestamp,
            isBuy: schema.trade.isBuy,
            baseAssetAmount: schema.trade.baseAssetAmount,
            leveragedTokenAmount: schema.trade.leveragedTokenAmount,
            leveragedToken: schema.trade.leveragedToken,
            sender: schema.trade.sender,
            recipient: schema.trade.recipient,
            targetLeverage: schema.leveragedToken.targetLeverage,
            isLong: schema.leveragedToken.isLong,
            asset: schema.leveragedToken.asset,
        })
        .from(schema.trade)
        .innerJoin(
            schema.leveragedToken,
            eq(schema.trade.leveragedToken, schema.leveragedToken.address)
        )
        .orderBy(desc(schema.trade.timestamp))
        .limit(100);
    return tradesData;
};

export default getLatestTrades;
