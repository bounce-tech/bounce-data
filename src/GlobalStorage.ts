import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { GLOBAL_STORAGE_ID } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureGlobalStorageRow(db: any) {
  await db.insert(schema.globalStorage).values({ id: GLOBAL_STORAGE_ID }).onConflictDoNothing();
}

ponder.on("GlobalStorage:OwnershipTransferred", async ({ event, context }) => {
  const { newOwner } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ owner: newOwner });
});

ponder.on("GlobalStorage:SetAllMintsPaused", async ({ event, context }) => {
  const { newPaused } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ allMintsPaused: newPaused });
});

ponder.on("GlobalStorage:SetMinTransactionSize", async ({ event, context }) => {
  const { newMinTransactionSize } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ minTransactionSize: newMinTransactionSize });
});

ponder.on("GlobalStorage:SetMinLockAmount", async ({ event, context }) => {
  const { newMinLockAmount } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ minLockAmount: newMinLockAmount });
});

ponder.on("GlobalStorage:SetRedemptionFee", async ({ event, context }) => {
  const { newFee } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ redemptionFee: newFee });
});

ponder.on("GlobalStorage:SetExecuteRedemptionFee", async ({ event, context }) => {
  const { newFee } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ executeRedemptionFee: newFee });
});

ponder.on("GlobalStorage:SetStreamingFee", async ({ event, context }) => {
  const { newFee } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ streamingFee: newFee });
});

ponder.on("GlobalStorage:SetTreasuryFeeShare", async ({ event, context }) => {
  const { newFeeShare } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ treasuryFeeShare: newFeeShare });
});

ponder.on("GlobalStorage:SetReferrerRebate", async ({ event, context }) => {
  const { newRebate } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ referrerRebate: newRebate });
});

ponder.on("GlobalStorage:SetRefereeRebate", async ({ event, context }) => {
  const { newRebate } = event.args;
  await ensureGlobalStorageRow(context.db);
  await context.db.update(schema.globalStorage, { id: GLOBAL_STORAGE_ID }).set({ refereeRebate: newRebate });
});
