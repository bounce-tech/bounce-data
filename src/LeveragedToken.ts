import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import crypto from "crypto";
import { zeroAddress } from "viem";
import { ensureUser } from "./utils/ensure-user";
import { getTargetLeverage } from "./utils/get-target-leverage";
import { ensureBalance } from "./utils/ensure-balance";
import { FACTORY_ADDRESS } from "@bouncetech/contracts";
import addressMatch from "./utils/address-match";
import { div, mul } from "./api/utils/scaled-number";

// event Mint(address indexed minter, address indexed to, uint256 baseAmount, uint256 ltAmount);
ponder.on("LeveragedToken:Mint", async ({ event, context }) => {
  const { minter, to, baseAmount, ltAmount } = event.args;
  const leveragedToken = event.log.address;

  // Solving an issue where the factory mints some tokens before emitting the CreateLeveragedToken event
  if (addressMatch(minter, FACTORY_ADDRESS)) return;

  const txHash = event.transaction?.hash ?? "";
  await context.db.insert(schema.trade).values({
    id: crypto.randomUUID(),
    isBuy: true,
    timestamp: event.block.timestamp,
    leveragedToken,
    sender: minter,
    recipient: to,
    baseAssetAmount: baseAmount,
    leveragedTokenAmount: ltAmount,
    originTxHash: txHash,
    txHash: txHash,
  });

  // Update user stats
  await ensureUser(context.db, to);
  const targetLeverage = await getTargetLeverage(
    context.db,
    leveragedToken
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
  await ensureBalance(context.db, to, leveragedToken);
  await context.db.update(schema.balance, { user: to, leveragedToken }).set((row) => ({
    purchaseCost: row.purchaseCost + baseAmount,
  }));
});

// event Redeem(address indexed sender, address indexed to, uint256 ltAmount, uint256 baseAmount);
ponder.on("LeveragedToken:Redeem", async ({ event, context }) => {
  const { sender, to, ltAmount, baseAmount } = event.args;
  if (ltAmount === 0n || baseAmount === 0n) return;
  const leveragedToken = event.log.address;

  // Update balance
  await ensureBalance(context.db, to, leveragedToken);
  const balance = await context.db.find(schema.balance, { user: to, leveragedToken });
  if (!balance) throw new Error("Balance not found");
  const balanceBeforeRedeem = balance.totalBalance + ltAmount;
  if (balanceBeforeRedeem === 0n) throw new Error("Balance before redeem is 0");
  const purchasePrice = div(balance.purchaseCost, balanceBeforeRedeem);
  const currentPrice = div(baseAmount, ltAmount);
  const priceDifference = currentPrice - purchasePrice;
  const profit = mul(priceDifference, ltAmount);
  await context.db.update(schema.balance, { user: to, leveragedToken }).set((row) => {
    return ({
      realizedProfit: row.realizedProfit + profit,
      purchaseCost: mul(balance.totalBalance, purchasePrice),
    })
  });

  // Insert trade
  const txHash = event.transaction?.hash ?? "";
  await context.db.insert(schema.trade).values({
    id: crypto.randomUUID(),
    isBuy: false,
    timestamp: event.block.timestamp,
    leveragedToken,
    sender: sender,
    recipient: to,
    baseAssetAmount: baseAmount,
    leveragedTokenAmount: ltAmount,
    profitAmount: profit,
    profitPercent: purchasePrice === 0n ? 0n : div(priceDifference, purchasePrice),
    originTxHash: txHash,
    txHash: txHash,
  });

  // Update user stats
  await ensureUser(context.db, to);
  const targetLeverage = await getTargetLeverage(
    context.db,
    leveragedToken
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
      realizedProfit: row.realizedProfit + profit,
    }));
});

// event PrepareRedeem(address indexed sender, uint256 ltAmount);
ponder.on("LeveragedToken:PrepareRedeem", async ({ event, context }) => {
  const { sender, ltAmount } = event.args;
  const leveragedToken = event.log.address;

  await ensureUser(context.db, sender);
  await ensureBalance(context.db, sender, leveragedToken);
  await context.db.update(schema.balance, { user: sender, leveragedToken }).set((row) => ({
    creditBalance: row.creditBalance + ltAmount,
    totalBalance: row.totalBalance + ltAmount,
  }));
  await context.db.insert(schema.pendingRedemption).values({
    user: sender,
    leveragedToken,
    txHash: event.transaction?.hash ?? "",
  });
});

// event ExecuteRedeem(address indexed user, uint256 ltAmount, uint256 baseAmount);
ponder.on("LeveragedToken:ExecuteRedeem", async ({ event, context }) => {
  const { user, ltAmount, baseAmount } = event.args;
  if (ltAmount === 0n || baseAmount === 0n) return;
  const leveragedToken = event.log.address;

  // Update balance
  await ensureBalance(context.db, user, leveragedToken);
  const balance = await context.db.find(schema.balance, { user, leveragedToken });
  if (!balance) throw new Error("Balance not found");
  const balanceBeforeRedeem = balance.totalBalance;
  const balanceAfterRedeem = balanceBeforeRedeem - ltAmount;
  if (balanceBeforeRedeem === 0n) throw new Error("Balance after redeem is 0");
  const purchasePrice = div(balance.purchaseCost, balanceBeforeRedeem);
  const currentPrice = div(baseAmount, ltAmount);
  const priceDifference = currentPrice - purchasePrice;
  const profit = mul(priceDifference, ltAmount);
  await context.db.update(schema.balance, { user, leveragedToken }).set((row) => {
    return ({
      realizedProfit: row.realizedProfit + profit,
      purchaseCost: mul(balanceAfterRedeem, purchasePrice),
    })
  });

  // Pending redemption
  const pendingRedemption = await context.db.find(schema.pendingRedemption, { user, leveragedToken });
  if (!pendingRedemption) throw new Error("Pending redemption not found");
  await context.db.delete(schema.pendingRedemption, { user: pendingRedemption.user, leveragedToken: pendingRedemption.leveragedToken });

  // Insert trade
  await context.db.insert(schema.trade).values({
    id: crypto.randomUUID(),
    isBuy: false,
    timestamp: event.block.timestamp,
    leveragedToken: event.log.address,
    sender: user,
    recipient: user,
    baseAssetAmount: baseAmount,
    leveragedTokenAmount: ltAmount,
    profitAmount: profit,
    profitPercent: purchasePrice === 0n ? 0n : div(priceDifference, purchasePrice),
    originTxHash: pendingRedemption.txHash,
    txHash: event.transaction?.hash ?? "",
  });

  // Update user stats
  await ensureUser(context.db, user);
  const targetLeverage = await getTargetLeverage(
    context.db,
    event.log.address
  );
  const notionalVolume = (baseAmount * targetLeverage) / BigInt(1e18);
  await ensureBalance(context.db, user, event.log.address);
  await context.db.update(schema.balance, { user: user, leveragedToken: event.log.address }).set((row) => ({
    creditBalance: row.creditBalance - ltAmount,
    totalBalance: row.totalBalance - ltAmount,
  }));
  await context.db
    .update(schema.user, { address: user })
    .set((row) => ({
      tradeCount: row.tradeCount + 1,
      redeemVolumeNominal: row.redeemVolumeNominal + baseAmount,
      totalVolumeNominal: row.totalVolumeNominal + baseAmount,
      redeemVolumeNotional: row.redeemVolumeNotional + notionalVolume,
      totalVolumeNotional: row.totalVolumeNotional + notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
      realizedProfit: row.realizedProfit + profit,
    }));
});

// event CancelRedeem(address indexed user, uint256 credit);
ponder.on("LeveragedToken:CancelRedeem", async ({ event, context }) => {
  const { user, credit } = event.args;
  await ensureUser(context.db, user);
  await ensureBalance(context.db, user, event.log.address);
  await context.db.update(schema.balance, { user: user, leveragedToken: event.log.address }).set((row) => ({
    creditBalance: row.creditBalance - credit,
    totalBalance: row.totalBalance - credit,
  }));
  await context.db.delete(schema.pendingRedemption, { user: user, leveragedToken: event.log.address });
});

// event Transfer(address indexed from, address indexed to, uint256 value);
ponder.on("LeveragedToken:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  if (value === 0n || from === to) return;
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
        liquidBalance: row.liquidBalance - value,
        totalBalance: row.totalBalance - value,
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
        liquidBalance: row.liquidBalance + value,
        totalBalance: row.totalBalance + value,
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
