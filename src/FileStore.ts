import { ponder } from "ponder:registry";
import schema from "ponder:schema";

ponder.on("LeveragedToken:SetAgent", async ({ event, context }) => {
  const { slot, agent, name } = event.args;

  await context.db.insert(schema.leveragedTokenAgent).values({
    slot,
    agent,
    name,
  });
});
