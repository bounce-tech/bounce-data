import { Address } from "viem";
import { db } from "ponder:api";
import schema from "ponder:schema";


export interface ExchangeRate {
  leveragedToken: Address;
  exchangeRate: bigint;
}

const getExchangeRates = async (): Promise<ExchangeRate[]> => {
  try {
    const exchangeRateData = await db
      .select({
        leveragedToken: schema.leveragedToken.address,
        exchangeRate: schema.leveragedToken.exchangeRate,
      })
      .from(schema.leveragedToken);
    return exchangeRateData.map((exchangeRate) => ({
      leveragedToken: exchangeRate.leveragedToken as Address,
      exchangeRate: exchangeRate.exchangeRate,
    }));
  } catch (error) {
    throw new Error("Failed to fetch exchange rates");
  }
};

export default getExchangeRates;
