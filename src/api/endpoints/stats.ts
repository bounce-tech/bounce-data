import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, sql } from "drizzle-orm";

const BASE_ASSET_DECIMALS = BigInt(1e6);
const LEVERAGE_DECIMALS = BigInt(1e18);

const getStats = async () => {
  try {
    // Querying database tables
    const tradeResult = await db
      .select({
        marginVolume: sql<string>`sum(${schema.trade.baseAssetAmount}) / ${BASE_ASSET_DECIMALS}`,
        notionalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * ${schema.leveragedToken.targetLeverage
          }) / (${LEVERAGE_DECIMALS * BASE_ASSET_DECIMALS})`,
        uniqueUsers: sql<number>`count(distinct ${schema.trade.recipient})`,
        totalTrades: sql<number>`count(*)`,
      })
      .from(schema.trade)
      .leftJoin(
        schema.leveragedToken,
        sql`${schema.trade.leveragedToken} = ${schema.leveragedToken.address}`
      );
    const leveragedTokenResult = await db
      .select({
        supportedAssets: sql<number>`count(distinct ${schema.leveragedToken.marketId})`,
        leveragedTokens: sql<number>`count(distinct ${schema.leveragedToken.address})`,
        totalAssets: sql<string>`sum((${schema.leveragedToken.totalSupply} * ${schema.leveragedToken.exchangeRate}) / ${LEVERAGE_DECIMALS}) / ${LEVERAGE_DECIMALS}`,
        openInterest: sql<string>`sum((((${schema.leveragedToken.totalSupply} * ${schema.leveragedToken.exchangeRate}) / ${LEVERAGE_DECIMALS}) * ${schema.leveragedToken.targetLeverage}) / ${LEVERAGE_DECIMALS}) / ${LEVERAGE_DECIMALS}`,
      })
      .from(schema.leveragedToken);
    const feesResult = await db
      .select({
        totalFees: sql<string>`sum(${schema.fee.amount}) / ${BASE_ASSET_DECIMALS}`,
      })
      .from(schema.fee);

    // Formatting results
    const totalValueLocked = Number(leveragedTokenResult[0]?.totalAssets || 0);
    const openInterest = Number(leveragedTokenResult[0]?.openInterest || 0);
    const marginVolume = Number(tradeResult[0]?.marginVolume || 0);
    const notionalVolume = Number(tradeResult[0]?.notionalVolume || 0);
    const averageLeverage = marginVolume > 0 ? notionalVolume / marginVolume : 0;
    const uniqueAssets = leveragedTokenResult[0]?.supportedAssets || 0;
    const leveragedTokens = leveragedTokenResult[0]?.leveragedTokens || 0;
    const uniqueUsers = tradeResult[0]?.uniqueUsers || 0;
    const totalTrades = tradeResult[0]?.totalTrades || 0;
    const treasuryFees = Number(feesResult[0]?.totalFees || 0);

    // Returning results
    return {
      marginVolume: marginVolume,
      notionalVolume: notionalVolume,
      averageLeverage: averageLeverage,
      supportedAssets: uniqueAssets,
      leveragedTokens: leveragedTokens,
      uniqueUsers: uniqueUsers,
      totalValueLocked: totalValueLocked,
      openInterest: openInterest,
      totalTrades: totalTrades,
      treasuryFees: treasuryFees,
    };
  } catch (error) {
    throw new Error("Failed to fetch protocol statistics");
  }
};

export default getStats;
