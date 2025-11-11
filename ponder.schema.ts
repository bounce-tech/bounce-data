import { onchainTable } from "ponder";

export const leveragedTokenMint = onchainTable("leveragedTokenMint", (t) => ({
  id: t.text().primaryKey(),
  leveragedToken: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
  sender: t.hex().notNull(),
  recipient: t.hex().notNull(),
  baseAssetAmount: t.bigint().notNull(),
  leveragedTokenAmount: t.bigint().notNull(),
}));
