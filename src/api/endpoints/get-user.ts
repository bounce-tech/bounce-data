import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Address } from "viem";
import { UserSummary } from "./get-all-users";

const getUser = async (user: Address): Promise<UserSummary | null> => {
  try {
    const result = await db
      .select({
        address: schema.user.address,
        tradeCount: schema.user.tradeCount,
        mintVolumeNominal: schema.user.mintVolumeNominal,
        redeemVolumeNominal: schema.user.redeemVolumeNominal,
        totalVolumeNominal: schema.user.totalVolumeNominal,
        mintVolumeNotional: schema.user.mintVolumeNotional,
        redeemVolumeNotional: schema.user.redeemVolumeNotional,
        totalVolumeNotional: schema.user.totalVolumeNotional,
        lastTradeTimestamp: schema.user.lastTradeTimestamp,
      })
      .from(schema.user)
      .where(eq(schema.user.address, user))
      .limit(1);

    return result[0] ?? null;
  } catch (error) {
    throw new Error("Failed to fetch user");
  }
};

export default getUser;
