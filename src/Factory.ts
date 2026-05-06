import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { Address } from "viem";

// Upserts a leveragedToken row from a Factory event. The row may already exist
// because `ensureLeveragedToken` bootstrapped it from on-chain reads when an
// earlier event for the same token was indexed; in that case we overwrite the
// fields that only the Factory event reliably provides (notably `creator`).
async function upsertLeveragedToken(
  context: any,
  args: {
    creator: Address;
    token: Address;
    marketId: number;
    targetLeverage: bigint;
    isLong: boolean;
  }
) {
  const { creator, token, marketId, targetLeverage, isLong } = args;
  const address = token;

  const symbol = await context.client.readContract({
    abi: context.contracts.LeveragedToken.abi,
    address,
    functionName: "symbol",
  });

  const name = await context.client.readContract({
    abi: context.contracts.LeveragedToken.abi,
    address,
    functionName: "name",
  });

  const decimals = await context.client.readContract({
    abi: context.contracts.LeveragedToken.abi,
    address,
    functionName: "decimals",
  });

  const targetAsset = name.split(" ")[0];
  if (!targetAsset) throw new Error("Asset not found");

  await context.db
    .insert(schema.leveragedToken)
    .values({
      address,
      creator,
      marketId,
      targetLeverage,
      isLong,
      symbol,
      name,
      decimals,
      targetAsset,
    })
    .onConflictDoUpdate(() => ({
      creator,
      marketId,
      targetLeverage,
      isLong,
      symbol,
      name,
      decimals,
      targetAsset,
    }));
}

// event CreateLeveragedToken(address indexed creator, address indexed token, uint32 indexed marketId, uint256 targetLeverage, bool isLong);
ponder.on("Factory:CreateLeveragedToken", async ({ event, context }) => {
  await upsertLeveragedToken(context, event.args);
});

// event ImportLeveragedToken(address indexed importer, address indexed token, uint32 indexed marketId, uint256 targetLeverage, bool isLong);
ponder.on("Factory:ImportLeveragedToken", async ({ event, context }) => {
  const { importer, token, marketId, targetLeverage, isLong } = event.args;
  await upsertLeveragedToken(context, {
    creator: importer,
    token,
    marketId,
    targetLeverage,
    isLong,
  });
});
