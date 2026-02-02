import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import crypto from "crypto";
import { zeroAddress } from "viem";
import { ensureUser } from "./utils/ensure-user";
import { getTargetLeverage } from "./utils/get-target-leverage";
import { ensureBalance } from "./utils/ensure-balance";
import { FACTORY_ADDRESS } from "@bouncetech/contracts";
import addressMatch from "./utils/address-match";

// event Mint(address indexed minter, address indexed to, uint256 baseAmount, uint256 ltAmount);
ponder.on("LeveragedToken:Mint", async ({ event, context }) => {
  const { minter, to, baseAmount, ltAmount } = event.args;

  // Solving an issue where the factory mints some tokens before emitting the CreateLeveragedToken event
  if (addressMatch(minter, FACTORY_ADDRESS)) return;

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
  await ensureUser(context.db, to);
  const targetLeverage = await getTargetLeverage(
    context.db,
    event.log.address
  );
  const notionalVolume = (baseAmount * targetLeverage) / BigInt(1e18);
  await context.db
    .update(schema.user, { address: to })
    .set((row) => ({
      tradeCount: row.tradeCount + 1,
      mintVolumeNominal: row.mintVolumeNominal + baseAmount,
      totalVolumeNominal: row.totalVolumeNominal + baseAmount,
      mintVolumeNotional: row.mintVolumeNotional + notionalVolume,
      totalVolumeNotional: row.totalVolumeNotional + notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
    }));
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
  await ensureUser(context.db, to);
  const targetLeverage = await getTargetLeverage(
    context.db,
    event.log.address
  );
  const notionalVolume = (baseAmount * targetLeverage) / BigInt(1e18);
  await context.db
    .update(schema.user, { address: to })
    .set((row) => ({
      tradeCount: row.tradeCount + 1,
      redeemVolumeNominal: row.redeemVolumeNominal + baseAmount,
      totalVolumeNominal: row.totalVolumeNominal + baseAmount,
      redeemVolumeNotional: row.redeemVolumeNotional + notionalVolume,
      totalVolumeNotional: row.totalVolumeNotional + notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
    }));
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
  await ensureUser(context.db, user);
  const targetLeverage = await getTargetLeverage(
    context.db,
    event.log.address
  );
  const notionalVolume = (baseAmount * targetLeverage) / BigInt(1e18);
  await context.db
    .update(schema.user, { address: user })
    .set((row) => ({
      tradeCount: row.tradeCount + 1,
      redeemVolumeNominal: row.redeemVolumeNominal + baseAmount,
      totalVolumeNominal: row.totalVolumeNominal + baseAmount,
      redeemVolumeNotional: row.redeemVolumeNotional + notionalVolume,
      totalVolumeNotional: row.totalVolumeNotional + notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
    }));
});

// event Transfer(address indexed from, address indexed to, uint256 value);
ponder.on("LeveragedToken:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  const leveragedToken = event.log.address;

  await context.db.insert(schema.transfer).values({
    id: crypto.randomUUID(),
    timestamp: event.block.timestamp,
    leveragedToken: event.log.address,
    sender: from,
    recipient: to,
    amount: value,
    txHash: event.transaction?.hash ?? "",
  });

  if (from !== zeroAddress) {
    await ensureUser(context.db, from);
    await ensureBalance(context.db, from, leveragedToken);
    await context.db
      .update(schema.balance, {
        user: from,
        leveragedToken,
      })
      .set((row) => ({
        amount: row.amount - value,
      }));
  }

  if (to !== zeroAddress) {
    await ensureUser(context.db, to);
    await ensureBalance(context.db, to, leveragedToken);
    await context.db
      .update(schema.balance, {
        user: to,
        leveragedToken,
      })
      .set((row) => ({
        amount: row.amount + value,
      }));
  }
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
