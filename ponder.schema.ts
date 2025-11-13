import { onchainTable, relations } from "ponder";

export const leveragedToken = onchainTable("leveragedToken", (t) => ({
  address: t.hex().primaryKey(),
  creator: t.hex().notNull(),
  marketId: t.integer().notNull(),
  targetLeverage: t.bigint().notNull(),
  isLong: t.boolean().notNull(),
  symbol: t.text().notNull(),
  name: t.text().notNull(),
  decimals: t.integer().notNull(),
}));

export const trade = onchainTable("trade", (t) => ({
  id: t.text().primaryKey(),
  isBuy: t.boolean().notNull(),
  leveragedToken: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
  sender: t.hex().notNull(),
  recipient: t.hex().notNull(),
  baseAssetAmount: t.bigint().notNull(),
  leveragedTokenAmount: t.bigint().notNull(),
}));

export const leveragedTokensRelations = relations(
  leveragedToken,
  ({ many }) => ({
    trades: many(trade),
  })
);

export const tradesRelations = relations(trade, ({ one }) => ({
  leveragedToken: one(leveragedToken, {
    fields: [trade.leveragedToken],
    references: [leveragedToken.address],
  }),
}));
