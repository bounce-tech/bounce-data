import { createConfig } from "ponder";

import { LeveragedTokenAbi } from "./abis/LeveragedTokenAbi";
import { FactoryAbi } from "./abis/FactoryAbi";
import { ReferralsAbi } from "./abis/ReferralsAbi";

export const LT_HELPER_ADDRESS = "0x560149730F1cb1594F15cF2186b4A86eC761c64D";
export const FACTORY_ADDRESS = "0xaBD5D943b4Bb1D25C6639dD264243b246CC3aA51";
export const REFERRALS_ADDRESS = "0x82A4063f4d05bb7BF18DF314DC5B63b655E86cBD";

const startBlock = 16730182;

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
      address: [
        "0x1EefbAcFeA06D786Ce012c6fc861bec6C7a828c1",
        "0x6c7b7765A410Dd6EA4c64DF4992fb60Fb80F4f76",
        "0x995A1B96C5340444A3aa6833Ed08f0D284d40D90",
        "0x62fff9A958223FC141f2555f4432f47ba9E7Ab80",
        "0xF4f7B2f34A6e1aDfFaE8335E44Ab632c2156b35D",
        "0xb9a1E94D434e57a70d161087E66e224BB132c141",
        "0xc3591a6289E68e02DdC55b102f2B1910D2c12614",
        "0x12dACa370E66F9f20fd97Aa7d5E193A58c8d520a",
        "0x67fcda11170F302938743C8E5f1051D2a806bCe2",
        "0x2525F0794A927DF477292beE1BC1FD57B8a82614",
        "0x3faFA8113E69b22F1b00e48306c25f0E978d2D20",
        "0xD362fe5E49A4727C6aC8798602F9D7eC0C461D89",
        "0x90cF4D94010D685eb95cBEbEcBF71AefA4b71ed1",
        "0xDCC42Ca760B502F89cc53e543322f30b78A68898",
        "0x82F0eDB2C710e1C3DE43E13D97d902b4cbEBc1d2",
        "0x10F609845076907BF9dEEFe11b59aB3bC04d52D7",
        "0x90b5192c0b216E872130b46eC328151B1Bc4FAc7",
        "0x81b64020dF6e50F862833dD9f0894444FD586e60",
        "0x697e04652764ea0553e4827386E6B515Bec490D8",
        "0x751c913D758A590b89acBc3084A9D40b46dc7257",
        "0xE0cC48e64192d98d5F34E003f039959609e070a2",
        "0x4607A05a56e21ADb3f0c975f7fC7b8437CB44322",
        "0x2754bA1cf5d4620427C42D521994088bc4578E1c",
        "0x22a7a4a38A97cA44473548036f22a7BCD2C25457",
        "0xd1C4Be331b6D84d3733de79CEc9A82C063AAcEaA",
        "0x2608Dd88A4E743CDcD8C1DdddCf006B17ADAFc29",
        "0x53C08FE027C4F62e39309a8b5508EB4C7258A0D1",
        "0x53Bec7b96D2d89b0aE270c9e6DA62388a1738afe",
        "0x8d0921192A540E7f5d6Aa2B5f7D30Fa9d24acb94",
        "0x7FE29b27737b20180f828743148d02D66a8ABEE4",
        "0x920CC3AACc065b4EE90bb1e1e42c8686BE622E8A",
        "0x0FE5c3fbb6bfA8d70f63032d38C07E5d795bd6bF",
        "0x73B8523109e2D570978C008916bcb1d7f752a0fe",
      ],
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
