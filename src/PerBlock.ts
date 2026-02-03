import { ponder } from "ponder:registry";
import { LEVERAGED_TOKEN_HELPER_ABI, LEVERAGED_TOKEN_HELPER_ADDRESS } from "@bouncetech/contracts";
import { hyperEvm } from "viem/chains";
import schema from "ponder:schema";
import { createPublicClient, http } from "viem";

// We are using our own client here instead of the ponder context.client
// This is because we need to always query latest block
// But the context.client queries historic blocks
// Which reverts for Hyperliquid Precompiles
const publicClient = createPublicClient({
  chain: hyperEvm,
  transport: http(process.env.HYPER_EVM_RPC_URL),
});

ponder.on("PerBlockUpdate:block", async ({ event, context }) => {
  const data = await publicClient.readContract({
    abi: LEVERAGED_TOKEN_HELPER_ABI,
    address: LEVERAGED_TOKEN_HELPER_ADDRESS,
    functionName: "getExchangeRates",
  });
  await Promise.all(
    data.map((item) =>
      context.db
        .update(schema.leveragedToken, { address: item.leveragedTokenAddress })
        .set(() => ({
          exchangeRate: item.exchangeRate,
        }))
    )
  );
});
