import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import crypto from "crypto";
import { zeroAddress } from "viem";
import { ensureUser } from "./utils/ensure-user";
import { getTargetLeverage } from "./utils/get-target-leverage";
import { ensureBalance } from "./utils/ensure-balance";
import { ensureLeveragedToken } from "./utils/ensure-leveraged-token";
import { FACTORY_ADDRESS } from "@bouncetech/contracts";
import addressMatch from "./utils/address-match";
import { div } from "./api/utils/scaled-number";

// event Mint(address indexed minter, address indexed to, uint256 baseAmount, uint256 ltAmount);
ponder.on("LeveragedToken:Mint", async ({ event, context }) => {
  const { minter, to, baseAmount, ltAmount } = event.args;
  const leveragedToken = event.log.address;

  // Solving an issue where the factory mints some tokens before emitting the CreateLeveragedToken event
  if (addressMatch(minter, FACTORY_ADDRESS)) return;

  await ensureLeveragedToken(context, leveragedToken);

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
  const targetLeverage = await getTargetLeverage(
    context.db,
    leveragedToken
  );
  const notionalVolume = (baseAmount * targetLeverage) / BigInt(1e18);
  await context.db
    .insert(schema.user)
    .values({
      address: to,
      tradeCount: 1,
      mintVolumeNominal: baseAmount,
      totalVolumeNominal: baseAmount,
      mintVolumeNotional: notionalVolume,
      totalVolumeNotional: notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      tradeCount: row.tradeCount + 1,
      mintVolumeNominal: row.mintVolumeNominal + baseAmount,
      totalVolumeNominal: row.totalVolumeNominal + baseAmount,
      mintVolumeNotional: row.mintVolumeNotional + notionalVolume,
      totalVolumeNotional: row.totalVolumeNotional + notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
    }));
  await context.db
    .insert(schema.balance)
    .values({ user: to, leveragedToken, purchaseCost: baseAmount })
    .onConflictDoUpdate((row) => ({
      purchaseCost: row.purchaseCost + baseAmount,
    }));
});

// event Redeem(address indexed sender, address indexed to, uint256 ltAmount, uint256 baseAmount);
ponder.on("LeveragedToken:Redeem", async ({ event, context }) => {
  const { sender, to, ltAmount, baseAmount } = event.args;
  if (ltAmount === 0n || baseAmount === 0n) return;
  const leveragedToken = event.log.address;

  await ensureLeveragedToken(context, leveragedToken);

  // Update balance
  await ensureBalance(context.db, to, leveragedToken);
  const balance = await context.db.find(schema.balance, { user: to, leveragedToken });
  if (!balance) throw new Error("Balance not found");
  const balanceBeforeRedeem = balance.totalBalance + ltAmount;
  if (balanceBeforeRedeem === 0n) throw new Error("Balance before redeem is 0");
  // Average-cost basis of the redeemed tokens, computed as a single
  // multiply-before-divide. We deliberately avoid deriving an intermediate
  // per-token price: purchaseCost is denominated in the base asset (6 decimals)
  // while balances are 18 decimals, so a per-token price collapses to a handful
  // of significant digits and integer truncation skews the residual basis.
  const remainingCost = (balance.purchaseCost * balance.totalBalance) / balanceBeforeRedeem;
  const costOfRedeemedTokens = balance.purchaseCost - remainingCost;
  const profit = baseAmount - costOfRedeemedTokens;
  await context.db.update(schema.balance, { user: to, leveragedToken }).set((row) => {
    return ({
      realizedProfit: row.realizedProfit + profit,
      purchaseCost: remainingCost,
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
    profitPercent: costOfRedeemedTokens === 0n ? 0n : div(profit, costOfRedeemedTokens),
    originTxHash: txHash,
    txHash: txHash,
  });

  // Update user stats
  const targetLeverage = await getTargetLeverage(
    context.db,
    leveragedToken
  );
  const notionalVolume = (baseAmount * targetLeverage) / BigInt(1e18);
  await context.db
    .insert(schema.user)
    .values({
      address: to,
      tradeCount: 1,
      redeemVolumeNominal: baseAmount,
      totalVolumeNominal: baseAmount,
      redeemVolumeNotional: notionalVolume,
      totalVolumeNotional: notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
      realizedProfit: profit,
    })
    .onConflictDoUpdate((row) => ({
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

  await ensureLeveragedToken(context, leveragedToken);
  await ensureUser(context.db, sender);
  await context.db
    .insert(schema.balance)
    .values({ user: sender, leveragedToken, creditBalance: ltAmount, totalBalance: ltAmount })
    .onConflictDoUpdate((row) => ({
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

  await ensureLeveragedToken(context, leveragedToken);

  // Update balance
  await ensureBalance(context.db, user, leveragedToken);
  const balance = await context.db.find(schema.balance, { user, leveragedToken });
  if (!balance) throw new Error("Balance not found");
  const balanceBeforeRedeem = balance.totalBalance;
  const balanceAfterRedeem = balanceBeforeRedeem - ltAmount;
  if (balanceBeforeRedeem === 0n) throw new Error("Balance after redeem is 0");
  // See the Redeem handler: derive the residual basis directly via
  // multiply-before-divide to avoid the precision loss of an intermediate
  // per-token price (6-decimal cost vs 18-decimal balances).
  const remainingCost = (balance.purchaseCost * balanceAfterRedeem) / balanceBeforeRedeem;
  const costOfRedeemedTokens = balance.purchaseCost - remainingCost;
  const profit = baseAmount - costOfRedeemedTokens;
  await context.db.update(schema.balance, { user, leveragedToken }).set((row) => {
    return ({
      realizedProfit: row.realizedProfit + profit,
      purchaseCost: remainingCost,
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
    profitPercent: costOfRedeemedTokens === 0n ? 0n : div(profit, costOfRedeemedTokens),
    originTxHash: pendingRedemption.txHash,
    txHash: event.transaction?.hash ?? "",
  });

  // Update user stats
  const targetLeverage = await getTargetLeverage(
    context.db,
    event.log.address
  );
  const notionalVolume = (baseAmount * targetLeverage) / BigInt(1e18);
  await context.db
    .insert(schema.balance)
    .values({ user, leveragedToken: event.log.address, creditBalance: -ltAmount, totalBalance: -ltAmount })
    .onConflictDoUpdate((row) => ({
      creditBalance: row.creditBalance - ltAmount,
      totalBalance: row.totalBalance - ltAmount,
    }));
  await context.db
    .insert(schema.user)
    .values({
      address: user,
      tradeCount: 1,
      redeemVolumeNominal: baseAmount,
      totalVolumeNominal: baseAmount,
      redeemVolumeNotional: notionalVolume,
      totalVolumeNotional: notionalVolume,
      lastTradeTimestamp: event.block.timestamp,
      realizedProfit: profit,
    })
    .onConflictDoUpdate((row) => ({
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
  await ensureLeveragedToken(context, event.log.address);
  await ensureUser(context.db, user);
  await context.db
    .insert(schema.balance)
    .values({ user, leveragedToken: event.log.address, creditBalance: -credit, totalBalance: -credit })
    .onConflictDoUpdate((row) => ({
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

  if (addressMatch(to, FACTORY_ADDRESS)) return;

  await ensureLeveragedToken(context, leveragedToken);

  // Updating total supply
  if (from === zeroAddress) {
    await context.db.update(schema.leveragedToken, { address: leveragedToken }).set((row) => ({
      totalSupply: row.totalSupply + value,
    }));
  } else if (to === zeroAddress) {
    await context.db.update(schema.leveragedToken, { address: leveragedToken }).set((row) => ({
      totalSupply: row.totalSupply - value,
    }));
  }


  // A transfer is "external" (peer-to-peer) only when it is not a leg of a
  // mint, redeem, redeem escrow, or factory distribution. Those protocol legs
  // always involve the zero address, the leveraged token contract itself
  // (prepare/execute/cancel escrow), or the factory. External transfers move
  // tokens without an associated cost basis, distorting the holder's PnL, so we
  // accumulate their gross size for both the sender and the receiver.
  const isExternalTransfer =
    from !== zeroAddress &&
    to !== zeroAddress &&
    !addressMatch(from, leveragedToken) &&
    !addressMatch(to, leveragedToken) &&
    !addressMatch(from, FACTORY_ADDRESS);

  if (from !== zeroAddress) {
    await ensureUser(context.db, from);
    await context.db
      .insert(schema.balance)
      .values({
        user: from,
        leveragedToken,
        liquidBalance: -value,
        totalBalance: -value,
        externalTransferAmount: isExternalTransfer ? value : 0n,
      })
      .onConflictDoUpdate((row) => ({
        liquidBalance: row.liquidBalance - value,
        totalBalance: row.totalBalance - value,
        externalTransferAmount: isExternalTransfer
          ? row.externalTransferAmount + value
          : row.externalTransferAmount,
      }));
  }

  if (to !== zeroAddress) {
    await ensureUser(context.db, to);
    await context.db
      .insert(schema.balance)
      .values({
        user: to,
        leveragedToken,
        liquidBalance: value,
        totalBalance: value,
        externalTransferAmount: isExternalTransfer ? value : 0n,
      })
      .onConflictDoUpdate((row) => ({
        liquidBalance: row.liquidBalance + value,
        totalBalance: row.totalBalance + value,
        externalTransferAmount: isExternalTransfer
          ? row.externalTransferAmount + value
          : row.externalTransferAmount,
      }));
  }
});

// event SendFeesToTreasury(uint256 amount);
ponder.on("LeveragedToken:SendFeesToTreasury", async ({ event, context }) => {
  const { amount } = event.args;

  await ensureLeveragedToken(context, event.log.address);

  await context.db.insert(schema.fee).values({
    id: crypto.randomUUID(),
    leveragedToken: event.log.address,
    timestamp: event.block.timestamp,
    amount: amount,
    destination: "treasury",
  });
});

// event SetMintPaused(bool mintPaused);
ponder.on("LeveragedToken:SetMintPaused", async ({ event, context }) => {
  const { mintPaused } = event.args;
  const leveragedToken = event.log.address;
  await ensureLeveragedToken(context, leveragedToken);
  await context.db.update(schema.leveragedToken, { address: leveragedToken }).set({
    mintPaused,
  });
});

// event BridgeToEvm(address indexed sender, uint256 amount);
ponder.on("LeveragedToken:BridgeToEvm", async ({ event, context }) => {
  const { sender, amount } = event.args;
  const leveragedToken = event.log.address;
  await ensureLeveragedToken(context, leveragedToken);
  await context.db.update(schema.leveragedToken, { address: leveragedToken }).set({
    latestBridgeToEvmBlock: event.block.number,
  });

  // Append to history alongside the live scalar above.
  await context.db.insert(schema.bridgeMarker).values({
    chainId: context.chain.id,
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    tokenAddress: leveragedToken,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    amount,
    sender,
  });
});
