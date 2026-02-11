import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { LeveragedTokenSummary, leveragedTokenSelect } from "./get-all-leveraged-tokens";
import bigIntToNumber from "../utils/big-int-to-number";
import { convertDecimals, mul } from "../utils/scaled-number";

const getLeveragedToken = async (
  symbol: string
): Promise<LeveragedTokenSummary | null> => {
  try {
    const result = await db
      .select(leveragedTokenSelect)
      .from(schema.leveragedToken)
      .where(eq(schema.leveragedToken.symbol, symbol))
      .limit(1);

    const lt = result[0];
    if (!lt) return null;
    return {
      ...lt,
      targetLeverage: bigIntToNumber(lt.targetLeverage, 18),
      totalAssets: convertDecimals(mul(lt.totalSupply, lt.exchangeRate), 18, 6),
    };
  } catch (error) {
    throw new Error("Failed to fetch leveraged token");
  }
};

export default getLeveragedToken;
