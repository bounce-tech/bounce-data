import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Address } from "viem";
import bigIntToNumber from "../utils/big-int-to-number";

const getTotalRebatesForUser = async (user: Address) => {
  try {
    const result = await db
      .select({ totalRebates: schema.user.totalRebates })
      .from(schema.user)
      .where(eq(schema.user.address, user))
      .limit(1);

    const totalRebatesBigInt = result[0]?.totalRebates ?? 0n;

    return bigIntToNumber(totalRebatesBigInt, 6);
  } catch (error) {
    throw new Error("Failed to fetch total rebates");
  }
};

export default getTotalRebatesForUser;
