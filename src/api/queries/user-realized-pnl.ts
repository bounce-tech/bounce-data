import { Address } from "viem";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";

const getUserRealizedPnl = async (user: Address): Promise<bigint | null> => {
  try {
    const users = await db
      .select({
        realizedProfit: schema.user.realizedProfit,
      })
      .from(schema.user)
      .where(eq(schema.user.address, user))
      .limit(1);
    if (!users[0]) return null;
    return users[0].realizedProfit;
  } catch (error) {
    throw new Error("Failed to fetch realized PnL for user");
  }
};

export default getUserRealizedPnl;
