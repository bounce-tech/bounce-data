import schema from "ponder:schema";
import { Address, zeroAddress } from "viem";

// Bootstraps a `leveragedToken` row from on-chain reads when the indexer
// encounters an event for a token that was registered with the Factory before
// our indexed range begins (so its Factory:Create/Import event is never seen).
//
// The Factory's Create/Import handlers should upsert on top of the row created
// here, enriching it with any data that only the Factory event carries.
export async function ensureLeveragedToken(
  context: any,
  address: Address
): Promise<void> {
  const existing = await context.db.find(schema.leveragedToken, { address });
  if (existing) return;

  const abi = context.contracts.LeveragedToken.abi;
  const read = (functionName: string) =>
    context.client.readContract({ abi, address, functionName });

  const [symbol, name, decimals, marketId, targetLeverage, isLong, mintPaused] =
    await Promise.all([
      read("symbol") as Promise<string>,
      read("name") as Promise<string>,
      read("decimals") as Promise<number>,
      read("marketId") as Promise<number>,
      read("targetLeverage") as Promise<bigint>,
      read("isLong") as Promise<boolean>,
      read("mintPaused") as Promise<boolean>,
    ]);

  const targetAsset = name.split(" ")[0];
  if (!targetAsset) throw new Error(`Asset not found for token ${address}`);

  await context.db
    .insert(schema.leveragedToken)
    .values({
      address,
      // Unknown until the Factory's Create/Import event is later indexed; the
      // upsert in Factory.ts will overwrite this with the real value.
      creator: zeroAddress,
      marketId,
      targetLeverage,
      isLong,
      symbol,
      name,
      decimals,
      mintPaused,
      targetAsset,
    })
    .onConflictDoNothing();
}
