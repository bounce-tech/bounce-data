import { onchainTable } from "ponder";

export const leveragedTokens = onchainTable("leveragedTokens", (t) => ({
  address: t.hex().primaryKey(),
  creator: t.hex().notNull(),
  marketId: t.integer().notNull(),
  targetLeverage: t.bigint().notNull(),
  isLong: t.boolean().notNull(),
}));

export const trades = onchainTable("trades", (t) => ({
  id: t.text().primaryKey(),
  isBuy: t.boolean().notNull(),
  leveragedToken: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
  sender: t.hex().notNull(),
  recipient: t.hex().notNull(),
  baseAssetAmount: t.bigint().notNull(),
  leveragedTokenAmount: t.bigint().notNull(),
}));
