import { db } from "ponder:api";
import schema from "ponder:schema";
import { sql, eq } from "drizzle-orm";
import { Address } from "viem";
import bigIntToNumber from "../utils/big-int-to-number";

const getTotalRebatesForUser = async (user: Address) => {
  try {
    const result = await db
      .select({
        totalRebate: sql<string>`coalesce(sum(${schema.rebate.rebate}), 0)`,
      })
      .from(schema.rebate)
      .where(eq(schema.rebate.sender, user));

    const totalRebateBigInt =
      result[0]?.totalRebate !== undefined ? BigInt(result[0].totalRebate) : 0n;

    return bigIntToNumber(totalRebateBigInt, 6);
  } catch (error) {
    throw new Error("Failed to fetch total rebates");
  }
};

export default getTotalRebatesForUser;
