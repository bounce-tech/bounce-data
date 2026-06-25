import { describe, it, expect } from "vitest";
import { zeroAddress, type Address } from "viem";

// Importing the handler module for its side effects registers every
// `ponder.on(...)` handler into our mocked `ponder:registry`.
import "../../src/LeveragedToken";
import { getHandler } from "../../src/mocks/ponder-registry";

// ---------------------------------------------------------------------------
// Minimal in-memory db mirroring the slice of `context.db` the BridgeToEvm
// handler uses: insert().values() (awaitable), update().set(), find().
// ---------------------------------------------------------------------------

const KEY_FIELDS: Record<string, string[]> = {
  leveragedToken: ["address"],
  bridgeMarker: ["chainId", "txHash", "logIndex"],
};

function createDb() {
  const tables: Record<string, Map<string, any>> = {};
  const getTable = (t: string) => (tables[t] ??= new Map());
  const keyOf = (t: string, obj: any) =>
    JSON.stringify((KEY_FIELDS[t] ?? Object.keys(obj)).map((f) => String(obj[f])));

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
          return {
            async onConflictDoNothing() {
              if (!tbl.has(k)) tbl.set(k, vals);
            },
            then(resolve: (v?: unknown) => void, reject: (e: unknown) => void) {
              try {
                tbl.set(k, vals);
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

const CHAIN_ID = 999;
const LT = "0x2222222222222222222222222222222222222222" as Address;
const SENDER = "0x1111111111111111111111111111111111111111" as Address;

function seedToken(db: ReturnType<typeof createDb>, address: Address) {
  db._tables.leveragedToken = db._tables.leveragedToken ?? new Map();
  db._tables.leveragedToken.set(JSON.stringify([address]), {
    address,
    creator: zeroAddress,
    marketId: 0,
    targetLeverage: 3n * 10n ** 18n,
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
}

function createContext(db: ReturnType<typeof createDb>, reads?: Record<string, unknown>) {
  return {
    db,
    chain: { id: CHAIN_ID },
    client: {
      readContract: async ({ functionName }: { functionName: string }) => {
        if (reads && functionName in reads) return reads[functionName];
        throw new Error(`unexpected readContract(${functionName})`);
      },
    },
    contracts: { LeveragedToken: { abi: [] } },
  };
}

type BridgeEvent = {
  token: Address;
  sender: Address;
  amount: bigint;
  blockNumber: bigint;
  blockTimestamp: bigint;
  txHash: string;
  logIndex: number;
};

const fireBridge = (context: any, e: BridgeEvent) =>
  getHandler("LeveragedToken:BridgeToEvm")({
    event: {
      args: { sender: e.sender, amount: e.amount },
      log: { address: e.token, logIndex: e.logIndex },
      block: { number: e.blockNumber, timestamp: e.blockTimestamp },
      transaction: { hash: e.txHash },
    },
    context,
  });

describe("BridgeToEvm -> bridgeMarker history", () => {
  it("records a marker row keyed by (chainId, txHash, logIndex)", async () => {
    const db = createDb();
    seedToken(db, LT);
    const context = createContext(db);

    await fireBridge(context, {
      token: LT,
      sender: SENDER,
      amount: 500n,
      blockNumber: 100n,
      blockTimestamp: 1_700n,
      txHash: "0xaaa",
      logIndex: 3,
    });

    const markers = db.rows("bridgeMarker");
    expect(markers).toHaveLength(1);
    expect(markers[0]).toEqual({
      chainId: CHAIN_ID,
      txHash: "0xaaa",
      logIndex: 3,
      tokenAddress: LT,
      blockNumber: 100n,
      blockTimestamp: 1_700n,
      amount: 500n,
      sender: SENDER,
    });
  });

  it("keeps the live latestBridgeToEvmBlock scalar in sync (additive history)", async () => {
    const db = createDb();
    seedToken(db, LT);
    const context = createContext(db);

    await fireBridge(context, {
      token: LT,
      sender: SENDER,
      amount: 1n,
      blockNumber: 250n,
      blockTimestamp: 1_900n,
      txHash: "0xbbb",
      logIndex: 0,
    });

    const token = await db.find("leveragedToken", { address: LT });
    expect(token.latestBridgeToEvmBlock).toBe(250n);
    expect(db.rows("bridgeMarker")).toHaveLength(1);
  });

  it("retains every bridge as a distinct history row", async () => {
    const db = createDb();
    seedToken(db, LT);
    const context = createContext(db);

    await fireBridge(context, {
      token: LT, sender: SENDER, amount: 10n,
      blockNumber: 100n, blockTimestamp: 1n, txHash: "0x1", logIndex: 0,
    });
    await fireBridge(context, {
      token: LT, sender: SENDER, amount: 20n,
      blockNumber: 200n, blockTimestamp: 2n, txHash: "0x2", logIndex: 0,
    });
    // Same block, different log index -> still a distinct marker.
    await fireBridge(context, {
      token: LT, sender: SENDER, amount: 30n,
      blockNumber: 200n, blockTimestamp: 2n, txHash: "0x2", logIndex: 1,
    });

    const markers = db.rows("bridgeMarker");
    expect(markers).toHaveLength(3);
    expect(markers.map((m) => m.amount).sort()).toEqual([10n, 20n, 30n]);
  });

  it("records a marker for a delivered token not yet in the db (bootstrap)", async () => {
    const db = createDb();
    const NEW_TOKEN = "0x3333333333333333333333333333333333333333" as Address;
    // No seeded row: ensureLeveragedToken bootstraps it from on-chain reads, so
    // a marker is written for any token Ponder delivers an event for. Whether
    // new tokens are auto-discovered is a separate address-source concern.
    const context = createContext(db, {
      symbol: "SOL5L",
      name: "SOL 5x Long",
      decimals: 18,
      marketId: 1,
      targetLeverage: 5n * 10n ** 18n,
      isLong: true,
      mintPaused: false,
    });

    await fireBridge(context, {
      token: NEW_TOKEN, sender: SENDER, amount: 42n,
      blockNumber: 300n, blockTimestamp: 3n, txHash: "0xccc", logIndex: 2,
    });

    const markers = db.rows("bridgeMarker");
    expect(markers).toHaveLength(1);
    expect(markers[0].tokenAddress).toBe(NEW_TOKEN);
    expect(markers[0].amount).toBe(42n);
  });
});
