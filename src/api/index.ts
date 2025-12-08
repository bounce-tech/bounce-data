import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { client, graphql } from "ponder";
import { isAddress } from "viem";
import getTradedLtsForUser from "./endpoints/traded-lts-for-user";
import getStats from "./endpoints/stats";

const app = new Hono();

// Enable CORS for all routes
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (origin === "http://localhost:5173") return origin;
      if (origin === "https://bounce.tech") return origin;
      if (origin && /^https:\/\/[^/]+\.web\.app$/.test(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

// Use Ponder client and graphql
app.use("/sql/*", client({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// Stats endpoint
app.get("/stats", async (c) => {
  const stats = await getStats();
  return c.json(stats);
});

// User traded LTs endpoint
app.get("/traded-lts", async (c) => {
  const user = c.req.query("user");
  if (!user) return c.json({ error: "Missing user parameter" }, 400);
  if (!isAddress(user)) return c.json({ error: "Invalid user address" }, 400);
  const tradedLts = await getTradedLtsForUser(user);
  return c.json({ tradedLts: tradedLts });
});

export default app;
