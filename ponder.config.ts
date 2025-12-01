import { createConfig, factory } from "ponder";

import { LeveragedTokenAbi } from "./abis/LeveragedTokenAbi";
import { parseAbiItem } from "viem";
import { FactoryAbi } from "./abis/FactoryAbi";
import { ReferralsAbi } from "./abis/ReferralsAbi";

export const LT_HELPER_ADDRESS = "0x560149730F1cb1594F15cF2186b4A86eC761c64D";
export const FACTORY_ADDRESS = "0xaBD5D943b4Bb1D25C6639dD264243b246CC3aA51";
export const REFERRALS_ADDRESS = "0x82A4063f4d05bb7BF18DF314DC5B63b655E86cBD";

const startBlock = 16729000;

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
      startBlock,
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
      startBlock,
    },
    Factory: {
      chain: "hyperEvm",
      abi: FactoryAbi,
      address: FACTORY_ADDRESS,
      startBlock,
    },
    Referrals: {
      chain: "hyperEvm",
      abi: ReferralsAbi,
      address: REFERRALS_ADDRESS,
      startBlock,
    },
  },
});
