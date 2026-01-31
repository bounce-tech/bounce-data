import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { ensureUser } from "./utils/ensure-user";


// event AddReferrer(address indexed referrer, string referralCode);
ponder.on("Referrals:AddReferrer", async ({ event, context }) => {
  const { referrer, referralCode } = event.args;
  await ensureUser(context.db, referrer);
  await context.db
    .update(schema.user, { address: referrer })
    .set({ referralCode: referralCode });
});

// event JoinWithReferral(address indexed referee, address indexed referrer, string referralCode);
ponder.on("Referrals:JoinWithReferral", async ({ event, context }) => {
  const { referee, referrer, referralCode } = event.args;
  await ensureUser(context.db, referee);
  await ensureUser(context.db, referrer);

  // Update the referee: set referrerCode and referrerAddress
  await context.db
    .update(schema.user, { address: referee })
    .set({ referrerCode: referralCode, referrerAddress: referrer });

  // Update the referrer: increment referredUserCount by 1
  await context.db
    .update(schema.user, { address: referrer })
    .set((row) => ({ referredUserCount: row.referredUserCount + 1 }));
});

// event ClaimRebate(address indexed sender, address indexed to, uint256 rebate);
ponder.on("Referrals:ClaimRebate", async ({ event, context }) => {
  const { to, rebate } = event.args;
  await ensureUser(context.db, to);

  await context.db
    .update(schema.user, { address: to })
    .set((row) => ({ claimedRebates: row.claimedRebates + rebate }));
});

// event DonateRebate(address indexed sender, address indexed to, uint256 feeAmount, uint256 referrerRebate, uint256 refereeRebate);
ponder.on("Referrals:DonateRebate", async ({ event, context }) => {
  const { to, referrerRebate, refereeRebate } = event.args;
  await ensureUser(context.db, to);

  if (refereeRebate > 0) {
    await context.db
      .update(schema.user, { address: to })
      .set((row) => ({
        referreeRebates: row.referreeRebates + refereeRebate,
        totalRebates: row.totalRebates + refereeRebate,
      }));
  }

  if (referrerRebate > 0) {
    const referee = await context.db.find(schema.user, { address: to });
    if (!referee) throw new Error("Referee not found");
    if (!referee.referrerAddress) throw new Error("Referee has no referrer");
    await context.db
      .update(schema.user, { address: referee.referrerAddress })
      .set((row) => ({
        referrerRebates: row.referrerRebates + referrerRebate,
        totalRebates: row.totalRebates + referrerRebate,
      }));
  }
});