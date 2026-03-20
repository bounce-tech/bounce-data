import { ponder } from "ponder:registry";
import schema from "ponder:schema";

const HL_API = "https://api.hyperliquid.xyz/info";

interface HlFill {
  sz: string;
  px: string;
  fee: string;
  time: number;
}

async function fetchAllFills(address: string): Promise<HlFill[]> {
  const allFills: HlFill[] = [];
  let startTime = 0;

  while (true) {
    const res = await fetch(HL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "userFillsByTime",
        user: address,
        startTime,
      }),
    });
    const fills: HlFill[] = await res.json();
    if (!fills || !Array.isArray(fills) || fills.length === 0) break;

    allFills.push(...fills);
    const lastTime = Math.max(...fills.map((f) => f.time));
    if (lastTime <= startTime || fills.length < 100) break;
    startTime = lastTime + 1;
  }

  return allFills;
}

ponder.on("HlVolumeUpdate:block", async ({ event, context }) => {
  try {
    const tokens = await context.db.sql
      .select({ address: schema.leveragedToken.address })
      .from(schema.leveragedToken);

    const timestamp = event.block.timestamp;

    for (const token of tokens) {
      const fills = await fetchAllFills(token.address);

      let volume = 0n;
      let fees = 0n;
      for (const fill of fills) {
        const sz = parseFloat(fill.sz);
        const px = parseFloat(fill.px);
        const fee = parseFloat(fill.fee);
        // Store with 6 decimal precision (USDC scale)
        volume += BigInt(Math.round(sz * px * 1e6));
        fees += BigInt(Math.round(fee * 1e6));
      }

      await context.db
        .insert(schema.hlVaultVolume)
        .values({
          address: token.address,
          hlVolume: volume,
          hlFills: fills.length,
          hlFees: fees,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          hlVolume: volume,
          hlFills: fills.length,
          hlFees: fees,
          updatedAt: timestamp,
        });
    }

    console.log(
      `[HlVolume] Updated HL volume for ${tokens.length} tokens at block ${event.block.number}`
    );
  } catch (error) {
    console.error("[HlVolume] Error updating HL volumes:", error);
  }
});
