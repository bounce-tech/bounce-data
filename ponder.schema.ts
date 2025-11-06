import { onchainTable } from "ponder";

export const leveragedTokenAgent = onchainTable("leveragedTokenAgent", (t) => ({
  slot: t.integer().primaryKey(),
  agent: t.text().notNull(),
  name: t.text().notNull(),
}));
