import { db } from "ponder:api";
import schema from "ponder:schema";
import { asc, eq, sql } from "drizzle-orm";

const SECONDS_PER_DAY = 86400;
const BASE_ASSET_DECIMALS = BigInt(1e6);
const LEVERAGE_DECIMALS = BigInt(1e18);

interface VolumeChartPoint {
  timestamp: number;
  cumulativeVolume: number;
}

const getVolumeChart = async (): Promise<VolumeChartPoint[]> => {
  try {
    const trades = await db
      .select({
        timestamp: schema.trade.timestamp,
        notionalVolume: sql<string>`${schema.trade.baseAssetAmount} * ${schema.leveragedToken.targetLeverage
          } / (${LEVERAGE_DECIMALS * BASE_ASSET_DECIMALS})`,
      })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .orderBy(asc(schema.trade.timestamp));

    const dailyTotals = new Map<number, number>();
    for (const trade of trades) {
      const ts = Number(trade.timestamp);
      const dayTimestamp = ts - (ts % SECONDS_PER_DAY);
      dailyTotals.set(dayTimestamp, (dailyTotals.get(dayTimestamp) ?? 0) + Number(trade.notionalVolume));
    }

    let cumulativeVolume = 0;
    const chart: VolumeChartPoint[] = [];
    for (const day of Array.from(dailyTotals.keys()).sort((a, b) => a - b)) {
      cumulativeVolume += dailyTotals.get(day)!;
      chart.push({
        timestamp: day * 1000,
        cumulativeVolume,
      });
    }

    return chart;
  } catch (error) {
    throw new Error("Failed to fetch volume chart data");
  }
};

export default getVolumeChart;
