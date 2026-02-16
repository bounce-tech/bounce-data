import { db } from "ponder:api";
import schema from "ponder:schema";
import { sql } from "drizzle-orm";
import bigIntToNumber from "../utils/big-int-to-number";

const SECONDS_PER_DAY = 86400;

interface FeeChartPoint {
  timestamp: number;
  cumulativeFees: number;
}

const getFeeChart = async (): Promise<FeeChartPoint[]> => {
  try {
    const dailyFees = await db
      .select({
        dayTimestamp: sql<string>`(${schema.fee.timestamp} - (${schema.fee.timestamp} % ${SECONDS_PER_DAY}))`,
        totalAmount: sql<string>`sum(${schema.fee.amount})`,
      })
      .from(schema.fee)
      .groupBy(sql`1`)
      .orderBy(sql`1 asc`);

    // Build cumulative chart from pre-aggregated daily totals
    let cumulativeFees = 0n;
    const chart: FeeChartPoint[] = [];
    for (const day of dailyFees) {
      cumulativeFees += BigInt(day.totalAmount);
      chart.push({
        timestamp: Number(day.dayTimestamp) * 1000,
        cumulativeFees: bigIntToNumber(cumulativeFees, 6),
      });
    }

    return chart;
  } catch (error) {
    throw new Error("Failed to fetch fee chart data");
  }
};

export default getFeeChart;
