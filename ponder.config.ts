import { createConfig } from "ponder";

import { LeveragedTokenAbi } from "./abis/LeveragedTokenAbi";

export default createConfig({
  chains: {
    hyperEvm: {
      id: 999,
      rpc: process.env.HYPER_EVM_RPC_URL,
    },
  },
  contracts: {
    LeveragedToken: {
      chain: "hyperEvm",
      abi: LeveragedTokenAbi,
      address: "0x1EefbAcFeA06D786Ce012c6fc861bec6C7a828c1",
      startBlock: 16430184,
    },
  },
});
