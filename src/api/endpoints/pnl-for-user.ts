import { Address } from "viem";
import { convertDecimals, mul } from "../utils/scaled-number";
import bigIntToNumber from "../utils/big-int-to-number";
import getBalancesForUser from "../queries/balances-for-user";
import getExchangeRates from "../queries/exchange-rates";
import getUserRealizedPnl from "../queries/user-realized-pnl";

interface LeveragedTokenPnl {
  unrealized: number;
  unrealizedPercent: number;
}

interface UserPnl {
  totalRealized: number;
  totalUnrealized: number;
  leveragedTokens: Record<Address, LeveragedTokenPnl>;
}

const getPnlForUser = async (user: Address) => {
  try {
    const [realizedPnl, balances, exchangeRates] = await Promise.all([
      getUserRealizedPnl(user),
      getBalancesForUser(user),
      getExchangeRates(),
    ]);
    const balanceLts = Object.keys(balances) as Address[];
    const uniqueLts = [...new Set(balanceLts)];
    const leveragedTokens: Record<Address, LeveragedTokenPnl> = {};
    let totalUnrealized = 0;
    for (const lt of uniqueLts) {
      const balance = balances[lt];
      if (!balance) throw new Error(`Balance for leveraged token ${lt} not found`);
      const exchangeRate = exchangeRates[lt];
      if (!exchangeRate) throw new Error(`Exchange rate for leveraged token ${lt} not found`);
      const costNumber = bigIntToNumber(balance.purchaseCost, 6);
      const costScaled = convertDecimals(balance.purchaseCost, 6, 18);
      const currentValue = mul(balance.totalBalance, exchangeRate);
      const unrealized = bigIntToNumber(currentValue - costScaled, 18);
      const unrealizedPercent = costNumber === 0 ? 0 : unrealized / costNumber;
      totalUnrealized += unrealized;
      leveragedTokens[lt] = {
        unrealized,
        unrealizedPercent: Number(unrealizedPercent.toFixed(6)),
      };
    }
    const userPnl: UserPnl = {
      totalRealized: bigIntToNumber(realizedPnl ?? 0n, 6),
      totalUnrealized,
      leveragedTokens,
    };
    return userPnl;
  } catch (error) {
    throw new Error("Failed to fetch profit and loss data");
  }
};

export default getPnlForUser;
