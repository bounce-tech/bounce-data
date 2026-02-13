import { db } from "ponder:api";
import schema from "ponder:schema";
import { asc, sql } from "drizzle-orm";
import bigIntToNumber from "../utils/big-int-to-number";

const SECONDS_PER_DAY = 86400;
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
        baseAssetAmount: schema.trade.baseAssetAmount,
        targetLeverage: schema.leveragedToken.targetLeverage,
      })
      .from(schema.trade)
      .leftJoin(
        schema.leveragedToken,
        sql`${schema.trade.leveragedToken} = ${schema.leveragedToken.address}`
      )
      .orderBy(asc(schema.trade.timestamp));

    const dailyTotals = new Map<number, bigint>();
    for (const trade of trades) {
      const ts = Number(trade.timestamp);
      const dayTimestamp = ts - (ts % SECONDS_PER_DAY);
      const leverage = trade.targetLeverage ?? LEVERAGE_DECIMALS;
      const notionalVolume = (trade.baseAssetAmount * leverage) / LEVERAGE_DECIMALS;
      dailyTotals.set(dayTimestamp, (dailyTotals.get(dayTimestamp) ?? 0n) + notionalVolume);
    }

    let cumulativeVolume = 0n;
    const chart: VolumeChartPoint[] = [];
    for (const day of Array.from(dailyTotals.keys()).sort((a, b) => a - b)) {
      cumulativeVolume += dailyTotals.get(day)!;
      chart.push({
        timestamp: day * 1000,
        cumulativeVolume: bigIntToNumber(cumulativeVolume, 6),
      });
    }

    return chart;
  } catch (error) {
    throw new Error("Failed to fetch volume chart data");
  }
};

export default getVolumeChart;
