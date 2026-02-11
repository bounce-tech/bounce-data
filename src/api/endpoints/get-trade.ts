import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Hex } from "viem";

const getTrade = async (txHash: Hex) => {
  try {
    const trade = await db.select().from(schema.trade).where(eq(schema.trade.originTxHash, txHash)).limit(1);
    if (!trade) return null;
    if (trade.length === 0) return null;
    return trade[0];
  } catch (error) {
    throw new Error("Failed to fetch trade");
  }
};

export default getTrade;