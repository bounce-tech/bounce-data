import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Address } from "viem";

const getTotalReferralsForUser = async (user: Address) => {
  try {
    const result = await db
      .select({ referredUserCount: schema.user.referredUserCount })
      .from(schema.user)
      .where(eq(schema.user.address, user))
      .limit(1);

    return result[0]?.referredUserCount ?? 0;
  } catch (error) {
    throw new Error("Failed to fetch total referrals");
  }
};

export default getTotalReferralsForUser;
