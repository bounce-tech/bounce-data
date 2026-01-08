import { Address } from "viem";
import { publicClients } from "ponder:api";
import {
  LEVERAGED_TOKEN_HELPER_ADDRESS,
  LEVERAGED_TOKEN_HELPER_ABI,
} from "@bouncetech/contracts";

interface AgentData {
  slot: number;
  agent: Address;
  createdAt: bigint;
}

export interface LeveragedTokenData {
  leveragedToken: Address;
  marketId: number;
  targetAsset: string;
  targetLeverage: bigint;
  isLong: boolean;
  exchangeRate: bigint;
  baseAssetBalance: bigint;
  totalAssets: bigint;
  userCredit: bigint;
  credit: bigint;
  agentData: AgentData[];
  balanceOf: bigint;
  mintPaused: boolean;
}

const getLeveragedTokenData = async (
  user?: Address
): Promise<LeveragedTokenData[]> => {
  // Querying leveraged token contracts
  let leveragedTokenData: LeveragedTokenData[] = [];
  if (user) {
    leveragedTokenData = (await publicClients["hyperEvm"].readContract({
      abi: LEVERAGED_TOKEN_HELPER_ABI,
      address: LEVERAGED_TOKEN_HELPER_ADDRESS,
      functionName: "getLeveragedTokens",
      args: [user, false],
    })) as unknown as LeveragedTokenData[];
  } else {
    leveragedTokenData = (await publicClients["hyperEvm"].readContract({
      abi: LEVERAGED_TOKEN_HELPER_ABI,
      address: LEVERAGED_TOKEN_HELPER_ADDRESS,
      functionName: "getLeveragedTokens",
      args: [],
    })) as unknown as LeveragedTokenData[];
  }
  return leveragedTokenData;
};

export default getLeveragedTokenData;
