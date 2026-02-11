import { Hono } from "hono";
import { cors } from "hono/cors";
import { Address, isAddress, isHex } from "viem";
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
import getReferrers from "./endpoints/get-referrers";
import getAllLeveragedTokens from "./endpoints/get-all-leveraged-tokens";
import getLeveragedToken from "./endpoints/get-leveraged-token";
import {
  validateOffsetPaginationParams,
  validateSortParams,
  SortField,
  SortOrder,
} from "./utils/validate";
import getPortfolio from "./endpoints/get-portfolio";
import getUserReferrals from "./endpoints/get-user-referrals";
import isValidCode from "./endpoints/is-valid-code";
import getTrade from "./endpoints/get-trade";

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

// Stats
app.get("/stats", async (c) => {
  try {
    const stats = await getStats();
    return c.json(formatSuccess(stats));
  } catch (error) {
    return c.json(formatError("Failed to fetch protocol statistics"), 500);
  }
});

// Portfolio
app.get("/portfolio/:user", async (c) => {
  try {
    const user = c.req.param("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const portfolio = await getPortfolio(user);
    return c.json(formatSuccess(portfolio));
  } catch (error) {
    return c.json(formatError("Failed to fetch portfolio"), 500);
  }
});

// User's trades
app.get("/user-trades", async (c) => {
  try {
    const user = c.req.query("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const asset = c.req.query("asset");
    const lt = c.req.query("leveragedTokenAddress");
    if (lt && !isAddress(lt)) return c.json(formatError("Invalid leveragedTokenAddress"), 400);
    const page = c.req.query("page");
    const limit = c.req.query("limit");
    const paginationError = validateOffsetPaginationParams(page, limit);
    if (paginationError) return c.json(formatError(paginationError), 400);

    // Sort params
    const sortBy = c.req.query("sortBy");
    const sortOrder = c.req.query("sortOrder");
    const sortError = validateSortParams(sortBy, sortOrder);
    if (sortError) return c.json(formatError(sortError), 400);

    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const trades = await getUsersTrades(
      user,
      asset,
      lt as Address | undefined,
      parsedPage ?? 1,
      parsedLimit ?? 100,
      {
        sortBy: sortBy as SortField | undefined,
        sortOrder: sortOrder as SortOrder | undefined,
      }
    );
    return c.json(formatSuccess(trades));
  } catch (error) {
    return c.json(formatError("Failed to fetch user trades"), 500);
  }
});

// User referrals
app.get("/user-referrals/:user", async (c) => {
  try {
    const user = c.req.param("user");
    if (!user) return c.json(formatError("Missing user parameter"), 400);
    if (!isAddress(user)) return c.json(formatError("Invalid user address"), 400);
    const referrals = await getUserReferrals(user);
    return c.json(formatSuccess(referrals));
  } catch (error) {
    return c.json(formatError("Failed to fetch user referrals"), 500);
  }
});

// Validate referral code
app.get("/is-valid-code/:code", async (c) => {
  try {
    const code = c.req.param("code");
    if (!code) return c.json(formatError("Missing code parameter"), 400);
    const valid = await isValidCode(code);
    return c.json(formatSuccess(valid));
  } catch (error) {
    return c.json(formatError("Failed to check referral code validity"), 500);
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

app.get("/trade/:txHash", async (c) => {
  try {
    const txHash = c.req.param("txHash");
    if (!txHash) return c.json(formatError("Missing txHash parameter"), 400);
    if (!isHex(txHash)) return c.json(formatError("Invalid txHash"), 400);
    const trade = await getTrade(txHash);
    if (!trade) return c.json(formatSuccess(null));
    return c.json(formatSuccess(trade));
  } catch (error) {
    return c.json(formatError("Failed to fetch trade"), 500);
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

// Referrers endpoint
app.get("/referrers", async (c) => {
  try {
    const referrers = await getReferrers();
    return c.json(formatSuccess(referrers));
  } catch (error) {
    return c.json(formatError("Failed to fetch referrers"), 500);
  }
});

// All leveraged tokens endpoint
app.get("/leveraged-tokens", async (c) => {
  try {
    const leveragedTokens = await getAllLeveragedTokens();
    return c.json(formatSuccess(leveragedTokens));
  } catch (error) {
    return c.json(formatError("Failed to fetch leveraged tokens"), 500);
  }
});

// Single leveraged token endpoint
app.get("/leveraged-tokens/:symbol", async (c) => {
  try {
    const symbol = c.req.param("symbol");
    if (!symbol) return c.json(formatError("Missing symbol parameter"), 400);
    const leveragedToken = await getLeveragedToken(symbol);
    if (!leveragedToken) return c.json(formatError("Leveraged token not found"), 404);
    return c.json(formatSuccess(leveragedToken));
  } catch (error) {
    return c.json(formatError("Failed to fetch leveraged token by symbol"), 500);
  }
});

// User PnL endpoint (deprecated, will remove in the future)
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

// User's total referrals (deprecated, use /user-referrals/:user instead, will remove in the future)
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

// User total rebates (deprecated, use /user-referrals/:user instead, will remove in the future)
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


export default app;

