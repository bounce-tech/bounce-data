import { createConfig } from "ponder";

import {
  FACTORY_ABI,
  LEVERAGED_TOKEN_ABI,
  REFERRALS_ABI,
  FACTORY_ADDRESS,
  REFERRALS_ADDRESS,
} from "@bouncetech/contracts";
import { BUILD_BLOCK } from "./src/utils/build-block";

const startBlock = 21549398;

export default createConfig({
  chains: {
    hyperEvm: {
      id: 999,
      rpc: process.env.HYPER_EVM_RPC_URL,
    },
  },
  blocks: {
    PerBlockUpdate: {
      chain: "hyperEvm",
      interval: 1,
      startBlock: BUILD_BLOCK,
    }
  },
  contracts: {
    LeveragedToken: {
      chain: "hyperEvm",
      abi: LEVERAGED_TOKEN_ABI,
      address: [
        "0x7B430c5842ce7dBa29b910c018369FA2Fa0ac2e3",
        "0xa18E0878d47b2c22B4b84832c04544C02Fd4991A",
        "0xab5A9525afb6F25382B48Bf18b3817B0c7cE713d",
        "0x225AA40ab60e69DAba3496c5422eeEd0B5f5bf8a",
        "0xBe4e97a8FceeB1b82D64349FbA6Ff29B65Ad3B7d",
        "0x42E4E7E81bcbb648282D5fa261b2c0840747C8f3",
        "0x14bD1DAC6b9D8FCF4B4d16102f1057012d74E647",
        "0x03C4f10995B2D502a2320c9b5b694dBa3cB64977",
        "0x6019caD7d5A8D4d90eCed36576d23F6198aed156",
        "0xB5A5EcA6Ddc738943A6CaF716D4185B3680dE4b7",
        "0x6ce8B325252805d2b4b5A6d03eA197d95E0dd582",
        "0x6501791028227a3c6DB582a681A644ff489871c9",
        "0xd29f674061208214330a86554E841eaC5F74CB79",
        "0x04Ffb6985A6508ab8e9f82dDDB8BeeAB7c3347c0",
        "0x633A1f5221A0146Ea37067E83c53BB64401e53d2",
        "0xF445EB1c08CA4c300994450a120994062b0A1A84",
        "0x7600c7e9C21118c69367bc476873A412E0e58215",
        "0x8Ad5EB8f4535F277A2b5eD9CB9F54Bf9a6f9B41D",
        "0x0f8db745e9C28275F8B6e2BAF6BAA8eE7431b557",
        "0xbA9f0f6f2B6d1E639cbe93327E588c01cE28A2d9",
        "0x9A51b0DC3545cb8e9b0382b42c91F9e39a92eFD6",
        "0x176fe1F384F1b0fC2A0a270c56485eA3efc6c727",
        "0x18b8539261cF9e760E7fEc4a8a73c50F0AE7baBE",
        "0x0315f272b9f9b14822Ce9C4b15a711C0Dbb6aEC3",
      ],
      startBlock,
    },
    Factory: {
      chain: "hyperEvm",
      abi: FACTORY_ABI,
      address: FACTORY_ADDRESS,
      startBlock,
    },
    Referrals: {
      chain: "hyperEvm",
      abi: REFERRALS_ABI,
      address: REFERRALS_ADDRESS,
      startBlock,
    },
  },
});
