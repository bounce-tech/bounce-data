import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, sql } from "drizzle-orm";

const SECONDS_PER_DAY = 86400;

// $500 notional volume threshold (24 decimals: 6 USDC + 18 leverage)
const NOTIONAL_VOLUME_THRESHOLD = 500n * 10n ** 24n;

// $500 position cost-basis threshold (6 decimals, base asset / USDC)
const POSITION_COST_THRESHOLD = 500n * 10n ** 6n;

interface ActiveUsersChartPoint {
  timestamp: number;
  activeUsers: number;
}

interface DailyRow {
  recipient: string;
  token: string;
  buyTokens: bigint;
  buyBase: bigint;
  sellTokens: bigint;
  notionalVolume: bigint;
}

const getActiveUsersChart = async (): Promise<ActiveUsersChartPoint[]> => {
  try {
    // Aggregate trades per (user, token, day). We need per-token buy/sell flows
    // (not just net volume) so we can reconstruct each user's running cost basis
    // and value their open positions on every historical day, rather than only
    // crediting current holders to the latest data point.
    const dailyData = await db
      .select({
        recipient: schema.trade.recipient,
        token: schema.trade.leveragedToken,
        dayTimestamp: sql<string>`(${schema.trade.timestamp} - (${schema.trade.timestamp} % ${SECONDS_PER_DAY}))`,
        buyTokens: sql<string>`coalesce(sum(case when ${schema.trade.isBuy} then ${schema.trade.leveragedTokenAmount} else 0 end), 0)`,
        buyBase: sql<string>`coalesce(sum(case when ${schema.trade.isBuy} then ${schema.trade.baseAssetAmount} else 0 end), 0)`,
        sellTokens: sql<string>`coalesce(sum(case when not ${schema.trade.isBuy} then ${schema.trade.leveragedTokenAmount} else 0 end), 0)`,
        notionalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * ${schema.leveragedToken.targetLeverage})`,
      })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .groupBy(sql`1`, sql`2`, sql`3`)
      .orderBy(sql`3 asc`);

    if (dailyData.length === 0) return [];

    // Group rows by day and accumulate per-user notional volume for the day.
    const rowsByDay = new Map<number, DailyRow[]>();
    const volumeByDayUser = new Map<number, Map<string, bigint>>();
    let minDay = Infinity;
    let maxDay = -Infinity;

    for (const row of dailyData) {
      const day = Number(row.dayTimestamp);
      if (day < minDay) minDay = day;
      if (day > maxDay) maxDay = day;

      if (!rowsByDay.has(day)) rowsByDay.set(day, []);
      rowsByDay.get(day)!.push({
        recipient: row.recipient,
        token: row.token,
        buyTokens: BigInt(row.buyTokens),
        buyBase: BigInt(row.buyBase),
        sellTokens: BigInt(row.sellTokens),
        notionalVolume: BigInt(row.notionalVolume),
      });

      if (!volumeByDayUser.has(day)) volumeByDayUser.set(day, new Map());
      const dayVolume = volumeByDayUser.get(day)!;
      dayVolume.set(
        row.recipient,
        (dayVolume.get(row.recipient) || 0n) + BigInt(row.notionalVolume)
      );
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

    const applyDay = (rows: DailyRow[]) => {
      for (const row of rows) {
        const key = `${row.recipient}:${row.token}`;
        const balance = positionBalance.get(key) || 0n;
        const cost = positionCost.get(key) || 0n;

        // Apply the day's buys, then its sells. Sells reduce cost basis using
        // the same average-cost method as the indexer (multiply-before-divide).
        const balanceAfterBuys = balance + row.buyTokens;
        const costAfterBuys = cost + row.buyBase;

        let newBalance = balanceAfterBuys - row.sellTokens;
        let costOfSold = 0n;
        if (row.sellTokens > 0n && balanceAfterBuys > 0n) {
          const sold =
            row.sellTokens > balanceAfterBuys ? balanceAfterBuys : row.sellTokens;
          costOfSold = (costAfterBuys * sold) / balanceAfterBuys;
        }
        let newCost = costAfterBuys - costOfSold;

        // Clamp residuals so untracked transfers can't drive values negative.
        if (newBalance <= 0n) {
          newBalance = 0n;
          newCost = 0n;
        }
        if (newCost < 0n) newCost = 0n;

        positionBalance.set(key, newBalance);
        positionCost.set(key, newCost);
        applyUserCostDelta(row.recipient, newCost - cost);
      }
    };

    // Extend chart to today.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const today = nowSeconds - (nowSeconds % SECONDS_PER_DAY);
    const chartEnd = Math.max(maxDay, today);

    const chart: ActiveUsersChartPoint[] = [];

    for (let day = minDay; day <= chartEnd; day += SECONDS_PER_DAY) {
      // Update cost-basis state with this day's trades before snapshotting.
      const dayRows = rowsByDay.get(day);
      if (dayRows) applyDay(dayRows);

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
