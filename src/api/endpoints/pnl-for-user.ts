import { Address } from "viem";
import getTradesForUser from "../queries/trades-for-user";
import getTransfersForUser from "../queries/transfers-for-user";
import convertToActions from "../utils/convert-to-actions";
import getLeveragedTokenData from "../utils/leveraged-token-data";
import { convertDecimals, mul } from "../utils/scaled-number";
import getCostAndRealized from "../utils/get-cost-and-realized";
import bigIntToNumber from "../utils/big-int-to-number";

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
  try {
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
      const realizedNumber = bigIntToNumber(realized, 6);
      const costNumber = bigIntToNumber(cost, 6);
      const costScaled = convertDecimals(cost, 6, 18);
      const ltBalance = data.balanceOf + data.userCredit;
      const exchangeRate = data.exchangeRate;
      const currentValue = mul(ltBalance, exchangeRate);
      const unrealized = bigIntToNumber(currentValue - costScaled, 18);
      const unrealizedPercent = costNumber === 0 ? 0 : unrealized / costNumber;
      leveragedTokens[lt] = {
        realized: realizedNumber,
        unrealized,
        unrealizedPercent: Number(unrealizedPercent.toFixed(6)),
      };
      totalRealized += realizedNumber;
      totalUnrealized += unrealized;
    }
    const userPnl: UserPnl = {
      totalRealized,
      totalUnrealized,
      leveragedTokens,
    };
    return userPnl;
  } catch (error) {
    throw new Error("Failed to fetch profit and loss data");
  }
};

export default getPnlForUser;
