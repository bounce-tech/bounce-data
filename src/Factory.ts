import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// event CreateLeveragedToken(address indexed creator, address indexed token, uint32 indexed marketId, uint256 targetLeverage, bool isLong);
ponder.on("Factory:CreateLeveragedToken", async ({ event, context }) => {
  const { creator, token, marketId, targetLeverage, isLong } = event.args;
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

  await context.db.insert(schema.leveragedToken).values({
    address,
    creator,
    marketId,
    targetLeverage,
    isLong,
    symbol,
    name,
    decimals,
    targetAsset,
  });
});
