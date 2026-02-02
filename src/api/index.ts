import { Hono } from "hono";
import { cors } from "hono/cors";
import { Address, isAddress } from "viem";
import getTradedLtsForUser from "./endpoints/traded-lts-for-user";
import getStats from "./endpoints/stats";
import formatError from "./utils/format-error";
import formatSuccess from "./utils/format-success";
import getPnlForUser from "./endpoints/pnl-for-user";
import getUsersTrades from "./endpoints/users-trades";
import { bigIntSerializationMiddleware } from "./utils/serialize-bigint";
import getTotalRebatesForUser from "./endpoints/total-rebates-for-user";
import getTotalReferralsForUser from "./endpoints/total-referrals-for-user";
import getLatestTrades from "./endpoints/latest-trades";
import getAllUsers from "./endpoints/get-all-users";
import getUser from "./endpoints/get-user";
import getReferrers from "./endpoints/get-referrers";

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

// Global BigInt serialization middleware
app.use("*", bigIntSerializationMiddleware);

// Stats endpoint
app.get("/stats", async (c) => {
  try {
    const stats = await getStats();
    return c.json(formatSuccess(stats));
  } catch (error) {
    return c.json(formatError("Failed to fetch protocol statistics"), 500);
  }
});

// User traded LTs endpoint
app.get("/traded-lts", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const tradedLts = await getTradedLtsForUser(user);
    return c.json(formatSuccess(tradedLts));
  } catch (error) {
    return c.json(formatError("Failed to fetch traded leveraged tokens"), 500);
  }
});

// User's trades (new endpoint)
app.get("/user-trades", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const asset = c.req.query("asset");
    const lt = c.req.query("leveragedTokenAddress");
    if (lt && !isAddress(lt)) return c.json(formatError("Invalid lt"), 400);
    const trades = await getUsersTrades(user, asset, lt as Address | undefined);
    return c.json(formatSuccess(trades));
  } catch (error) {
    return c.json(formatError("Failed to fetch user trades"), 500);
  }
});

// User's trades (legacy endpoint - kept for backward compatibility, will remove in the future)
app.get("/users-trades", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const asset = c.req.query("asset");
    const lt = c.req.query("leveragedTokenAddress");
    if (lt && !isAddress(lt)) return c.json(formatError("Invalid lt"), 400);
    const trades = await getUsersTrades(user, asset, lt as Address | undefined);
    return c.json(formatSuccess(trades));
  } catch (error) {
    return c.json(formatError("Failed to fetch user trades"), 500);
  }
});

// User PnL endpoint
app.get("/user-pnl", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const pnl = await getPnlForUser(user);
    return c.json(formatSuccess(pnl));
  } catch (error) {
    return c.json(formatError("Failed to fetch profit and loss data"), 500);
  }
});

// User total rebates
app.get("/total-rebates", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const totalRebates = await getTotalRebatesForUser(user);
    return c.json(formatSuccess(totalRebates));
  } catch (error) {
    return c.json(formatError("Failed to fetch total rebates"), 500);
  }
});

// User's total referrals
app.get("/total-referrals", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const totalReferrals = await getTotalReferralsForUser(user);
    return c.json(formatSuccess(totalReferrals));
  } catch (error) {
    return c.json(formatError("Failed to fetch total referrals"), 500);
  }
});

// Latest trades endpoint
app.get("/latest-trades", async (c) => {
  try {
    const trades = await getLatestTrades();
    return c.json(formatSuccess(trades));
  } catch (error) {
    return c.json(formatError("Failed to fetch latest trades"), 500);
  }
});

// All users endpoint
app.get("/users", async (c) => {
  try {
    const users = await getAllUsers();
    return c.json(formatSuccess(users));
  } catch (error) {
    return c.json(formatError("Failed to fetch all users"), 500);
  }
});

// Single user endpoint
app.get("/user", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const userData = await getUser(user);
    if (!userData) return c.json(formatError("User not found"), 404);
    return c.json(formatSuccess(userData));
  } catch (error) {
    return c.json(formatError("Failed to fetch user"), 500);
  }
});

// Referrers endpoint
app.get("/referrers", async (c) => {
  try {
    const referrers = await getReferrers();
    return c.json(formatSuccess(referrers));
  } catch (error) {
    return c.json(formatError("Failed to fetch referrers"), 500);
  }
});

export default app;
