import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Address } from "viem";
import bigIntToNumber from "../utils/big-int-to-number";

interface UserReferrals {
  address: Address;
  referralCode: string | null;
  referrerCode: string | null;
  referrerAddress: Address | null;
  isJoined: boolean;
  referredUserCount: number;
  referrerRebates: number;
  refereeRebates: number;
  totalRebates: number;
  claimedRebates: number;
  claimableRebates: number;
}

const getUserReferrals = async (user: Address): Promise<UserReferrals> => {
  try {
    const result = await db
      .select({
        address: schema.user.address,
        referralCode: schema.user.referralCode,
        referrerCode: schema.user.referrerCode,
        referrerAddress: schema.user.referrerAddress,
        referredUserCount: schema.user.referredUserCount,
        totalRebates: schema.user.totalRebates,
        referrerRebates: schema.user.referrerRebates,
        refereeRebates: schema.user.refereeRebates,
        claimedRebates: schema.user.claimedRebates,
      })
      .from(schema.user)
      .where(eq(schema.user.address, user))
      .limit(1);

    if (!result[0]) {
      return {
        address: user,
        referralCode: null,
        referrerCode: null,
        referrerAddress: null,
        isJoined: false,
        referredUserCount: 0,
        totalRebates: 0,
        referrerRebates: 0,
        refereeRebates: 0,
        claimedRebates: 0,
        claimableRebates: 0,
      };
    }

    const row = result[0];

    return {
      address: row.address,
      referralCode: row.referralCode,
      referrerCode: row.referrerCode,
      referrerAddress: row.referrerAddress,
      isJoined: row.referrerAddress !== null,
      referredUserCount: row.referredUserCount,
      totalRebates: bigIntToNumber(row.totalRebates, 6),
      referrerRebates: bigIntToNumber(row.referrerRebates, 6),
      refereeRebates: bigIntToNumber(row.refereeRebates, 6),
      claimedRebates: bigIntToNumber(row.claimedRebates, 6),
      claimableRebates: bigIntToNumber(row.totalRebates - row.claimedRebates, 6),
    };
  } catch (error) {
    throw new Error("Failed to fetch user referrals");
  }
};

export default getUserReferrals;
