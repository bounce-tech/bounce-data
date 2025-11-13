import { createConfig, factory } from "ponder";

import { LeveragedTokenAbi } from "./abis/LeveragedTokenAbi";
import { parseAbiItem } from "viem";
import { FactoryAbi } from "./abis/FactoryAbi";

const FACTORY_ADDRESS = "0xaBD5D943b4Bb1D25C6639dD264243b246CC3aA51";

export default createConfig({
  chains: {
    hyperEvm: {
      id: 999,
      rpc: process.env.HYPER_EVM_RPC_URL,
    },
  },
  blocks: {
    NewBlock: {
      chain: "hyperEvm",
      interval: 1,
      startBlock: 18496592,
    },
  },
  contracts: {
    LeveragedToken: {
      chain: "hyperEvm",
      abi: LeveragedTokenAbi,
      address: factory({
        address: FACTORY_ADDRESS,
        event: parseAbiItem(
          "event CreateLeveragedToken(address indexed creator, address indexed token, uint32 indexed marketId, uint256 targetLeverage, bool isLong)"
        ),
        parameter: "token",
      }),
      startBlock: 16731647,
    },
    Factory: {
      chain: "hyperEvm",
      abi: FactoryAbi,
      address: FACTORY_ADDRESS,
      startBlock: 16731647,
    },
  },
});
