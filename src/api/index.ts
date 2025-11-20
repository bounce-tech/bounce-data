import { db, publicClients } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";
import { sql } from "drizzle-orm";
import { LT_HELPER_ADDRESS } from "../../ponder.config";
import { formatUnits } from "viem";
import { LeveragedTokenHelperAbi } from "../../abis/LeveragedTokenHelperAbi";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

app.get("/stats", async (c) => {
  // Querying database tables
  const tradeResult = await db
    .select({
      marginVolume: sql<string>`sum(${schema.trade.baseAssetAmount}) / 1000000`,
      notionalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * ${schema.leveragedToken.targetLeverage}) / 1000000000000000000000000`,
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
          1000000000000000000n
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
  return c.json({
    marginVolume: marginVolume,
    notionalVolume: notionalVolume,
    averageLeverage: averageLeverage,
    supportedAssets: uniqueAssets,
    leveragedTokens: leveragedTokens,
    uniqueUsers: uniqueUsers,
    totalValueLocked: tvl,
    openInterest: openInterest,
    totalTrades: totalTrades,
  });
});

export default app;
