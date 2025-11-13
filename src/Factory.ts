import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// event CreateLeveragedToken(address indexed creator, address indexed token, uint32 indexed marketId, uint256 targetLeverage, bool isLong);
ponder.on("Factory:CreateLeveragedToken", async ({ event, context }) => {
  const { creator, token, marketId, targetLeverage, isLong } = event.args;

  await context.db.insert(schema.leveragedToken).values({
    address: token,
    creator: creator,
    marketId: marketId,
    targetLeverage: targetLeverage,
    isLong: isLong,
  });
});
