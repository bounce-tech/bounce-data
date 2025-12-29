import { Address } from "viem";
import getTradesForUser from "../queries/trades-for-user";
import getTransfersForUser from "../queries/transfers-for-user";
import convertToActions from "../utils/convert-to-actions";
import getLeveragedTokenData from "../utils/leveraged-token-data";
import bigIntToNumber from "../utils/big-int-to-number";
import getCostAndRealized from "../utils/get-cost-and-realized";

interface LeveragedTokenPnl {
  realized: number;
  unrealized: number;
  unrealizedPercent: number;
}

interface UserPnl {
  totalRealized: number;
  totalUnrealized: number;
  leveragedTokens: Record<Address, LeveragedTokenPnl>;
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
  const leveragedTokens: Record<Address, LeveragedTokenPnl> = {};
  let totalRealized = 0;
  let totalUnrealized = 0;
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
    const ltBalance = bigIntToNumber(data.balanceOf + data.credit, 18);
    const exchangeRate = bigIntToNumber(data.exchangeRate, 18);
    const currentValue = ltBalance * exchangeRate;
    const unrealized = currentValue - cost;
    const unrealizedPercent = cost === 0 ? 0 : unrealized / cost;
    leveragedTokens[lt] = {
      realized,
      unrealized,
      unrealizedPercent: Number(unrealizedPercent.toFixed(6)),
    };
    totalRealized += realized;
    totalUnrealized += unrealized;
  }
  const userPnl: UserPnl = {
    totalRealized,
    totalUnrealized,
    leveragedTokens,
  };
  return userPnl;
};

export default getPnlForUser;
