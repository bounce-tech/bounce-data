import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Address } from "viem";
import { GLOBAL_STORAGE_ID } from "../../constants";

export interface GlobalStorageData {
  owner: Address;
  allMintsPaused: boolean;
  minTransactionSize: bigint;
  minLockAmount: bigint;
  redemptionFee: bigint;
  executeRedemptionFee: bigint;
  streamingFee: bigint;
  treasuryFeeShare: bigint;
  referrerRebate: bigint;
  refereeRebate: bigint;
}

const getGlobalStorage = async (): Promise<GlobalStorageData | null> => {
  try {
    const result = await db
      .select()
      .from(schema.globalStorage)
      .where(eq(schema.globalStorage.id, GLOBAL_STORAGE_ID))
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return {
      owner: row.owner,
      allMintsPaused: row.allMintsPaused,
      minTransactionSize: row.minTransactionSize,
      minLockAmount: row.minLockAmount,
      redemptionFee: row.redemptionFee,
      executeRedemptionFee: row.executeRedemptionFee,
      streamingFee: row.streamingFee,
      treasuryFeeShare: row.treasuryFeeShare,
      referrerRebate: row.referrerRebate,
      refereeRebate: row.refereeRebate,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch global storage");
  }
};

export default getGlobalStorage;
