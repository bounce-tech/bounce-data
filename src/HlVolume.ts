import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";

const HL_API = "https://api.hyperliquid.xyz/info";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface HlFill {
  sz: string;
  px: string;
  fee: string;
  time: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchFillsPage = async (
  address: string,
  startTime: number,
  attempt = 0
): Promise<HlFill[]> => {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "userFillsByTime",
      user: address,
      startTime,
    }),
  });

  if (!res.ok) {
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[HlVolume] HL API ${res.status} for ${address}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(delay);
      return fetchFillsPage(address, startTime, attempt + 1);
    }
    const body = await res.text().catch(() => "<unreadable>");
    throw new Error(
      `HL API error for ${address}: ${res.status} ${res.statusText} - ${body}`
    );
  }

  let fills: HlFill[];
  try {
    fills = await res.json();
  } catch (err) {
    throw new Error(
      `Failed to parse HL API JSON for ${address}: ${err}`
    );
  }

  if (!Array.isArray(fills)) return [];
  return fills;
};

const fetchFillsSince = async (
  address: string,
  since: number
): Promise<HlFill[]> => {
  const allFills: HlFill[] = [];
  let startTime = since;

  while (true) {
    const fills = await fetchFillsPage(address, startTime);
    if (fills.length === 0) break;

    allFills.push(...fills);
    const lastTime = Math.max(...fills.map((f) => f.time));

    // If all fills share the same timestamp and we got a full page,
    // there may be more at the same time — advance by 1ms to avoid
    // an infinite loop (accepts the risk of missing same-ms fills,
    // which is negligible for hourly aggregation).
    if (lastTime <= startTime) {
      if (fills.length >= 100) {
        startTime = lastTime + 1;
        continue;
      }
      break;
    }

    if (fills.length < 100) break;
    startTime = lastTime + 1;
  }

  return allFills;
};

const parseVolume = (sz: string, px: string): bigint => {
  const size = parseFloat(sz);
  const price = parseFloat(px);
  if (!Number.isFinite(size) || !Number.isFinite(price)) return 0n;
  return BigInt(Math.round(size * price * 1e6));
};

const parseFee = (fee: string): bigint => {
  const f = parseFloat(fee);
  if (!Number.isFinite(f)) return 0n;
  return BigInt(Math.round(f * 1e6));
};

ponder.on("HlVolumeUpdate:block", async ({ event, context }) => {
  try {
    const tokens = await context.db.sql
      .select({ address: schema.leveragedToken.address })
      .from(schema.leveragedToken);

    const timestamp = event.block.timestamp;

    for (const token of tokens) {
      // Read existing cached state for incremental fetch
      const existing = await context.db.sql
        .select({
          hlVolume: schema.hlVaultVolume.hlVolume,
          hlFills: schema.hlVaultVolume.hlFills,
          hlFees: schema.hlVaultVolume.hlFees,
          lastFillTime: schema.hlVaultVolume.lastFillTime,
        })
        .from(schema.hlVaultVolume)
        .where(eq(schema.hlVaultVolume.address, token.address))
        .then((rows) => rows[0] ?? null);

      const cursor = existing ? Number(existing.lastFillTime) : 0;
      const newFills = await fetchFillsSince(token.address, cursor);

      let addedVolume = 0n;
      let addedFees = 0n;
      let maxTime = cursor;

      for (const fill of newFills) {
        addedVolume += parseVolume(fill.sz, fill.px);
        addedFees += parseFee(fill.fee);
        if (fill.time > maxTime) maxTime = fill.time;
      }

      const totalVolume = (existing?.hlVolume ?? 0n) + addedVolume;
      const totalFills = (existing?.hlFills ?? 0) + newFills.length;
      const totalFees = (existing?.hlFees ?? 0n) + addedFees;

      await context.db
        .insert(schema.hlVaultVolume)
        .values({
          address: token.address,
          hlVolume: totalVolume,
          hlFills: totalFills,
          hlFees: totalFees,
          lastFillTime: BigInt(maxTime),
          updatedAt: timestamp,
        })
        .onConflictDoUpdate(() => ({
          hlVolume: totalVolume,
          hlFills: totalFills,
          hlFees: totalFees,
          lastFillTime: BigInt(maxTime),
          updatedAt: timestamp,
        }));
    }

    console.log(
      `[HlVolume] Updated HL volume for ${tokens.length} tokens at block ${event.block.number}`
    );
  } catch (error) {
    console.error("[HlVolume] Error updating HL volumes:", error);
  }
});
