import { ponder } from "ponder:registry";
import { LEVERAGED_TOKEN_HELPER_ABI, LEVERAGED_TOKEN_HELPER_ADDRESS } from "@bouncetech/contracts";
import { hyperEvm } from "viem/chains";
import schema from "ponder:schema";
import { createPublicClient, http } from "viem";
import { gte } from "ponder";
import { db } from "ponder:api";
import addressMatch from "./utils/address-match";

const BRIDGE_FROM_PERP_THRESHOLD = 1n;

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
    const [data, recentlyBridgedFromPerp] = await Promise.all([publicClient.readContract({
      abi: LEVERAGED_TOKEN_HELPER_ABI,
      address: LEVERAGED_TOKEN_HELPER_ADDRESS,
      functionName: "getExchangeRates",
    }), db.select({
      leveragedTokenAddress: schema.leveragedToken.address,
    }).from(schema.leveragedToken).where(
      gte(schema.leveragedToken.latestBridgeFromPerpBlock, blockNumber - BRIDGE_FROM_PERP_THRESHOLD)
    )]);

    // We exclude leveraged tokens that have been bridged from Perp in the last BRIDGE_FROM_PERP_THRESHOLD blocks
    // This is because of an RPC issue where the exchange rate returns an incorrect value in the block following the bridge
    const validData = data.filter((item) => !recentlyBridgedFromPerp.some((lt) => addressMatch(lt.leveragedTokenAddress, item.leveragedTokenAddress)));

    await Promise.all(
      validData.map((item) =>
        context.db
          .update(schema.leveragedToken, { address: item.leveragedTokenAddress })
          .set(() => ({
            exchangeRate: item.exchangeRate,
          }))
      )
    );
  } catch (error) {
    console.error("Error updating exchange rates:", error);
  }
});
