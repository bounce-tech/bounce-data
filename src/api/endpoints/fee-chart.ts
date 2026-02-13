import { db } from "ponder:api";
import schema from "ponder:schema";
import { asc } from "drizzle-orm";
import bigIntToNumber from "../utils/big-int-to-number";

const SECONDS_PER_DAY = 86400;

interface FeeChartPoint {
  timestamp: number;
  cumulativeFees: number;
}

const getFeeChart = async (): Promise<FeeChartPoint[]> => {
  try {
    const fees = await db
      .select({
        timestamp: schema.fee.timestamp,
        amount: schema.fee.amount,
      })
      .from(schema.fee)
      .orderBy(asc(schema.fee.timestamp));

    // Aggregate fees by day
    const dailyTotals = new Map<number, bigint>();
    for (const fee of fees) {
      const dayTimestamp =
        Number(fee.timestamp) -
        (Number(fee.timestamp) % SECONDS_PER_DAY);
      const existing = dailyTotals.get(dayTimestamp) ?? 0n;
      dailyTotals.set(dayTimestamp, existing + fee.amount);
    }

    // Build cumulative chart
    let cumulativeFees = 0n;
    const chart: FeeChartPoint[] = [];
    const sortedDays = Array.from(dailyTotals.keys()).sort((a, b) => a - b);
    for (const day of sortedDays) {
      cumulativeFees += dailyTotals.get(day)!;
      chart.push({
        timestamp: day * 1000,
        cumulativeFees: bigIntToNumber(cumulativeFees, 6),
      });
    }

    return chart;
  } catch (error) {
    throw new Error("Failed to fetch fee chart data");
  }
};

export default getFeeChart;
