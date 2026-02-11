import { db } from "ponder:api";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { Address } from "viem";
import schema from "ponder:schema";
import bigIntToNumber from "../utils/big-int-to-number";
import { SortField, SortOrder } from "../utils/validate";

export interface UserTrade {
  id: string;
  txHash: string;
  timestamp: bigint;
  isBuy: boolean;
  baseAssetAmount: bigint;
  leveragedTokenAmount: bigint;
  leveragedToken: Address;
  targetLeverage: number;
  isLong: boolean;
  targetAsset: string;
  profitAmount: number | null;
  profitPercent: number | null;
}

export interface UserTradesSortOptions {
  sortBy?: SortField;
  sortOrder?: SortOrder;
}

export interface PaginatedTradesResponse {
  items: UserTrade[];
  totalCount: number;
  page: number;
  totalPages: number;
}

const getUsersTrades = async (
  user: Address,
  asset?: string,
  leveragedTokenAddress?: Address,
  page: number = 1,
  limit: number = 100,
  sortOptions: UserTradesSortOptions = {}
): Promise<PaginatedTradesResponse> => {
  try {
    const { sortBy = "date", sortOrder = "desc" } = sortOptions;
    const sortDescending = sortOrder === "desc";

    // Build base where conditions
    const whereConditions: any[] = [eq(schema.trade.recipient, user as Address)];
    if (asset && leveragedTokenAddress) {
      whereConditions.push(eq(schema.leveragedToken.targetAsset, asset));
      whereConditions.push(eq(schema.leveragedToken.address, leveragedTokenAddress));
    } else if (asset) {
      whereConditions.push(eq(schema.leveragedToken.targetAsset, asset));
    } else if (leveragedTokenAddress) {
      whereConditions.push(eq(schema.leveragedToken.address, leveragedTokenAddress));
    }
    const baseWhere = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Configure sort columns
    const sortColumnMap: Record<SortField, any> = {
      date: schema.trade.timestamp,
      asset: schema.leveragedToken.targetAsset,
      activity: schema.trade.isBuy,
      nomVal: schema.trade.baseAssetAmount,
    };

    const orderFn = sortDescending ? desc : asc;
    const isDateSort = sortBy === "date";
    const orderByClause = [
      orderFn(sortColumnMap[sortBy]),
      ...(isDateSort ? [] : [desc(schema.trade.timestamp)]),
      asc(schema.trade.id),
    ];

    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .where(baseWhere);
    const totalCount = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Query with offset and limit
    const tradesData = await db
      .select({
        id: schema.trade.id,
        txHash: schema.trade.txHash,
        timestamp: schema.trade.timestamp,
        isBuy: schema.trade.isBuy,
        baseAssetAmount: schema.trade.baseAssetAmount,
        leveragedTokenAmount: schema.trade.leveragedTokenAmount,
        leveragedToken: schema.trade.leveragedToken,
        targetLeverage: schema.leveragedToken.targetLeverage,
        isLong: schema.leveragedToken.isLong,
        targetAsset: schema.leveragedToken.targetAsset,
        profitAmount: schema.trade.profitAmount,
        profitPercent: schema.trade.profitPercent,
      })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .where(baseWhere)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      items: tradesData.map((item) => ({
        ...item,
        targetLeverage: bigIntToNumber(item.targetLeverage, 18),
        profitAmount: item.profitAmount == null ? null : bigIntToNumber(item.profitAmount, 6),
        profitPercent: item.profitPercent == null ? null : bigIntToNumber(item.profitPercent, 18),
      })),
      totalCount,
      page,
      totalPages,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch user trades");
  }
};

export default getUsersTrades;
