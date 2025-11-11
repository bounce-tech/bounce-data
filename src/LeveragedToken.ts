import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import crypto from "crypto";

ponder.on("LeveragedToken:Mint", async ({ event, context }) => {
  const { minter, to, baseAmount, ltAmount } = event.args;

  await context.db.insert(schema.leveragedTokenMint).values({
    id: crypto.randomUUID(),
    timestamp: event.block.timestamp,
    leveragedToken: event.log.address,
    sender: minter,
    recipient: to,
    baseAssetAmount: baseAmount,
    leveragedTokenAmount: ltAmount,
  });
});
