import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, gt, sql } from "drizzle-orm";
import { mul } from "../utils/scaled-number";

const SECONDS_PER_DAY = 86400;

// $500 notional volume threshold (24 decimals: 6 USDC + 18 leverage)
const NOTIONAL_VOLUME_THRESHOLD = 500n * 10n ** 24n;

// $500 position value threshold (18 decimals)
const POSITION_VALUE_THRESHOLD = 500n * 10n ** 18n;

interface ActiveUsersChartPoint {
  timestamp: number;
  activeUsers: number;
}

const getActiveUsersChart = async (): Promise<ActiveUsersChartPoint[]> => {
  try {
    // Fetch all trades grouped by recipient and day, with summed notional volume
    const dailyUserVolumes = await db
      .select({
        recipient: schema.trade.recipient,
        dayTimestamp: sql<string>`(${schema.trade.timestamp} - (${schema.trade.timestamp} % ${SECONDS_PER_DAY}))`,
        notionalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * ${schema.leveragedToken.targetLeverage})`,
      })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .groupBy(sql`1`, sql`2`)
      .orderBy(sql`2 asc`);

    if (dailyUserVolumes.length === 0) return [];

    // Build map: day (seconds) -> Map<user, notionalVolume>
    const volumeByDayUser = new Map<number, Map<string, bigint>>();
    let minDay = Infinity;
    let maxDay = -Infinity;

    for (const row of dailyUserVolumes) {
      const day = Number(row.dayTimestamp);
      if (day < minDay) minDay = day;
      if (day > maxDay) maxDay = day;

      if (!volumeByDayUser.has(day)) volumeByDayUser.set(day, new Map());
      volumeByDayUser.get(day)!.set(row.recipient, BigInt(row.notionalVolume));
    }

    // Fetch current position values for users with non-zero balances
    const balances = await db
      .select({
        user: schema.balance.user,
        totalBalance: schema.balance.totalBalance,
        exchangeRate: schema.leveragedToken.exchangeRate,
      })
      .from(schema.balance)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.balance.leveragedToken, schema.leveragedToken.address)
      )
      .where(gt(schema.balance.totalBalance, 0n));

    // Aggregate position value per user
    const positionValueByUser = new Map<string, bigint>();
    for (const bal of balances) {
      const value = mul(bal.totalBalance, bal.exchangeRate);
      const current = positionValueByUser.get(bal.user) || 0n;
      positionValueByUser.set(bal.user, current + value);
    }

    // Identify users with current positions >= $500
    const usersWithLargePositions = new Set<string>();
    for (const [user, value] of positionValueByUser) {
      if (value >= POSITION_VALUE_THRESHOLD) {
        usersWithLargePositions.add(user);
      }
    }

    // Extend chart to today
    const nowSeconds = Math.floor(Date.now() / 1000);
    const today = nowSeconds - (nowSeconds % SECONDS_PER_DAY);
    const chartEnd = Math.max(maxDay, today);

    // Build chart with 7-day rolling window
    const chart: ActiveUsersChartPoint[] = [];

    for (let day = minDay; day <= chartEnd; day += SECONDS_PER_DAY) {
      const windowStart = day - 6 * SECONDS_PER_DAY;

      // Sum notional volume per user across the 7-day window
      const userVolumes = new Map<string, bigint>();
      for (let d = windowStart; d <= day; d += SECONDS_PER_DAY) {
        const dayMap = volumeByDayUser.get(d);
        if (!dayMap) continue;
        for (const [user, vol] of dayMap) {
          userVolumes.set(user, (userVolumes.get(user) || 0n) + vol);
        }
      }

      // Count users meeting the volume threshold
      const activeUserSet = new Set<string>();
      for (const [user, vol] of userVolumes) {
        if (vol >= NOTIONAL_VOLUME_THRESHOLD) {
          activeUserSet.add(user);
        }
      }

      // For the latest chart point, also include users with large current positions
      if (day === chartEnd) {
        for (const user of usersWithLargePositions) {
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
    throw new Error((error as Error).message);
    // throw new Error("Failed to fetch active users chart data");
  }
};

export default getActiveUsersChart;
