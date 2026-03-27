import { Address } from "viem";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, isNotNull, asc, and, sql } from "drizzle-orm";
import getAllLeveragedTokens, { LeveragedTokenSummary } from "./get-all-leveraged-tokens";
import getBalancesForUser from "../queries/balances-for-user";
import getExchangeRates from "../queries/exchange-rates";
import bigIntToNumber from "../utils/big-int-to-number";
import { convertDecimals, mul, stringToBigInt } from "../utils/scaled-number";

interface LeveragedToken extends LeveragedTokenSummary {
  userBalance: bigint;
  unrealizedProfit: number;
  unrealizedPercent: number;
}

interface PnlChart {
  timestamp: number;
  value: number;
}

interface EstimatedHlVolume {
  bounceNotional: number;
  attributedHl: number;
}

interface Portfolio {
  unrealizedProfit: number;
  realizedProfit: number;
  leveragedTokens: LeveragedToken[];
  pnlChart: PnlChart[];
  estimatedHlVolume: EstimatedHlVolume;
}

const getPortfolio = async (user: Address): Promise<Portfolio> => {
  try {
    const [balances, exchangeRates, leveragedTokens, tradesWithProfit] = await Promise.all([
      getBalancesForUser(user),
      getExchangeRates(),
      getAllLeveragedTokens(),
      db
        .select({
          timestamp: schema.trade.timestamp,
          profitAmount: schema.trade.profitAmount,
        })
        .from(schema.trade)
        .where(
          and(
            eq(schema.trade.recipient, user as Address),
            isNotNull(schema.trade.profitAmount)
          )
        )
        .orderBy(asc(schema.trade.timestamp))
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

    // Calculate cumulative realized PnL
    let cumulativeRealizedPnl = 0n;
    const pnlChartBigInt = tradesWithProfit.map((trade) => {
      if (trade.profitAmount === null) throw new Error("Profit amount is null");
      const profit = trade.profitAmount;
      cumulativeRealizedPnl += profit;
      return {
        timestamp: Number(trade.timestamp) * 1000,
        value: cumulativeRealizedPnl,
      };
    });

    // Add current unrealized PnL as the latest point
    if (pnlChartBigInt.length > 0 || totalUnrealized !== 0) {
      pnlChartBigInt.push({
        timestamp: Date.now(),
        value: stringToBigInt((totalRealized + totalUnrealized).toString(), 6),
      });
    }

    const pnlChart = pnlChartBigInt.map((chart) => ({
      timestamp: chart.timestamp,
      value: bigIntToNumber(chart.value, 6),
    }));

    const estimatedHlVolume = await getEstimatedHlVolume(user);

    const portfolio: Portfolio = {
      realizedProfit: totalRealized,
      unrealizedProfit: totalUnrealized,
      leveragedTokens: leveragedTokensWithBalances,
      pnlChart,
      estimatedHlVolume,
    };
    return portfolio;
  } catch (error) {
    throw new Error("Failed to fetch portfolio");
  }
};

const getEstimatedHlVolume = async (user: Address): Promise<EstimatedHlVolume> => {
  try {
    const [userVolumes, totalVolumes, hlVaults, leverages] = await Promise.all([
      db
        .select({
          leveragedToken: schema.trade.leveragedToken,
          totalBase: sql<string>`sum(${schema.trade.baseAssetAmount})`,
        })
        .from(schema.trade)
        .where(eq(schema.trade.recipient, user))
        .groupBy(schema.trade.leveragedToken),
      db
        .select({
          leveragedToken: schema.trade.leveragedToken,
          totalBase: sql<string>`sum(${schema.trade.baseAssetAmount})`,
        })
        .from(schema.trade)
        .groupBy(schema.trade.leveragedToken),
      db
        .select({
          address: schema.hlVaultVolume.address,
          hlVolume: schema.hlVaultVolume.hlVolume,
        })
        .from(schema.hlVaultVolume),
      db
        .select({
          address: schema.leveragedToken.address,
          targetLeverage: schema.leveragedToken.targetLeverage,
        })
        .from(schema.leveragedToken),
    ]);

    if (userVolumes.length === 0) return { bounceNotional: 0, attributedHl: 0 };

    const totalByToken = new Map(
      totalVolumes.map((v) => [v.leveragedToken, BigInt(v.totalBase ?? "0")])
    );
    const hlByToken = new Map(hlVaults.map((v) => [v.address, v.hlVolume]));
    const leverageByToken = new Map(leverages.map((l) => [l.address, l.targetLeverage]));

    let userBounceNotional = 0n;
    let userAttributedHl = 0n;

    for (const uv of userVolumes) {
      const userBase = BigInt(uv.totalBase ?? "0");
      const leverage = leverageByToken.get(uv.leveragedToken) ?? 1n;
      userBounceNotional += (userBase * leverage) / BigInt(1e18);

      const tokenTotal = totalByToken.get(uv.leveragedToken);
      const tokenHl = hlByToken.get(uv.leveragedToken);
      if (!tokenTotal || tokenTotal === 0n || !tokenHl) continue;

      userAttributedHl += (userBase * tokenHl) / tokenTotal;
    }

    return {
      bounceNotional: bigIntToNumber(userBounceNotional, 6),
      attributedHl: bigIntToNumber(userAttributedHl, 6),
    };
  } catch (error) {
    console.error("[Portfolio] Error computing estimated HL volume:", error);
    return { bounceNotional: 0, attributedHl: 0 };
  }
};

export default getPortfolio;