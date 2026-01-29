import { db } from "ponder:api";
import schema from "ponder:schema";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { Address } from "viem";

const getTotalReferralsForUser = async (user: Address) => {
  try {
    const result = await db
      .select({ total: sql<number>`count(*)` })
      .from(schema.referral)
      .where(eq(schema.referral.referrer, user));

    return result[0]?.total ?? 0;
  } catch (error) {
    throw new Error("Failed to fetch total referrals");
  }
};

export default getTotalReferralsForUser;
