import { describe, it, expect, beforeEach } from "vitest";
import { zeroAddress, type Address } from "viem";
import { FACTORY_ADDRESS } from "@bouncetech/contracts";

// Importing the handler module for its side effects registers every
// `ponder.on(...)` handler into our mocked `ponder:registry`.
import "../../src/LeveragedToken";
import { getHandler } from "../../src/mocks/ponder-registry";

// ---------------------------------------------------------------------------
// Minimal in-memory database mirroring the slice of the Ponder `context.db`
// API the Transfer handler uses: insert().values().onConflictDoUpdate(),
// find(), update().set(). Tables are keyed by name (see the ponder:schema mock).
// ---------------------------------------------------------------------------

const KEY_FIELDS: Record<string, string[]> = {
  balance: ["user", "leveragedToken"],
  user: ["address"],
  leveragedToken: ["address"],
};

const DEFAULTS: Record<string, Record<string, unknown>> = {
  balance: {
    liquidBalance: 0n,
    creditBalance: 0n,
    totalBalance: 0n,
    purchaseCost: 0n,
    realizedProfit: 0n,
    externalTransferAmount: 0n,
  },
  user: {},
};

function createDb() {
  const tables: Record<string, Map<string, any>> = {};
  const getTable = (t: string) => (tables[t] ??= new Map());
  const keyOf = (t: string, obj: any) =>
    JSON.stringify((KEY_FIELDS[t] ?? Object.keys(obj)).map((f) => String(obj[f])));
  const create = (t: string, vals: any) => ({ ...(DEFAULTS[t] ?? {}), ...vals });

  return {
    _tables: tables,
    async find(t: string, key: any) {
      return getTable(t).get(keyOf(t, key)) ?? null;
    },
    insert(t: string) {
      return {
        values(vals: any) {
          const tbl = getTable(t);
          const k = keyOf(t, vals);
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
  };
}

const LT = "0x2222222222222222222222222222222222222222" as Address;
const ALICE = "0xaaaa000000000000000000000000000000000001" as Address;
const BOB = "0xbbbb000000000000000000000000000000000002" as Address;
const TOKEN = 10n ** 18n;

function createHarness() {
  const db = createDb();

  // Seed the leveraged token so ensureLeveragedToken() short-circuits.
  db._tables.leveragedToken = new Map();
  db._tables.leveragedToken.set(JSON.stringify([LT]), {
    address: LT,
    totalSupply: 0n,
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
  const transfer = (from: Address, to: Address, value: bigint) =>
    getHandler("LeveragedToken:Transfer")({
      event: {
        args: { from, to, value },
        log: { address: LT },
        block: { timestamp: BigInt(1_000 + nonce), number: BigInt(nonce++) },
        transaction: { hash: `0x${(nonce + 1).toString(16).padStart(64, "0")}` },
      },
      context,
    });

  return {
    db,
    transfer,
    async transferAmount(user: Address): Promise<bigint | undefined> {
      const balance = await db.find("balance", { user, leveragedToken: LT });
      return balance?.externalTransferAmount;
    },
  };
}

describe("external transfer detection", () => {
  let h: ReturnType<typeof createHarness>;
  beforeEach(() => {
    h = createHarness();
  });

  it("counts a peer-to-peer transfer for both sender and receiver", async () => {
    await h.transfer(ALICE, BOB, 100n * TOKEN);

    expect(await h.transferAmount(ALICE)).toBe(100n * TOKEN);
    expect(await h.transferAmount(BOB)).toBe(100n * TOKEN);
  });

  it("ignores mint legs (transfer from the zero address)", async () => {
    await h.transfer(zeroAddress, ALICE, 100n * TOKEN);

    expect(await h.transferAmount(ALICE)).toBe(0n);
  });

  it("ignores instant redeem legs (transfer to the zero address)", async () => {
    await h.transfer(ALICE, zeroAddress, 100n * TOKEN);

    expect(await h.transferAmount(ALICE)).toBe(0n);
  });

  it("ignores prepare-redeem escrow (transfer to the token contract)", async () => {
    await h.transfer(ALICE, LT, 100n * TOKEN);

    expect(await h.transferAmount(ALICE)).toBe(0n);
  });

  it("ignores cancel/execute-redeem escrow returns (transfer from the token contract)", async () => {
    await h.transfer(LT, ALICE, 100n * TOKEN);

    expect(await h.transferAmount(ALICE)).toBe(0n);
  });

  it("ignores factory distributions (transfer from the factory)", async () => {
    await h.transfer(FACTORY_ADDRESS, ALICE, 100n * TOKEN);

    expect(await h.transferAmount(ALICE)).toBe(0n);
  });

  it("accumulates gross size across sends and receives", async () => {
    await h.transfer(ALICE, BOB, 100n * TOKEN); // Alice sends 100
    await h.transfer(BOB, ALICE, 30n * TOKEN); // Alice receives 30

    // Gross magnitude is in + out, so distortion is tracked regardless of direction.
    expect(await h.transferAmount(ALICE)).toBe(130n * TOKEN);
    expect(await h.transferAmount(BOB)).toBe(130n * TOKEN);
  });
});
