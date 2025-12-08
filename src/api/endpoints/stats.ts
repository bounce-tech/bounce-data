import { db, publicClients } from "ponder:api";
import schema from "ponder:schema";
import { sql } from "drizzle-orm";
import { LT_HELPER_ADDRESS } from "../../../ponder.config";
import { LeveragedTokenHelperAbi } from "../../../abis/LeveragedTokenHelperAbi";
import { formatUnits } from "viem";

// Base asset has 6 decimals (USDC)
const BASE_ASSET_DECIMALS = 1e6;

// Leverage is stored with 18 decimals, total scaling factor for notional volume calculation
const NOTIONAL_VOLUME_SCALE = 1e24; // 1e6 * 1e18

// Leverage precision factor
const LEVERAGE_DECIMALS = 1e18;

const getStats = async () => {
  // Querying database tables
  const tradeResult = await db
    .select({
      marginVolume: sql<string>`sum(${schema.trade.baseAssetAmount}) / ${BASE_ASSET_DECIMALS}`,
      notionalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * ${schema.leveragedToken.targetLeverage}) / ${NOTIONAL_VOLUME_SCALE}`,
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
    })
    .from(schema.leveragedToken);

  // Querying leveraged token contracts
  const leveragedTokenContracts = (await publicClients["hyperEvm"].readContract(
    {
      abi: LeveragedTokenHelperAbi,
      address: LT_HELPER_ADDRESS,
      functionName: "getLeveragedTokens",
    }
  )) as any[];

  // Calculating total value locked and open interest
  const tvlBn = leveragedTokenContracts.reduce((acc: bigint, token: any) => {
    return acc + token.totalAssets;
  }, 0n);
  const tvl = Number(formatUnits(tvlBn, 6));
  const openInterestBn = leveragedTokenContracts.reduce(
    (acc: bigint, token: any) => {
      return (
        acc +
        (token.totalAssets * BigInt(token.targetLeverage)) /
          BigInt(LEVERAGE_DECIMALS)
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
  };
};

export default getStats;
