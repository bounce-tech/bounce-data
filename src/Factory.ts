import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// event CreateLeveragedToken(address indexed creator, address indexed token, uint32 indexed marketId, uint256 targetLeverage, bool isLong);
ponder.on("Factory:CreateLeveragedToken", async ({ event, context }) => {
  const { creator, token, marketId, targetLeverage, isLong } = event.args;

  const symbol = await context.client.readContract({
    abi: context.contracts.LeveragedToken.abi,
    address: token,
    functionName: "symbol",
  });

  const name = await context.client.readContract({
    abi: context.contracts.LeveragedToken.abi,
    address: token,
    functionName: "name",
  });

  const decimals = await context.client.readContract({
    abi: context.contracts.LeveragedToken.abi,
    address: token,
    functionName: "decimals",
  });

  const asset = name.split(" ")[0];
  if (!asset) throw new Error("Asset not found");

  await context.db.insert(schema.leveragedToken).values({
    address: token,
    creator: creator,
    marketId: marketId,
    targetLeverage: targetLeverage,
    isLong: isLong,
    symbol: symbol,
    name: name,
    decimals: decimals,
    assets: asset,
  });
});
