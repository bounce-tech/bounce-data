import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import crypto from "crypto";
import { ensureUser } from "./utils/ensure-user";

// event Mint(address indexed minter, address indexed to, uint256 baseAmount, uint256 ltAmount);
ponder.on("LeveragedToken:Mint", async ({ event, context }) => {
  const { minter, to, baseAmount, ltAmount } = event.args;

  await context.db.insert(schema.trade).values({
    id: crypto.randomUUID(),
    isBuy: true,
    timestamp: event.block.timestamp,
    leveragedToken: event.log.address,
    sender: minter,
    recipient: to,
    baseAssetAmount: baseAmount,
    leveragedTokenAmount: ltAmount,
    txHash: event.transaction?.hash ?? "",
  });

  // Update user stats
  const leveragedToken = await context.db.find(schema.leveragedToken, {
    address: event.log.address,
  });
  if (!leveragedToken) throw new Error("Leveraged token not found");

  await ensureUser(context.db, to);
  const user = await context.db.find(schema.user, { address: to });
  if (!user) throw new Error("User not found");

  const notionalVolume = (baseAmount * leveragedToken.targetLeverage) / BigInt(1e18);

  await context.db.update(schema.user, { address: to }).set({
    tradeCount: user.tradeCount + 1,
    mintVolumeNominal: user.mintVolumeNominal + baseAmount,
    totalVolumeNominal: user.totalVolumeNominal + baseAmount,
    mintVolumeNotional: user.mintVolumeNotional + notionalVolume,
    totalVolumeNotional: user.totalVolumeNotional + notionalVolume,
    lastTradeTimestamp: event.block.timestamp,
  });
});

// event Redeem(address indexed sender, address indexed to, uint256 ltAmount, uint256 baseAmount);
ponder.on("LeveragedToken:Redeem", async ({ event, context }) => {
  const { sender, to, ltAmount, baseAmount } = event.args;

  await context.db.insert(schema.trade).values({
    id: crypto.randomUUID(),
    isBuy: false,
    timestamp: event.block.timestamp,
    leveragedToken: event.log.address,
    sender: sender,
    recipient: to,
    baseAssetAmount: baseAmount,
    leveragedTokenAmount: ltAmount,
    txHash: event.transaction?.hash ?? "",
  });

  // Update user stats
  const leveragedToken = await context.db.find(schema.leveragedToken, {
    address: event.log.address,
  });
  if (!leveragedToken) throw new Error("Leveraged token not found");

  await ensureUser(context.db, to);
  const user = await context.db.find(schema.user, { address: to });
  if (!user) throw new Error("User not found");

  const notionalVolume = (baseAmount * leveragedToken.targetLeverage) / BigInt(1e18);

  await context.db.update(schema.user, { address: to }).set({
    tradeCount: user.tradeCount + 1,
    redeemVolumeNominal: user.redeemVolumeNominal + baseAmount,
    totalVolumeNominal: user.totalVolumeNominal + baseAmount,
    redeemVolumeNotional: user.redeemVolumeNotional + notionalVolume,
    totalVolumeNotional: user.totalVolumeNotional + notionalVolume,
    lastTradeTimestamp: event.block.timestamp,
  });
});

// event ExecuteRedeem(address indexed user, uint256 ltAmount, uint256 baseAmount);
ponder.on("LeveragedToken:ExecuteRedeem", async ({ event, context }) => {
  const { user, ltAmount, baseAmount } = event.args;

  await context.db.insert(schema.trade).values({
    id: crypto.randomUUID(),
    isBuy: false,
    timestamp: event.block.timestamp,
    leveragedToken: event.log.address,
    sender: user,
    recipient: user,
    baseAssetAmount: baseAmount,
    leveragedTokenAmount: ltAmount,
    txHash: event.transaction?.hash ?? "",
  });

  // Update user stats
  const leveragedToken = await context.db.find(schema.leveragedToken, {
    address: event.log.address,
  });
  if (!leveragedToken) throw new Error("Leveraged token not found");

  await ensureUser(context.db, user);
  const userData = await context.db.find(schema.user, { address: user });
  if (!userData) throw new Error("User not found");

  const notionalVolume = (baseAmount * leveragedToken.targetLeverage) / BigInt(1e18);

  await context.db.update(schema.user, { address: user }).set({
    tradeCount: userData.tradeCount + 1,
    redeemVolumeNominal: userData.redeemVolumeNominal + baseAmount,
    totalVolumeNominal: userData.totalVolumeNominal + baseAmount,
    redeemVolumeNotional: userData.redeemVolumeNotional + notionalVolume,
    totalVolumeNotional: userData.totalVolumeNotional + notionalVolume,
    lastTradeTimestamp: event.block.timestamp,
  });
});

// event Transfer(address indexed from, address indexed to, uint256 value);
ponder.on("LeveragedToken:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;

  await context.db.insert(schema.transfer).values({
    id: crypto.randomUUID(),
    timestamp: event.block.timestamp,
    leveragedToken: event.log.address,
    sender: from,
    recipient: to,
    amount: value,
    txHash: event.transaction?.hash ?? "",
  });
});

// event SendFeesToTreasury(uint256 amount);
ponder.on("LeveragedToken:SendFeesToTreasury", async ({ event, context }) => {
  const { amount } = event.args;

  await context.db.insert(schema.fee).values({
    id: crypto.randomUUID(),
    leveragedToken: event.log.address,
    timestamp: event.block.timestamp,
    amount: amount,
    destination: "treasury",
  });
});
