import { ponder } from "ponder:registry";
import { LEVERAGED_TOKEN_HELPER_ABI, LEVERAGED_TOKEN_HELPER_ADDRESS } from "@bouncetech/contracts";
import { hyperEvm } from "viem/chains";
import schema from "ponder:schema";
import { createPublicClient, http } from "viem";
import { eq, gte, inArray, sql } from "ponder";
import addressMatch from "./utils/address-match";

const BRIDGE_TO_EVM_THRESHOLD = 1n;

// We are using our own client here instead of the ponder context.client
// This is because we need to always query latest block
// But the context.client queries historic blocks
// Which reverts for Hyperliquid Precompiles
const publicClient = createPublicClient({
  chain: hyperEvm,
  transport: http(process.env.HYPER_EVM_RPC_URL),
});

ponder.on("PerBlockUpdate:block", async ({ event, context }) => {
  try {
    const blockNumber = event.block.number;
    const [data, recentlyBridgedToEvm] = await Promise.all([publicClient.readContract({
      abi: LEVERAGED_TOKEN_HELPER_ABI,
      address: LEVERAGED_TOKEN_HELPER_ADDRESS,
      functionName: "getExchangeRates",
    }), context.db.sql.select({
      leveragedTokenAddress: schema.leveragedToken.address,
    }).from(schema.leveragedToken).where(
      gte(schema.leveragedToken.latestBridgeToEvmBlock, blockNumber - BRIDGE_TO_EVM_THRESHOLD)
    )]);

    // We exclude leveraged tokens that have been bridged to EVM in the last BRIDGE_TO_EVM_THRESHOLD blocks
    // This is because of an RPC issue where the exchange rate returns an incorrect value in the block following the bridge
    const validData = data.filter((item) => !recentlyBridgedToEvm.some((lt) => addressMatch(lt.leveragedTokenAddress, item.leveragedTokenAddress)));

    if (validData.length === 0) return;

    // Update every leveraged token's exchange rate in a single statement.
    // Issuing one `context.db.update` per token forces a serialized SELECT + UPDATE
    // round-trip for each token (every indexing-store method runs behind a mutex),
    // so this loop scaled linearly with token count and dominated per-block indexing
    // time once the protocol grew past ~100 tokens. The bulk `UPDATE ... CASE` runs as
    // a single round-trip. This is the documented `updateMany` replacement and remains
    // reorg-safe: row-level Postgres triggers capture the writes regardless of source.
    const exchangeRateCase = sql.join(
      [
        sql`(case`,
        ...validData.map(
          (item) =>
            sql`when ${eq(schema.leveragedToken.address, item.leveragedTokenAddress)} then ${item.exchangeRate}::numeric`
        ),
        sql`end)`,
      ],
      sql.raw(" ")
    );

    await context.db.sql
      .update(schema.leveragedToken)
      .set({ exchangeRate: exchangeRateCase })
      .where(
        inArray(
          schema.leveragedToken.address,
          validData.map((item) => item.leveragedTokenAddress)
        )
      );
  } catch (error) {
    console.error("Error updating exchange rates:", error);
  }
});
