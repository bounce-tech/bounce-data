import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import crypto from "crypto";

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
