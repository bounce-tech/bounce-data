import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, sql } from "drizzle-orm";
import bigIntToNumber from "../utils/big-int-to-number";

const SECONDS_PER_DAY = 86400;

interface VolumeChartPoint {
  timestamp: number;
  cumulativeVolume: number;
}

const getVolumeChart = async (): Promise<VolumeChartPoint[]> => {
  try {
    const dailyVolumes = await db
      .select({
        dayTimestamp: sql<string>`(${schema.trade.timestamp} - (${schema.trade.timestamp} % ${SECONDS_PER_DAY}))`,
        totalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * ${schema.leveragedToken.targetLeverage})`,
      })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .groupBy(sql`1`)
      .orderBy(sql`1 asc`);

    let cumulativeVolume = 0n;
    const chart: VolumeChartPoint[] = [];
    for (const day of dailyVolumes) {
      cumulativeVolume += BigInt(day.totalVolume);
      chart.push({
        timestamp: Number(day.dayTimestamp) * 1000,
        cumulativeVolume: bigIntToNumber(cumulativeVolume, 24),
      });
    }

    return chart;
  } catch (error) {
    throw new Error("Failed to fetch volume chart data");
  }
};

export default getVolumeChart;
