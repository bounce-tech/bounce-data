import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { GLOBAL_STORAGE_ID } from "./constants";

ponder.on("GlobalStorage:OwnershipTransferred", async ({ event, context }) => {
  const { newOwner } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, owner: newOwner })
    .onConflictDoUpdate(() => ({ owner: newOwner }));
});

ponder.on("GlobalStorage:SetAllMintsPaused", async ({ event, context }) => {
  const { newPaused } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, allMintsPaused: newPaused })
    .onConflictDoUpdate(() => ({ allMintsPaused: newPaused }));
});

ponder.on("GlobalStorage:SetMinTransactionSize", async ({ event, context }) => {
  const { newMinTransactionSize } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, minTransactionSize: newMinTransactionSize })
    .onConflictDoUpdate(() => ({ minTransactionSize: newMinTransactionSize }));
});

ponder.on("GlobalStorage:SetMinLockAmount", async ({ event, context }) => {
  const { newMinLockAmount } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, minLockAmount: newMinLockAmount })
    .onConflictDoUpdate(() => ({ minLockAmount: newMinLockAmount }));
});

ponder.on("GlobalStorage:SetRedemptionFee", async ({ event, context }) => {
  const { newFee } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, redemptionFee: newFee })
    .onConflictDoUpdate(() => ({ redemptionFee: newFee }));
});

ponder.on("GlobalStorage:SetExecuteRedemptionFee", async ({ event, context }) => {
  const { newFee } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, executeRedemptionFee: newFee })
    .onConflictDoUpdate(() => ({ executeRedemptionFee: newFee }));
});

ponder.on("GlobalStorage:SetStreamingFee", async ({ event, context }) => {
  const { newFee } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, streamingFee: newFee })
    .onConflictDoUpdate(() => ({ streamingFee: newFee }));
});

ponder.on("GlobalStorage:SetTreasuryFeeShare", async ({ event, context }) => {
  const { newFeeShare } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, treasuryFeeShare: newFeeShare })
    .onConflictDoUpdate(() => ({ treasuryFeeShare: newFeeShare }));
});

ponder.on("GlobalStorage:SetReferrerRebate", async ({ event, context }) => {
  const { newRebate } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, referrerRebate: newRebate })
    .onConflictDoUpdate(() => ({ referrerRebate: newRebate }));
});

ponder.on("GlobalStorage:SetRefereeRebate", async ({ event, context }) => {
  const { newRebate } = event.args;
  await context.db
    .insert(schema.globalStorage)
    .values({ id: GLOBAL_STORAGE_ID, refereeRebate: newRebate })
    .onConflictDoUpdate(() => ({ refereeRebate: newRebate }));
});
