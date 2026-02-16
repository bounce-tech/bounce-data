import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "http://localhost:42069";
const REQUEST_TIMEOUT = 30_000;
const MAX_REASONABLE_NUMBER = 1e15;
const MAX_REASONABLE_RAW_BIGINT = 1e30;

interface ApiResponse<T = unknown> {
  status: string;
  data: T;
  error: string | null;
}

const fetchEndpoint = async <T = unknown>(
  path: string
): Promise<ApiResponse<T>> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  expect(res.status).toBe(200);
  const json = (await res.json()) as ApiResponse<T>;
  return json;
};

const assertSuccessEnvelope = (json: ApiResponse) => {
  expect(json).toHaveProperty("status", "success");
  expect(json).toHaveProperty("data");
  expect(json).toHaveProperty("error", null);
};

const assertReasonableNumber = (value: number, label: string) => {
  expect(
    Math.abs(value) < MAX_REASONABLE_NUMBER,
    `${label} looks unreasonably large: ${value}`
  ).toBe(true);
  expect(Number.isFinite(value), `${label} is not finite: ${value}`).toBe(true);
};

const assertReasonableStringNumber = (value: string, label: string) => {
  const num = Number(value);
  expect(Number.isFinite(num), `${label} is not a finite number: ${value}`).toBe(
    true
  );
  expect(
    Math.abs(num) < MAX_REASONABLE_NUMBER,
    `${label} looks unreasonably large: ${value}`
  ).toBe(true);
};

const assertReasonableRawBigInt = (value: string, label: string) => {
  const num = Number(value);
  expect(Number.isFinite(num) || /^\d+$/.test(value), `${label} should be a valid number: ${value}`).toBe(
    true
  );
  if (Number.isFinite(num)) {
    expect(
      Math.abs(num) < MAX_REASONABLE_RAW_BIGINT,
      `${label} looks unreasonably large: ${value}`
    ).toBe(true);
  }
};

const assertValidAddress = (value: string, label: string) => {
  expect(value, `${label} should be a hex address`).toMatch(/^0x[0-9a-fA-F]{40}$/);
};

const assertValidTimestamp = (value: number, label: string) => {
  expect(value, `${label} should be positive`).toBeGreaterThan(0);
  assertReasonableNumber(value, label);
};

const KNOWN_USER_ADDRESS = "0xaDF6c30eDcf0665c2a43aC23317acaBB8FE3cABF";

let knownTokenSymbol: string | null = null;
let knownTxHash: string | null = null;
let knownReferralCode: string | null = null;

beforeAll(async () => {
  // Wait for the /ready endpoint to be available
  const maxWait = 300_000;
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${BASE_URL}/ready`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  expect(ready, "Server did not become ready within timeout").toBe(true);

  // Fetch a known leveraged token symbol from /leveraged-tokens
  try {
    const tokensRes = await fetchEndpoint<{ symbol: string }[]>(
      "/leveraged-tokens"
    );
    const firstToken = tokensRes.data?.[0];
    if (firstToken) {
      knownTokenSymbol = firstToken.symbol;
    }
  } catch {
    // will skip parameterized test
  }

  // Fetch a known txHash from /trades
  try {
    const tradesRes = await fetchEndpoint<{
      items: { txHash: string }[];
    }>("/trades?limit=1");
    const firstTrade = tradesRes.data?.items?.[0];
    if (firstTrade) {
      knownTxHash = firstTrade.txHash;
    }
  } catch {
    // will skip parameterized test
  }

  // Fetch a known referral code from /referrers
  try {
    const referrersRes = await fetchEndpoint<
      { referralCode: string | null }[]
    >("/referrers");
    const withCode = referrersRes.data?.find((r) => r.referralCode !== null);
    if (withCode) {
      knownReferralCode = withCode.referralCode;
    }
  } catch {
    // will skip parameterized test
  }
}, 360_000);

describe("GET /stats", () => {
  it("returns valid protocol statistics", async () => {
    const json = await fetchEndpoint<{
      marginVolume: number;
      notionalVolume: number;
      averageLeverage: number;
      supportedAssets: number;
      leveragedTokens: number;
      uniqueUsers: number;
      totalValueLocked: number;
      openInterest: number;
      totalTrades: number;
      treasuryFees: number;
    }>("/stats");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(data).toHaveProperty("marginVolume");
    expect(data).toHaveProperty("notionalVolume");
    expect(data).toHaveProperty("averageLeverage");
    expect(data).toHaveProperty("supportedAssets");
    expect(data).toHaveProperty("leveragedTokens");
    expect(data).toHaveProperty("uniqueUsers");
    expect(data).toHaveProperty("totalValueLocked");
    expect(data).toHaveProperty("openInterest");
    expect(data).toHaveProperty("totalTrades");
    expect(data).toHaveProperty("treasuryFees");

    // Numbers that should be positive
    expect(data.marginVolume).toBeGreaterThan(0);
    expect(data.notionalVolume).toBeGreaterThan(0);
    expect(data.averageLeverage).toBeGreaterThan(0);
    expect(data.supportedAssets).toBeGreaterThan(0);
    expect(data.leveragedTokens).toBeGreaterThan(0);
    expect(data.uniqueUsers).toBeGreaterThan(0);
    expect(data.totalValueLocked).toBeGreaterThan(0);
    expect(data.totalTrades).toBeGreaterThan(0);
    expect(data.treasuryFees).toBeGreaterThan(0);

    // Sanity ranges
    assertReasonableNumber(data.marginVolume, "marginVolume");
    assertReasonableNumber(data.notionalVolume, "notionalVolume");
    assertReasonableNumber(data.averageLeverage, "averageLeverage");
    assertReasonableNumber(data.totalValueLocked, "totalValueLocked");
    assertReasonableNumber(data.openInterest, "openInterest");
    assertReasonableNumber(data.treasuryFees, "treasuryFees");

    // Average leverage should be reasonable (1x to 20x)
    expect(data.averageLeverage).toBeGreaterThanOrEqual(1);
    expect(data.averageLeverage).toBeLessThanOrEqual(20);
  });
});

describe("GET /fee-chart", () => {
  it("returns valid cumulative fee chart data", async () => {
    const json = await fetchEndpoint<
      { timestamp: number; cumulativeFees: number }[]
    >("/fee-chart");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    for (const point of data) {
      expect(point).toHaveProperty("timestamp");
      expect(point).toHaveProperty("cumulativeFees");
      assertValidTimestamp(point.timestamp, "fee-chart timestamp");
      assertReasonableNumber(point.cumulativeFees, "cumulativeFees");
      expect(point.cumulativeFees).toBeGreaterThanOrEqual(0);
    }

    // Cumulative values should be non-decreasing
    for (let i = 1; i < data.length; i++) {
      expect(data[i]!.cumulativeFees).toBeGreaterThanOrEqual(
        data[i - 1]!.cumulativeFees
      );
      expect(data[i]!.timestamp).toBeGreaterThan(data[i - 1]!.timestamp);
    }
  });
});

describe("GET /volume-chart", () => {
  it("returns valid cumulative volume chart data", async () => {
    const json = await fetchEndpoint<
      { timestamp: number; cumulativeVolume: number }[]
    >("/volume-chart");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    for (const point of data) {
      expect(point).toHaveProperty("timestamp");
      expect(point).toHaveProperty("cumulativeVolume");
      assertValidTimestamp(point.timestamp, "volume-chart timestamp");
      assertReasonableNumber(point.cumulativeVolume, "cumulativeVolume");
      expect(point.cumulativeVolume).toBeGreaterThanOrEqual(0);
    }

    // Cumulative values should be non-decreasing
    for (let i = 1; i < data.length; i++) {
      expect(data[i]!.cumulativeVolume).toBeGreaterThanOrEqual(
        data[i - 1]!.cumulativeVolume
      );
      expect(data[i]!.timestamp).toBeGreaterThan(data[i - 1]!.timestamp);
    }
  });
});

describe("GET /active-users-chart", () => {
  it("returns valid active users chart data", async () => {
    const json = await fetchEndpoint<
      { timestamp: number; activeUsers: number }[]
    >("/active-users-chart");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    for (const point of data) {
      expect(point).toHaveProperty("timestamp");
      expect(point).toHaveProperty("activeUsers");
      assertValidTimestamp(point.timestamp, "active-users-chart timestamp");
      expect(Number.isInteger(point.activeUsers)).toBe(true);
      expect(point.activeUsers).toBeGreaterThanOrEqual(0);
    }

    // Timestamps should be increasing
    for (let i = 1; i < data.length; i++) {
      expect(data[i]!.timestamp).toBeGreaterThan(data[i - 1]!.timestamp);
    }
  });
});

describe("GET /global-storage", () => {
  it("returns valid global storage config", async () => {
    const json = await fetchEndpoint<{
      owner: string;
      allMintsPaused: boolean;
      minTransactionSize: string;
      minLockAmount: string;
      redemptionFee: string;
      executeRedemptionFee: string;
      streamingFee: string;
      treasuryFeeShare: string;
      referrerRebate: string;
      refereeRebate: string;
    }>("/global-storage");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(data).not.toBeNull();
    assertValidAddress(data.owner, "owner");
    expect(typeof data.allMintsPaused).toBe("boolean");

    // BigInt fields come as strings via serialization
    // These fields are raw BigInt values (in wei with 18 decimals), so they are naturally large
    const bigIntFields = [
      "minTransactionSize",
      "minLockAmount",
      "redemptionFee",
      "executeRedemptionFee",
      "streamingFee",
      "treasuryFeeShare",
      "referrerRebate",
      "refereeRebate",
    ] as const;

    for (const field of bigIntFields) {
      const val = data[field];
      expect(
        typeof val === "string" || typeof val === "number",
        `${field} should be a string or number, got ${typeof val}`
      ).toBe(true);
      assertReasonableRawBigInt(String(val), field);
    }
  });
});

describe("GET /leveraged-tokens", () => {
  it("returns a non-empty array of leveraged tokens", async () => {
    const json = await fetchEndpoint<
      {
        address: string;
        targetLeverage: number;
        isLong: boolean;
        symbol: string;
        name: string;
        decimals: number;
        targetAsset: string;
        mintPaused: boolean;
        exchangeRate: string;
        totalSupply: string;
        totalAssets: string;
      }[]
    >("/leveraged-tokens");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    for (const token of data) {
      assertValidAddress(token.address, "token address");
      expect(typeof token.symbol).toBe("string");
      expect(token.symbol.length).toBeGreaterThan(0);
      expect(typeof token.name).toBe("string");
      expect(token.name.length).toBeGreaterThan(0);
      expect(typeof token.isLong).toBe("boolean");
      expect(typeof token.mintPaused).toBe("boolean");
      expect(typeof token.targetAsset).toBe("string");
      expect(token.targetAsset.length).toBeGreaterThan(0);

      // targetLeverage should be a reasonable multiplier
      expect(token.targetLeverage).toBeGreaterThan(0);
      expect(token.targetLeverage).toBeLessThanOrEqual(20);

      expect(token.decimals).toBeGreaterThan(0);
      expect(token.decimals).toBeLessThanOrEqual(18);

      // These are raw on chain BigInt values, naturally large (18 decimal places)
      assertReasonableRawBigInt(String(token.exchangeRate), "exchangeRate");
      assertReasonableRawBigInt(String(token.totalSupply), "totalSupply");
      assertReasonableRawBigInt(String(token.totalAssets), "totalAssets");
    }
  });
});

describe("GET /leveraged-tokens/:symbol", () => {
  it("returns a single leveraged token by symbol", async () => {
    if (!knownTokenSymbol) {
      console.warn("No known token symbol available, skipping");
      return;
    }

    const json = await fetchEndpoint<{
      address: string;
      targetLeverage: number;
      isLong: boolean;
      symbol: string;
      name: string;
      decimals: number;
      targetAsset: string;
    }>(`/leveraged-tokens/${knownTokenSymbol}`);
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(data.symbol).toBe(knownTokenSymbol);
    assertValidAddress(data.address, "token address");
    expect(data.targetLeverage).toBeGreaterThan(0);
    expect(data.targetLeverage).toBeLessThanOrEqual(20);
  });

  it("returns 404 for a non-existent symbol", async () => {
    const res = await fetch(
      `${BASE_URL}/leveraged-tokens/NONEXISTENT_TOKEN_12345`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT) }
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as ApiResponse;
    expect(json.status).toBe("error");
    expect(json.data).toBeNull();
  });
});

describe("GET /trades", () => {
  it("returns paginated trades with correct format", async () => {
    const json = await fetchEndpoint<{
      items: {
        id: string;
        txHash: string;
        timestamp: string;
        isBuy: boolean;
        baseAssetAmount: string;
        leveragedTokenAmount: string;
        leveragedToken: string;
        sender: string;
        recipient: string;
        targetLeverage: number;
        isLong: boolean;
        targetAsset: string;
        profitAmount: number | null;
        profitPercent: number | null;
      }[];
      totalCount: number;
      page: number;
      totalPages: number;
    }>("/trades?limit=5");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("totalCount");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("totalPages");

    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.length).toBeLessThanOrEqual(5);
    expect(data.totalCount).toBeGreaterThan(0);
    expect(data.page).toBe(1);
    expect(data.totalPages).toBeGreaterThan(0);

    for (const trade of data.items) {
      expect(typeof trade.id).toBe("string");
      expect(trade.id.length).toBeGreaterThan(0);
      expect(typeof trade.txHash).toBe("string");
      expect(trade.txHash.length).toBeGreaterThan(0);
      expect(typeof trade.isBuy).toBe("boolean");
      assertValidAddress(trade.leveragedToken, "trade leveragedToken");
      assertValidAddress(trade.sender, "trade sender");
      assertValidAddress(trade.recipient, "trade recipient");
      expect(typeof trade.targetAsset).toBe("string");
      expect(typeof trade.isLong).toBe("boolean");

      expect(trade.targetLeverage).toBeGreaterThan(0);
      expect(trade.targetLeverage).toBeLessThanOrEqual(20);
      assertReasonableNumber(trade.targetLeverage, "trade targetLeverage");

      // These are raw on chain BigInt values (6 or 18 decimal places)
      assertReasonableRawBigInt(
        String(trade.baseAssetAmount),
        "baseAssetAmount"
      );
      assertReasonableRawBigInt(
        String(trade.leveragedTokenAmount),
        "leveragedTokenAmount"
      );

      // profitAmount and profitPercent can be null (for buys)
      if (trade.profitAmount !== null) {
        assertReasonableNumber(trade.profitAmount, "profitAmount");
      }
      if (trade.profitPercent !== null) {
        assertReasonableNumber(trade.profitPercent, "profitPercent");
      }
    }
  });

  it("supports pagination parameters", async () => {
    const page1 = await fetchEndpoint<{
      items: { id: string }[];
      page: number;
      totalPages: number;
    }>("/trades?page=1&limit=2");
    assertSuccessEnvelope(page1);
    expect(page1.data.page).toBe(1);
    expect(page1.data.items.length).toBeLessThanOrEqual(2);

    if (page1.data.totalPages > 1) {
      const page2 = await fetchEndpoint<{
        items: { id: string }[];
        page: number;
      }>("/trades?page=2&limit=2");
      assertSuccessEnvelope(page2);
      expect(page2.data.page).toBe(2);

      // Items should be different between pages
      const page1Ids = new Set(page1.data.items.map((i) => i.id));
      for (const item of page2.data.items) {
        expect(page1Ids.has(item.id)).toBe(false);
      }
    }
  });

  it("supports sort parameters", async () => {
    const json = await fetchEndpoint<{
      items: { baseAssetAmount: string }[];
    }>("/trades?limit=5&sortBy=nomVal&sortOrder=desc");
    assertSuccessEnvelope(json);
    expect(json.data.items.length).toBeGreaterThan(0);
  });

  it("returns error for invalid sort field", async () => {
    const res = await fetch(`${BASE_URL}/trades?sortBy=invalidField`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiResponse;
    expect(json.status).toBe("error");
  });
});

describe("GET /trades/:user", () => {
  it("returns trades filtered by user address", async () => {
    const json = await fetchEndpoint<{
      items: { recipient: string }[];
      totalCount: number;
    }>(`/trades/${KNOWN_USER_ADDRESS}?limit=5`);
    assertSuccessEnvelope(json);

    expect(json.data.items.length).toBeGreaterThan(0);
    for (const trade of json.data.items) {
      expect(trade.recipient.toLowerCase()).toBe(
        KNOWN_USER_ADDRESS.toLowerCase()
      );
    }
  });

  it("returns error for invalid address", async () => {
    const res = await fetch(`${BASE_URL}/trades/notanaddress`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiResponse;
    expect(json.status).toBe("error");
  });
});

describe("GET /users", () => {
  it("returns a non-empty array of user summaries", async () => {
    const json = await fetchEndpoint<
      {
        address: string;
        tradeCount: number;
        mintVolumeNominal: number;
        redeemVolumeNominal: number;
        totalVolumeNominal: number;
        mintVolumeNotional: number;
        redeemVolumeNotional: number;
        totalVolumeNotional: number;
        lastTradeTimestamp: number;
        realizedProfit: number;
        unrealizedProfit: number;
        totalProfit: number;
      }[]
    >("/users");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    for (const user of data) {
      assertValidAddress(user.address, "user address");
      expect(user.tradeCount).toBeGreaterThan(0);
      expect(Number.isInteger(user.tradeCount)).toBe(true);

      assertReasonableNumber(user.mintVolumeNominal, "mintVolumeNominal");
      assertReasonableNumber(user.redeemVolumeNominal, "redeemVolumeNominal");
      assertReasonableNumber(user.totalVolumeNominal, "totalVolumeNominal");
      assertReasonableNumber(user.mintVolumeNotional, "mintVolumeNotional");
      assertReasonableNumber(user.redeemVolumeNotional, "redeemVolumeNotional");
      assertReasonableNumber(user.totalVolumeNotional, "totalVolumeNotional");
      assertReasonableNumber(user.realizedProfit, "realizedProfit");
      assertReasonableNumber(user.unrealizedProfit, "unrealizedProfit");
      assertReasonableNumber(user.totalProfit, "totalProfit");

      expect(user.totalVolumeNominal).toBeGreaterThan(0);
      assertValidTimestamp(user.lastTradeTimestamp, "lastTradeTimestamp");
    }
  });
});

describe("GET /referrers", () => {
  it("returns an array of referrers", async () => {
    const json = await fetchEndpoint<
      {
        address: string;
        referralCode: string | null;
        referred: number;
        earned: string;
      }[]
    >("/referrers");
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(Array.isArray(data)).toBe(true);

    for (const ref of data) {
      assertValidAddress(ref.address, "referrer address");
      if (ref.referralCode !== null) {
        expect(typeof ref.referralCode).toBe("string");
        expect(ref.referralCode.length).toBeGreaterThan(0);
      }
      expect(typeof ref.referred).toBe("number");
      expect(ref.referred).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("GET /portfolio/:user", () => {
  it("returns a portfolio for a known user", async () => {
    const json = await fetchEndpoint<{
      unrealizedProfit: number;
      realizedProfit: number;
      leveragedTokens: {
        address: string;
        targetLeverage: number;
        symbol: string;
        userBalance: string;
        unrealizedProfit: number;
        unrealizedPercent: number;
      }[];
      pnlChart: { timestamp: number; value: number }[];
    }>(`/portfolio/${KNOWN_USER_ADDRESS}`);
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(data).toHaveProperty("unrealizedProfit");
    expect(data).toHaveProperty("realizedProfit");
    expect(data).toHaveProperty("leveragedTokens");
    expect(data).toHaveProperty("pnlChart");

    assertReasonableNumber(data.unrealizedProfit, "unrealizedProfit");
    assertReasonableNumber(data.realizedProfit, "realizedProfit");

    expect(Array.isArray(data.leveragedTokens)).toBe(true);
    for (const lt of data.leveragedTokens) {
      assertValidAddress(lt.address, "portfolio token address");
      expect(lt.targetLeverage).toBeGreaterThan(0);
      expect(lt.targetLeverage).toBeLessThanOrEqual(20);
      assertReasonableNumber(lt.unrealizedProfit, "lt unrealizedProfit");
      assertReasonableNumber(lt.unrealizedPercent, "lt unrealizedPercent");
    }

    expect(Array.isArray(data.pnlChart)).toBe(true);
    for (const point of data.pnlChart) {
      assertValidTimestamp(point.timestamp, "pnlChart timestamp");
      assertReasonableNumber(point.value, "pnlChart value");
    }
  });

  it("returns empty portfolio for unknown user", async () => {
    const json = await fetchEndpoint<{
      leveragedTokens: unknown[];
      pnlChart: unknown[];
    }>("/portfolio/0x0000000000000000000000000000000000000001");
    assertSuccessEnvelope(json);
    expect(json.data.leveragedTokens).toEqual([]);
    expect(json.data.pnlChart).toEqual([]);
  });

  it("returns error for invalid address", async () => {
    const res = await fetch(`${BASE_URL}/portfolio/notanaddress`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiResponse;
    expect(json.status).toBe("error");
  });
});

describe("GET /user-referrals/:user", () => {
  it("returns referral info for a known user", async () => {
    const json = await fetchEndpoint<{
      address: string;
      referralCode: string | null;
      referrerCode: string | null;
      referrerAddress: string | null;
      isJoined: boolean;
      referredUserCount: number;
      referrerRebates: number;
      refereeRebates: number;
      totalRebates: number;
      claimedRebates: number;
      claimableRebates: number;
    }>(`/user-referrals/${KNOWN_USER_ADDRESS}`);
    assertSuccessEnvelope(json);

    const data = json.data;
    expect(data.address.toLowerCase()).toBe(KNOWN_USER_ADDRESS.toLowerCase());
    expect(typeof data.isJoined).toBe("boolean");
    expect(typeof data.referredUserCount).toBe("number");
    expect(data.referredUserCount).toBeGreaterThanOrEqual(0);

    assertReasonableNumber(data.referrerRebates, "referrerRebates");
    assertReasonableNumber(data.refereeRebates, "refereeRebates");
    assertReasonableNumber(data.totalRebates, "totalRebates");
    assertReasonableNumber(data.claimedRebates, "claimedRebates");
    assertReasonableNumber(data.claimableRebates, "claimableRebates");

    // totalRebates should equal referrerRebates + refereeRebates (approximately)
    expect(data.totalRebates).toBeCloseTo(
      data.referrerRebates + data.refereeRebates,
      2
    );
    // claimableRebates should be totalRebates minus claimedRebates (approximately)
    expect(data.claimableRebates).toBeCloseTo(
      data.totalRebates - data.claimedRebates,
      2
    );
  });

  it("returns default values for unknown user", async () => {
    const json = await fetchEndpoint<{
      address: string;
      isJoined: boolean;
      referredUserCount: number;
    }>("/user-referrals/0x0000000000000000000000000000000000000001");
    assertSuccessEnvelope(json);
    expect(json.data.isJoined).toBe(false);
    expect(json.data.referredUserCount).toBe(0);
  });

  it("returns error for invalid address", async () => {
    const res = await fetch(`${BASE_URL}/user-referrals/badaddress`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiResponse;
    expect(json.status).toBe("error");
  });
});

describe("GET /is-valid-code/:code", () => {
  it("returns true for a valid referral code", async () => {
    if (!knownReferralCode) {
      console.warn("No known referral code available, skipping");
      return;
    }

    const json = await fetchEndpoint<boolean>(
      `/is-valid-code/${knownReferralCode}`
    );
    assertSuccessEnvelope(json);
    expect(json.data).toBe(true);
  });

  it("returns false for a non-existent referral code", async () => {
    const json = await fetchEndpoint<boolean>(
      "/is-valid-code/DEFINITELY_NOT_A_REAL_CODE_999"
    );
    assertSuccessEnvelope(json);
    expect(json.data).toBe(false);
  });
});

describe("GET /trade/:txHash", () => {
  it("returns a trade for a known txHash", async () => {
    if (!knownTxHash) {
      console.warn("No known txHash available, skipping");
      return;
    }

    const json = await fetchEndpoint<{
      id: string;
      txHash: string;
      isBuy: boolean;
      leveragedToken: string;
    } | null>(`/trade/${knownTxHash}`);
    assertSuccessEnvelope(json);

    if (json.data !== null) {
      expect(typeof json.data.id).toBe("string");
      expect(typeof json.data.isBuy).toBe("boolean");
      assertValidAddress(json.data.leveragedToken, "trade leveragedToken");
    }
  });

  it("returns null for non-existent txHash", async () => {
    const fakeTxHash =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const json = await fetchEndpoint<null>(`/trade/${fakeTxHash}`);
    assertSuccessEnvelope(json);
    expect(json.data).toBeNull();
  });

  it("returns error for invalid txHash format", async () => {
    const res = await fetch(`${BASE_URL}/trade/notahash`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiResponse;
    expect(json.status).toBe("error");
  });
});

describe("GET /health", () => {
  it("returns 200", async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /ready", () => {
  it("returns 200", async () => {
    const res = await fetch(`${BASE_URL}/ready`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    expect(res.status).toBe(200);
  });
});
