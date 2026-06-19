import { db } from "ponder:api";
import schema from "ponder:schema";
import { asc } from "drizzle-orm";

const SECONDS_PER_DAY = 86400;

// $500 notional volume threshold (24 decimals: 6 USDC + 18 leverage)
const NOTIONAL_VOLUME_THRESHOLD = 500n * 10n ** 24n;

// $500 position cost-basis threshold (6 decimals, base asset / USDC)
const POSITION_COST_THRESHOLD = 500n * 10n ** 6n;

interface ActiveUsersChartPoint {
  timestamp: number;
  activeUsers: number;
}

interface TradeRow {
  recipient: string;
  token: string;
  timestamp: bigint;
  isBuy: boolean;
  baseAssetAmount: bigint;
  leveragedTokenAmount: bigint;
}

const getActiveUsersChart = async (): Promise<ActiveUsersChartPoint[]> => {
  try {
    // Target leverage per token (small table) for notional-volume calculation.
    const tokens = await db
      .select({
        address: schema.leveragedToken.address,
        targetLeverage: schema.leveragedToken.targetLeverage,
      })
      .from(schema.leveragedToken);
    const leverageByToken = new Map<string, bigint>();
    for (const t of tokens) leverageByToken.set(t.address, t.targetLeverage);

    // Fetch every trade in chronological order. We reconstruct each user's
    // running position balance and average-cost basis trade-by-trade (mirroring
    // the indexer in LeveragedToken.ts), so the holding criterion can be
    // evaluated on every historical day rather than only on the latest point.
    // Processing per trade (not per-day aggregates) preserves intraday ordering:
    // a same-day exit and re-entry correctly resets the cost basis.
    const trades = (await db
      .select({
        recipient: schema.trade.recipient,
        token: schema.trade.leveragedToken,
        timestamp: schema.trade.timestamp,
        isBuy: schema.trade.isBuy,
        baseAssetAmount: schema.trade.baseAssetAmount,
        leveragedTokenAmount: schema.trade.leveragedTokenAmount,
      })
      .from(schema.trade)
      .orderBy(asc(schema.trade.timestamp), asc(schema.trade.id))) as TradeRow[];

    if (trades.length === 0) return [];

    // Bucket trades by day (preserving chronological order within each day) and
    // accumulate per-user notional volume per day.
    const tradesByDay = new Map<number, TradeRow[]>();
    const volumeByDayUser = new Map<number, Map<string, bigint>>();
    let minDay = Infinity;
    let maxDay = -Infinity;

    for (const trade of trades) {
      const ts = Number(trade.timestamp);
      const day = ts - (ts % SECONDS_PER_DAY);
      if (day < minDay) minDay = day;
      if (day > maxDay) maxDay = day;

      if (!tradesByDay.has(day)) tradesByDay.set(day, []);
      tradesByDay.get(day)!.push(trade);

      const leverage = leverageByToken.get(trade.token);
      if (leverage !== undefined) {
        const notional = trade.baseAssetAmount * leverage;
        if (!volumeByDayUser.has(day)) volumeByDayUser.set(day, new Map());
        const dayVolume = volumeByDayUser.get(day)!;
        dayVolume.set(
          trade.recipient,
          (dayVolume.get(trade.recipient) || 0n) + notional
        );
      }
    }

    // Running cost-basis reconstruction state.
    // positionBalance / positionCost are keyed per (user, token); costByUser is
    // the aggregate cost basis per user, mirrored into the `holders` set so the
    // set of users holding >= $500 can be read cheaply on every day.
    const positionBalance = new Map<string, bigint>();
    const positionCost = new Map<string, bigint>();
    const costByUser = new Map<string, bigint>();
    const holders = new Set<string>();

    const applyUserCostDelta = (user: string, delta: bigint) => {
      if (delta === 0n) return;
      const next = (costByUser.get(user) || 0n) + delta;
      costByUser.set(user, next);
      if (next >= POSITION_COST_THRESHOLD) holders.add(user);
      else holders.delete(user);
    };

    const applyTrade = (trade: TradeRow) => {
      // Key on `recipient`: the indexer attributes every trade's balance and
      // cost-basis change to the `to` address, stored as the trade's `recipient`
      // (see LeveragedToken Mint/Redeem/ExecuteRedeem); `sender` is informational
      // only. This keeps the reconstruction consistent with the indexer's
      // balance/purchaseCost table.
      const key = `${trade.recipient}:${trade.token}`;
      const balance = positionBalance.get(key) || 0n;
      const cost = positionCost.get(key) || 0n;

      let newBalance: bigint;
      let newCost: bigint;
      if (trade.isBuy) {
        newBalance = balance + trade.leveragedTokenAmount;
        newCost = cost + trade.baseAssetAmount;
      } else if (balance <= 0n || trade.leveragedTokenAmount >= balance) {
        // Full exit, or tokens acquired via an untracked transfer; clamp to zero.
        newBalance = 0n;
        newCost = 0n;
      } else {
        // Partial redeem: retain the average-cost remainder exactly as the
        // indexer does -- remaining = cost * balanceAfter / balanceBefore --
        // rather than subtracting the cost of the sold slice, which can leave an
        // extra base unit and misclassify users near the threshold.
        newBalance = balance - trade.leveragedTokenAmount;
        newCost = (cost * newBalance) / balance;
      }

      positionBalance.set(key, newBalance);
      positionCost.set(key, newCost);
      applyUserCostDelta(trade.recipient, newCost - cost);
    };

    // Extend chart to today.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const today = nowSeconds - (nowSeconds % SECONDS_PER_DAY);
    const chartEnd = Math.max(maxDay, today);

    const chart: ActiveUsersChartPoint[] = [];

    for (let day = minDay; day <= chartEnd; day += SECONDS_PER_DAY) {
      // Apply this day's trades (in chronological order) before snapshotting.
      const dayRows = tradesByDay.get(day);
      if (dayRows) for (const trade of dayRows) applyTrade(trade);

      const windowStart = day - 6 * SECONDS_PER_DAY;

      // Sum notional volume per user across the rolling 7-day window.
      const userVolumes = new Map<string, bigint>();
      for (let d = windowStart; d <= day; d += SECONDS_PER_DAY) {
        const dayMap = volumeByDayUser.get(d);
        if (!dayMap) continue;
        for (const [user, vol] of dayMap) {
          userVolumes.set(user, (userVolumes.get(user) || 0n) + vol);
        }
      }

      // A user is active if they met the volume threshold in the window or are
      // holding an open position worth >= $500 (by cost basis) as of this day.
      const activeUserSet = new Set<string>(holders);
      for (const [user, vol] of userVolumes) {
        if (vol >= NOTIONAL_VOLUME_THRESHOLD) {
          activeUserSet.add(user);
        }
      }

      chart.push({
        timestamp: day * 1000,
        activeUsers: activeUserSet.size,
      });
    }

    return chart;
  } catch (error) {
    throw new Error("Failed to fetch active users chart data");
  }
};

export default getActiveUsersChart;
