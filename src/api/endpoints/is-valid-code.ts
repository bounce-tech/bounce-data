import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";

const isValidCode = async (code: string) => {
  try {
    const result = await db
      .select({ referralCode: schema.user.referralCode })
      .from(schema.user)
      .where(eq(schema.user.referralCode, code))
      .limit(1);

    return result.length > 0;
  } catch (error) {
    throw new Error("Failed to check referral code validity");
  }
};

export default isValidCode;
