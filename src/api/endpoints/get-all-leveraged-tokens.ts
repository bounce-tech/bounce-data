import { db } from "ponder:api";
import schema from "ponder:schema";
import { Address } from "viem";
import bigIntToNumber from "../utils/big-int-to-number";
import { convertDecimals, mul } from "../utils/scaled-number";

export interface LeveragedTokenSummary {
  address: Address;
  targetLeverage: number;
  isLong: boolean;
  symbol: string;
  name: string;
  decimals: number;
  targetAsset: string;
  mintPaused: boolean;
  exchangeRate: bigint;
  totalSupply: bigint;
  totalAssets: bigint;
  baseAssetBalance: bigint;
}

export const leveragedTokenSelect = {
  address: schema.leveragedToken.address,
  targetLeverage: schema.leveragedToken.targetLeverage,
  isLong: schema.leveragedToken.isLong,
  symbol: schema.leveragedToken.symbol,
  name: schema.leveragedToken.name,
  decimals: schema.leveragedToken.decimals,
  targetAsset: schema.leveragedToken.targetAsset,
  mintPaused: schema.leveragedToken.mintPaused,
  exchangeRate: schema.leveragedToken.exchangeRate,
  totalSupply: schema.leveragedToken.totalSupply,
  baseAssetBalance: schema.leveragedToken.baseAssetBalance,
};

const getAllLeveragedTokens = async (): Promise<LeveragedTokenSummary[]> => {
  try {
    const leveragedTokens = await db
      .select(leveragedTokenSelect)
      .from(schema.leveragedToken);

    return leveragedTokens.map((lt) => ({
      ...lt,
      targetLeverage: bigIntToNumber(lt.targetLeverage, 18),
      totalAssets: convertDecimals(mul(lt.totalSupply, lt.exchangeRate), 18, 6),
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch all leveraged tokens");
  }
};

export default getAllLeveragedTokens;
