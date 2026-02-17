import { ponder } from "ponder:registry";
import schema from "ponder:schema";


// event AddReferrer(address indexed referrer, string referralCode);
ponder.on("Referrals:AddReferrer", async ({ event, context }) => {
  const { referrer, referralCode } = event.args;
  await context.db
    .insert(schema.user)
    .values({ address: referrer, referralCode })
    .onConflictDoUpdate(() => ({ referralCode }));
});

// event JoinWithReferral(address indexed referee, address indexed referrer, string referralCode);
ponder.on("Referrals:JoinWithReferral", async ({ event, context }) => {
  const { referee, referrer, referralCode } = event.args;

  await context.db
    .insert(schema.user)
    .values({ address: referee, referrerCode: referralCode, referrerAddress: referrer })
    .onConflictDoUpdate(() => ({ referrerCode: referralCode, referrerAddress: referrer }));

  await context.db
    .insert(schema.user)
    .values({ address: referrer, referredUserCount: 1 })
    .onConflictDoUpdate((row) => ({ referredUserCount: row.referredUserCount + 1 }));
});

// event ClaimRebate(address indexed sender, address indexed to, uint256 rebate);
ponder.on("Referrals:ClaimRebate", async ({ event, context }) => {
  const { to, rebate } = event.args;
  await context.db
    .insert(schema.user)
    .values({ address: to, claimedRebates: rebate })
    .onConflictDoUpdate((row) => ({ claimedRebates: row.claimedRebates + rebate }));
});

// event DonateRebate(address indexed sender, address indexed to, uint256 feeAmount, uint256 referrerRebate, uint256 refereeRebate);
ponder.on("Referrals:DonateRebate", async ({ event, context }) => {
  const { to, referrerRebate, refereeRebate } = event.args;

  await context.db
    .insert(schema.user)
    .values({ address: to, refereeRebates: refereeRebate, totalRebates: refereeRebate })
    .onConflictDoUpdate((row) => ({
      refereeRebates: row.refereeRebates + refereeRebate,
      totalRebates: row.totalRebates + refereeRebate,
    }));

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
