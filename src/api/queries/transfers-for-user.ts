import { Address, zeroAddress } from "viem";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, eq, or, not } from "drizzle-orm";

export enum TransferType {
  TRANSFER_OUT = "transferOut",
  TRANSFER_IN = "transferIn",
}

export interface Transfer {
  timestamp: Date;
  type: TransferType;
  leveragedToken: Address;
  amount: bigint;
}

const getTransfersForUser = async (user: Address): Promise<Transfer[]> => {
  const transfersData = await db
    .select({
      timestamp: schema.transfer.timestamp,
      leveragedToken: schema.transfer.leveragedToken,
      sender: schema.transfer.sender,
      recipient: schema.transfer.recipient,
      amount: schema.transfer.amount,
    })
    .from(schema.transfer)
    .where(
      and(
        or(
          eq(schema.transfer.sender, user as Address),
          eq(schema.transfer.recipient, user as Address)
        ),
        not(eq(schema.transfer.sender, schema.transfer.recipient)),
        not(eq(schema.transfer.amount, BigInt(0))),
        not(eq(schema.transfer.sender, zeroAddress)),
        not(eq(schema.transfer.recipient, zeroAddress)),
        not(eq(schema.transfer.sender, schema.transfer.leveragedToken)),
        not(eq(schema.transfer.recipient, schema.transfer.leveragedToken))
      )
    );
  return transfersData.map((transfer) => ({
    timestamp: new Date(Number(transfer.timestamp)),
    type:
      transfer.sender === user
        ? TransferType.TRANSFER_OUT
        : TransferType.TRANSFER_IN,
    leveragedToken: transfer.leveragedToken as Address,
    amount: transfer.amount,
  }));
};

export default getTransfersForUser;
