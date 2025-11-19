import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";
import { sql } from "drizzle-orm";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

app.get("/stats", async (c) => {
  const result = await db
    .select({
      marginVolume: sql<string>`sum(${schema.trade.baseAssetAmount} / 1000000)`,
      notionalVolume: sql<string>`sum(${schema.trade.baseAssetAmount} * (${schema.leveragedToken.targetLeverage} / 1000000000000000000000000))`,
    })
    .from(schema.trade)
    .leftJoin(
      schema.leveragedToken,
      sql`${schema.trade.leveragedToken} = ${schema.leveragedToken.address}`
    );

  const uniqueAssetsResult = await db
    .select({
      count: sql<number>`count(distinct ${schema.leveragedToken.marketId})`,
    })
    .from(schema.leveragedToken);

  const marginVolume = Number(result[0]?.marginVolume || 0);
  const notionalVolume = Number(result[0]?.notionalVolume || 0);
  const averageLeverage = notionalVolume / marginVolume;
  const uniqueAssets = uniqueAssetsResult[0]?.count || 0;

  return c.json({
    marginVolume: marginVolume,
    notionalVolume: notionalVolume,
    averageLeverage: averageLeverage,
    supportedAssets: uniqueAssets,
  });
});

export default app;
