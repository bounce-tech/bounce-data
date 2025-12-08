import { TradeType } from "../queries/trades-for-user";
import { TransferType } from "../queries/transfers-for-user";
import { Action } from "./convert-to-actions";

const getCostAndRealized = (
  actions: Action[]
): { cost: number; realized: number } => {
  let totalCost = 0;
  let totalAmount = 0;
  let averageCost = 0;
  let realized = 0;

  for (const action of actions) {
    if (action.type === TransferType.TRANSFER_OUT) {
      if (totalAmount <= 0) {
        // Nothing to transfer out, skip to next trade to avoid division by zero
        continue;
      }
      const percentageTransferred = action.leveragedTokenAmount / totalAmount;
      totalCost *= 1 - percentageTransferred;
      totalAmount *= 1 - percentageTransferred;
      continue;
    }
    if (action.type === TradeType.MINT) {
      // When minting, add to position and update average cost
      const tradeCost = action.baseAmount;
      const tradeAmount = action.leveragedTokenAmount;

      totalCost += tradeCost;
      totalAmount += tradeAmount;
      averageCost = totalAmount > 0 ? totalCost / totalAmount : 0;
      continue;
    }
    if (action.type === TransferType.TRANSFER_IN) {
      // Process transfer in as a mint
      const tradeCost = action.baseAmount;
      const tradeAmount = action.leveragedTokenAmount;

      totalCost += tradeCost;
      totalAmount += tradeAmount;
      averageCost = totalAmount > 0 ? totalCost / totalAmount : 0;
      continue;
    }
    if (action.type === TradeType.REDEEM) {
      // When redeeming, reduce position but keep same average cost
      const tradeAmount = action.leveragedTokenAmount;
      if (tradeAmount === 0) continue;
      totalAmount -= tradeAmount;
      // Update total cost based on remaining position
      totalCost = totalAmount * averageCost;

      const currentPrice = action.baseAmount / tradeAmount;
      const priceDifference = currentPrice - averageCost;
      realized += priceDifference * tradeAmount;
    }
  }

  // Return the cost value of the current position
  return { cost: totalAmount * averageCost, realized };
};

export default getCostAndRealized;
