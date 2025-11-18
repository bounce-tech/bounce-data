// import { ponder } from "ponder:registry";
// import schema from "ponder:schema";
// import crypto from "crypto";

// // event JoinWithReferral(address indexed referree, address indexed referrer, string referralCode);
// ponder.on("Referrals:JoinWithReferral", async ({ event, context }) => {
//   const { referree, referrer, referralCode } = event.args;

//   await context.db.insert(schema.referral).values({
//     id: crypto.randomUUID(),
//     user: referree,
//     code: referralCode,
//     referrer: referrer,
//   });
// });

// // event ClaimRebate(address indexed sender, address indexed to, uint256 rebate);
// ponder.on("Referrals:ClaimRebate", async ({ event, context }) => {
//   const { sender, to, rebate } = event.args;

//   await context.db.insert(schema.rebate).values({
//     id: crypto.randomUUID(),
//     sender: sender,
//     to: to,
//     rebate: rebate,
//   });
// });
