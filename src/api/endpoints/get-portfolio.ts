import { Address } from "viem";
import getAllLeveragedTokens, { LeveragedTokenSummary } from "./get-all-leveraged-tokens";
import getBalancesForUser from "../queries/balances-for-user";
import getExchangeRates from "../queries/exchange-rates";
import bigIntToNumber from "../utils/big-int-to-number";
import { convertDecimals, mul } from "../utils/scaled-number";

interface LeveragedToken extends LeveragedTokenSummary {
  userBalance: bigint;
  unrealizedProfit: number;
  unrealizedPercent: number;
}

interface PnlChart {
  timestamp: number;
  value: number;
}

interface Portfolio {
  unrealizedProfit: number;
  realizedProfit: number;
  leveragedTokens: LeveragedToken[];
  pnlChart: PnlChart[];
}

const getPortfolio = async (user: Address): Promise<Portfolio> => {
  try {
    const [balances, exchangeRates, leveragedTokens] = await Promise.all([
      getBalancesForUser(user),
      getExchangeRates(),
      getAllLeveragedTokens(),
    ]);
    let totalUnrealized = 0;
    let totalRealized = 0;
    const leveragedTokensWithBalances: LeveragedToken[] = [];
    for (const lt of leveragedTokens) {
      const balance = balances[lt.address];
      if (!balance) continue;
      const exchangeRate = exchangeRates[lt.address];
      if (!exchangeRate) throw new Error(`Exchange rate for leveraged token ${lt.address} not found`);
      const costNumber = bigIntToNumber(balance.purchaseCost, 6);
      const costScaled = convertDecimals(balance.purchaseCost, 6, 18);
      const currentValue = mul(balance.totalBalance, exchangeRate);
      const unrealized = bigIntToNumber(currentValue - costScaled, 18);
      const realized = bigIntToNumber(balance.realizedProfit, 6);
      totalUnrealized += unrealized;
      totalRealized += realized;
      leveragedTokensWithBalances.push({
        ...lt,
        userBalance: balance.totalBalance,
        unrealizedProfit: unrealized,
        unrealizedPercent: costNumber === 0 ? 0 : unrealized / costNumber,
      });
    }
    const portfolio: Portfolio = {
      realizedProfit: totalRealized,
      unrealizedProfit: totalUnrealized,
      leveragedTokens: leveragedTokensWithBalances,
      pnlChart: [],
    };
    return portfolio;
  } catch (error) {
    throw new Error("Failed to fetch portfolio");
  }
};

export default getPortfolio;