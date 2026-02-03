import { onchainTable, relations, primaryKey } from "ponder";

export const leveragedToken = onchainTable("leveragedToken", (t) => ({
  address: t.hex().primaryKey(),
  creator: t.hex().notNull(),
  marketId: t.integer().notNull(),
  targetLeverage: t.bigint().notNull(),
  isLong: t.boolean().notNull(),
  symbol: t.text().notNull(),
  name: t.text().notNull(),
  decimals: t.integer().notNull(),
  asset: t.text().notNull(),
  exchangeRate: t.bigint().notNull().default(0n),
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
  txHash: t.hex().notNull(),
}));

export const transfer = onchainTable("transfer", (t) => ({
  id: t.text().primaryKey(),
  timestamp: t.bigint().notNull(),
  leveragedToken: t.hex().notNull(),
  sender: t.hex().notNull(),
  recipient: t.hex().notNull(),
  amount: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const user = onchainTable("user", (t) => ({
  address: t.hex().notNull().primaryKey(),
  referralCode: t.text(),
  referrerCode: t.text(),
  referrerAddress: t.hex(),
  referredUserCount: t.integer().notNull().default(0),
  totalRebates: t.bigint().notNull().default(0n),
  referrerRebates: t.bigint().notNull().default(0n),
  refereeRebates: t.bigint().notNull().default(0n),
  claimedRebates: t.bigint().notNull().default(0n),
  tradeCount: t.integer().notNull().default(0),
  mintVolumeNominal: t.bigint().notNull().default(0n),
  redeemVolumeNominal: t.bigint().notNull().default(0n),
  totalVolumeNominal: t.bigint().notNull().default(0n),
  mintVolumeNotional: t.bigint().notNull().default(0n),
  redeemVolumeNotional: t.bigint().notNull().default(0n),
  totalVolumeNotional: t.bigint().notNull().default(0n),
  lastTradeTimestamp: t.bigint().notNull().default(0n),
}));

export const fee = onchainTable("fee", (t) => ({
  id: t.text().primaryKey(),
  leveragedToken: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
  amount: t.bigint().notNull(),
  destination: t.text().notNull(),
}));

export const balance = onchainTable(
  "balance",
  (t) => ({
    user: t.hex().notNull(),
    leveragedToken: t.hex().notNull(),
    amount: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.user, table.leveragedToken] }),
  })
);

export const leveragedTokensRelations = relations(
  leveragedToken,
  ({ many }) => ({
    trades: many(trade),
    transfers: many(transfer),
    fees: many(fee),
    balances: many(balance),
  })
);

export const tradesRelations = relations(trade, ({ one }) => ({
  leveragedToken: one(leveragedToken, {
    fields: [trade.leveragedToken],
    references: [leveragedToken.address],
  }),
}));

export const transfersRelations = relations(transfer, ({ one }) => ({
  leveragedToken: one(leveragedToken, {
    fields: [transfer.leveragedToken],
    references: [leveragedToken.address],
  }),
}));

export const feesRelations = relations(fee, ({ one }) => ({
  leveragedToken: one(leveragedToken, {
    fields: [fee.leveragedToken],
    references: [leveragedToken.address],
  }),
}));

export const balancesRelations = relations(balance, ({ one }) => ({
  user: one(user, {
    fields: [balance.user],
    references: [user.address],
  }),
  leveragedToken: one(leveragedToken, {
    fields: [balance.leveragedToken],
    references: [leveragedToken.address],
  }),
}));

export const usersRelations = relations(user, ({ many }) => ({
  balances: many(balance),
}));