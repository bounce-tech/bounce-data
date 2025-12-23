import { db } from "ponder:api";
import schema from "ponder:schema";
import { sql } from "drizzle-orm";
import { formatUnits } from "viem";
import getLeveragedTokenData, {
  LeveragedTokenData,
} from "../utils/leveraged-token-data";

const BASE_ASSET_DECIMALS = BigInt(1e6);
const LEVERAGE_DECIMALS = BigInt(1e18);

const getStats = async () => {
  // Querying database tables
  const tradeResult = await db
    .select({
      marginVolume: sql<string>`sum(${schema.trade.baseAssetAmount}) / ${BASE_ASSET_DECIMALS}`,
      notionalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * ${
        schema.leveragedToken.targetLeverage
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
      leveragedTokens: sql<number>`count(*)`,
      treasuryFees: sql<string>`sum(${schema.fee.amount}) / ${BASE_ASSET_DECIMALS}`,
    })
    .from(schema.leveragedToken)
    .leftJoin(
      schema.fee,
      sql`${schema.fee.leveragedToken} = ${schema.leveragedToken.address} and ${schema.fee.destination} = 'treasury'`
    );

  // Querying leveraged token contracts
  const leveragedTokenData = await getLeveragedTokenData();

  // Calculating total value locked and open interest
  const tvlBn = leveragedTokenData.reduce(
    (acc: bigint, token: LeveragedTokenData) => {
      return acc + token.totalAssets;
    },
    0n
  );
  const tvl = Number(formatUnits(tvlBn, 6));
  const openInterestBn = leveragedTokenData.reduce(
    (acc: bigint, token: LeveragedTokenData) => {
      return (
        acc +
        (token.totalAssets * BigInt(token.targetLeverage)) / LEVERAGE_DECIMALS
      );
    },
    0n
  );
  const openInterest = Number(formatUnits(openInterestBn, 6));

  // Formatting results
  const marginVolume = Number(tradeResult[0]?.marginVolume || 0);
  const notionalVolume = Number(tradeResult[0]?.notionalVolume || 0);
  const averageLeverage = marginVolume > 0 ? notionalVolume / marginVolume : 0;
  const uniqueAssets = leveragedTokenResult[0]?.supportedAssets || 0;
  const leveragedTokens = leveragedTokenResult[0]?.leveragedTokens || 0;
  const uniqueUsers = tradeResult[0]?.uniqueUsers || 0;
  const totalTrades = tradeResult[0]?.totalTrades || 0;
  const treasuryFees = Number(leveragedTokenResult[0]?.treasuryFees || 0);

  // Returning results
  return {
    marginVolume: marginVolume,
    notionalVolume: notionalVolume,
    averageLeverage: averageLeverage,
    supportedAssets: uniqueAssets,
    leveragedTokens: leveragedTokens,
    uniqueUsers: uniqueUsers,
    totalValueLocked: tvl,
    openInterest: openInterest,
    totalTrades: totalTrades,
    treasuryFees: treasuryFees,
  };
};

export default getStats;
