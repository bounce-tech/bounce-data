import { Address } from "viem";
import getTradesForUser from "../queries/trades-for-user";
import getTransfersForUser from "../queries/transfers-for-user";
import convertToActions from "../utils/convert-to-actions";
import getLeveragedTokenData from "../utils/leveraged-token-data";
import bigIntToNumber from "../utils/big-int-to-number";
import getCostAndRealized from "../utils/get-cost-and-realized";

interface LeveragedTokenPnl {
  leveragedToken: Address;
  realized: number;
  unrealized: number;
  unrealizedPercent: number;
}

interface UserPnl {
  realized: number;
  unrealized: number;
  leveragedTokens: LeveragedTokenPnl[];
}

const getPnlForUser = async (user: Address) => {
  const [trades, transfers, leveragedTokenData] = await Promise.all([
    getTradesForUser(user),
    getTransfersForUser(user),
    getLeveragedTokenData(user),
  ]);
  const tradeLts = trades.map((trade) => trade.leveragedToken);
  const transferLts = transfers.map((transfer) => transfer.leveragedToken);
  const uniqueLts = [...new Set([...tradeLts, ...transferLts])];
  const leveragedTokens: LeveragedTokenPnl[] = [];
  for (const lt of uniqueLts) {
    const data = leveragedTokenData.find(
      (l) => l.leveragedToken.toLowerCase() === lt
    );
    if (!data) {
      console.error(`Leveraged token ${lt} not found in leveraged token data`);
      continue;
    }
    const ltTrades = trades.filter((t) => t.leveragedToken === lt);
    const ltTransfers = transfers.filter((t) => t.leveragedToken === lt);
    const actions = convertToActions(ltTrades, ltTransfers);
    const { cost, realized } = getCostAndRealized(actions);
    const ltBalance = bigIntToNumber(data.balanceOf, 18);
    const exchangeRate = bigIntToNumber(data.exchangeRate, 18);
    const currentValue = ltBalance * exchangeRate;
    const unrealized = currentValue - cost;
    const unrealizedPercent = cost === 0 ? 0 : unrealized / cost;
    const leveragedTokenPnl: LeveragedTokenPnl = {
      leveragedToken: lt,
      realized,
      unrealized,
      unrealizedPercent: Number(unrealizedPercent.toFixed(6)),
    };
    leveragedTokens.push(leveragedTokenPnl);
  }
  const userPnl: UserPnl = {
    realized: leveragedTokens.reduce((acc, lt) => acc + lt.realized, 0),
    unrealized: leveragedTokens.reduce((acc, lt) => acc + lt.unrealized, 0),
    leveragedTokens,
  };
  return userPnl;
};

export default getPnlForUser;
