import { describe, it, expect } from "vitest";
import { zeroAddress, type Address } from "viem";

// Importing the handler module for its side effects registers every
// `ponder.on(...)` handler into our mocked `ponder:registry`.
import "../../src/LeveragedToken";
import { getHandler } from "../../src/mocks/ponder-registry";

// ---------------------------------------------------------------------------
// In-memory database that mimics the slice of the Ponder `context.db` API used
// by the handlers: insert().values().onConflictDoUpdate()/onConflictDoNothing(),
// find(), update().set(), delete(). Tables are keyed by name (see the
// ponder:schema mock).
// ---------------------------------------------------------------------------

const KEY_FIELDS: Record<string, string[]> = {
  balance: ["user", "leveragedToken"],
  pendingRedemption: ["user", "leveragedToken"],
  user: ["address"],
  leveragedToken: ["address"],
  trade: ["id"],
  fee: ["id"],
};

const DEFAULTS: Record<string, Record<string, unknown>> = {
  balance: {
    liquidBalance: 0n,
    creditBalance: 0n,
    totalBalance: 0n,
    purchaseCost: 0n,
    realizedProfit: 0n,
  },
  user: {
    referralCode: null,
    referrerCode: null,
    referrerAddress: null,
    referredUserCount: 0,
    totalRebates: 0n,
    referrerRebates: 0n,
    refereeRebates: 0n,
    claimedRebates: 0n,
    tradeCount: 0,
    mintVolumeNominal: 0n,
    redeemVolumeNominal: 0n,
    totalVolumeNominal: 0n,
    mintVolumeNotional: 0n,
    redeemVolumeNotional: 0n,
    totalVolumeNotional: 0n,
    lastTradeTimestamp: 0n,
    realizedProfit: 0n,
  },
};

function createDb() {
  const tables: Record<string, Map<string, any>> = {};
  const getTable = (t: string) => (tables[t] ??= new Map());
  const keyOf = (t: string, obj: any) =>
    JSON.stringify((KEY_FIELDS[t] ?? Object.keys(obj)).map((f) => String(obj[f])));

  const create = (t: string, vals: any) => ({ ...(DEFAULTS[t] ?? {}), ...vals });

  return {
    _tables: tables,
    rows(t: string): any[] {
      return [...getTable(t).values()];
    },
    async find(t: string, key: any) {
      return getTable(t).get(keyOf(t, key)) ?? null;
    },
    insert(t: string) {
      return {
        values(vals: any) {
          const tbl = getTable(t);
          const k = keyOf(t, vals);
          // Mirrors Ponder/drizzle: `.values()` is itself awaitable and inserts
          // immediately; `.onConflictDoUpdate`/`.onConflictDoNothing` are
          // optional modifiers that change the conflict behaviour.
          return {
            async onConflictDoUpdate(updater: (row: any) => any) {
              const existing = tbl.get(k);
              if (existing) tbl.set(k, { ...existing, ...updater(existing) });
              else tbl.set(k, create(t, vals));
            },
            async onConflictDoNothing() {
              if (!tbl.has(k)) tbl.set(k, create(t, vals));
            },
            then(resolve: (v?: unknown) => void, reject: (e: unknown) => void) {
              try {
                tbl.set(k, create(t, vals));
                resolve(undefined);
              } catch (e) {
                reject(e);
              }
            },
          };
        },
      };
    },
    update(t: string, key: any) {
      return {
        async set(updater: any) {
          const tbl = getTable(t);
          const k = keyOf(t, key);
          const existing = tbl.get(k);
          if (!existing) throw new Error(`update: ${t} row not found`);
          const patch = typeof updater === "function" ? updater(existing) : updater;
          tbl.set(k, { ...existing, ...patch });
        },
      };
    },
    async delete(t: string, key: any) {
      getTable(t).delete(keyOf(t, key));
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario harness: drives the real Mint / Redeem / PrepareRedeem /
// ExecuteRedeem / Transfer handlers in realistic event order.
// ---------------------------------------------------------------------------

const USER = "0x1111111111111111111111111111111111111111" as Address;
const LT = "0x2222222222222222222222222222222222222222" as Address;
const TARGET_LEVERAGE = 3n * 10n ** 18n;
const TOKEN = 10n ** 18n; // leveraged tokens use 18 decimals
const USDC = 10n ** 6n; // base asset (USDC) uses 6 decimals

function createHarness() {
  const db = createDb();

  // Seed the leveraged token so ensureLeveragedToken() short-circuits and
  // never needs on-chain reads.
  db._tables.leveragedToken = new Map();
  db._tables.leveragedToken.set(JSON.stringify([LT]), {
    address: LT,
    creator: zeroAddress,
    marketId: 0,
    targetLeverage: TARGET_LEVERAGE,
    isLong: false,
    symbol: "HYPE5S",
    name: "HYPE 5x Short",
    decimals: 18,
    mintPaused: false,
    targetAsset: "HYPE",
    exchangeRate: 0n,
    totalSupply: 0n,
    latestBridgeToEvmBlock: 0n,
  });

  const context = {
    db,
    client: {
      readContract: async () => {
        throw new Error("readContract should not be called in this test");
      },
    },
    contracts: { LeveragedToken: { abi: [] } },
  };

  let nonce = 0;
  const event = (args: any, txHash?: string) => ({
    args,
    log: { address: LT },
    block: { timestamp: BigInt(1_000 + nonce), number: BigInt(nonce++) },
    transaction: { hash: txHash ?? `0x${(nonce + 1).toString(16).padStart(64, "0")}` },
  });

  const fire = (name: string, args: any, txHash?: string) =>
    getHandler(name)({ event: event(args, txHash), context });

  const transfer = (from: Address, to: Address, value: bigint) =>
    fire("LeveragedToken:Transfer", { from, to, value });

  return {
    db,
    async mint(baseAmount: bigint, ltAmount: bigint) {
      await transfer(zeroAddress, USER, ltAmount);
      await fire("LeveragedToken:Mint", {
        minter: USER,
        to: USER,
        baseAmount,
        ltAmount,
      });
    },
    async redeemInstant(ltAmount: bigint, baseAmount: bigint) {
      await transfer(USER, zeroAddress, ltAmount);
      await fire("LeveragedToken:Redeem", {
        sender: USER,
        to: USER,
        ltAmount,
        baseAmount,
      });
    },
    async prepareRedeem(ltAmount: bigint) {
      // User escrows leveraged tokens into the contract.
      await transfer(USER, LT, ltAmount);
      await fire("LeveragedToken:PrepareRedeem", { sender: USER, ltAmount }, "0xprepare");
    },
    async executeRedeem(ltAmount: bigint, baseAmount: bigint) {
      // Contract burns the escrowed tokens, then settles.
      await transfer(LT, zeroAddress, ltAmount);
      await fire("LeveragedToken:ExecuteRedeem", { user: USER, ltAmount, baseAmount });
    },
    async balance() {
      return db.find("balance", { user: USER, leveragedToken: LT });
    },
    redeemTrade() {
      return db.rows("trade").find((t) => t.isBuy === false);
    },
  };
}

const usd = (n: number | bigint) => BigInt(n) * USDC; // dollars -> 6dp

describe("cost basis after partial redeem (PnL bug)", () => {
  // -------------------------------------------------------------------------
  // CASE 1 — single mint, then a partial redeem.
  //
  // Because there is only one entry lot, the remaining cost basis is
  // unambiguous: it does not depend on FIFO vs average-cost. Mint $110,000 for
  // 20B tokens (entry price $5.5/1k tokens), then redeem half (10B tokens) for
  // $70,000.
  //
  //   Correct remaining basis  = 110,000 * 10/20 = $55,000
  //   Correct realized profit  = 70,000 - 55,000 = +$15,000
  // -------------------------------------------------------------------------
  it("single-lot partial redeem leaves the correct remaining basis and realized profit", async () => {
    const h = createHarness();
    await h.mint(usd(110_000), 20_000_000_000n * TOKEN);
    await h.redeemInstant(10_000_000_000n * TOKEN, usd(70_000));

    const balance = await h.balance();
    const trade = h.redeemTrade();

    expect(balance.purchaseCost).toBe(usd(55_000));
    expect(trade.profitAmount).toBe(usd(15_000));
  });

  // -------------------------------------------------------------------------
  // CASE 2 — reproduces the reported HYPE5S position to the dollar.
  //
  //   mint  $207,167  -> 14.713B tokens
  //   mint  $212,816  -> 15.454B tokens
  //   redeem $208,657 <- 15.167B tokens  (15.0B left open)
  //
  // Total paid = $419,983. Valid remaining-basis conventions:
  //   FIFO         ≈ $206,565
  //   average-cost ≈ $208,830
  // The reported UI basis of $195,000 sits BELOW every valid convention.
  // -------------------------------------------------------------------------
  it("multi-lot partial redeem keeps remaining basis within a valid convention", async () => {
    const h = createHarness();
    await h.mint(usd(207_167), 14_713_000_000n * TOKEN);
    await h.mint(usd(212_816), 15_454_000_000n * TOKEN);
    await h.redeemInstant(15_167_000_000n * TOKEN, usd(208_657));

    const balance = await h.balance();

    // Average-cost basis computed at full precision (what the handler intends).
    const totalCost = usd(419_983);
    const remaining = 15_000_000_000n * TOKEN;
    const totalTokens = (14_713_000_000n + 15_454_000_000n) * TOKEN;
    const avgCostBasis = (totalCost * remaining) / totalTokens;
    // FIFO basis: the 15.0B left all come from the second lot.
    const fifoBasis = (usd(212_816) * remaining) / (15_454_000_000n * TOKEN);

    // This PR implements the average-cost convention, so pin the exact basis
    // and sanity-check it stays above the FIFO floor (and far above the
    // buggy $195,000 the truncation produced).
    expect(balance.purchaseCost).toBe(avgCostBasis);
    expect(balance.purchaseCost > fifoBasis).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CASE 3 — same single-lot scenario as CASE 1, but via the two-step
  // PrepareRedeem -> ExecuteRedeem flow (the path real redemptions take).
  // Proves the bug is not specific to the instant Redeem handler.
  // -------------------------------------------------------------------------
  it("two-step (prepare/execute) partial redeem leaves the correct remaining basis", async () => {
    const h = createHarness();
    await h.mint(usd(110_000), 20_000_000_000n * TOKEN);
    await h.prepareRedeem(10_000_000_000n * TOKEN);
    await h.executeRedeem(10_000_000_000n * TOKEN, usd(70_000));

    const balance = await h.balance();

    expect(balance.purchaseCost).toBe(usd(55_000));
  });
});
