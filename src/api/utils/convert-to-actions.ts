import { Trade, TradeType } from "../queries/trades-for-user";
import { Transfer, TransferType } from "../queries/transfers-for-user";

export type ActionType = TradeType | TransferType;

export interface Action {
  type: ActionType;
  baseAmount: bigint;
  leveragedTokenAmount: bigint;
  time: Date;
}

const convertToActions = (trades: Trade[], transfers: Transfer[]): Action[] => {
  const actions: Action[] = [];
  for (const trade of trades) {
    actions.push({
      type: trade.type,
      baseAmount: trade.baseAssetAmount,
      leveragedTokenAmount: trade.leveragedTokenAmount,
      time: trade.timestamp,
    });
  }
  for (const transfer of transfers) {
    actions.push({
      type: transfer.type,
      baseAmount: BigInt(0),
      leveragedTokenAmount: transfer.amount,
      time: transfer.timestamp,
    });
  }

  actions.sort((a, b) => a.time.getTime() - b.time.getTime());

  return actions;
};

export default convertToActions;
