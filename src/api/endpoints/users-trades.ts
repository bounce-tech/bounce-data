import { db } from "ponder:api";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { Address } from "viem";
import schema from "ponder:schema";
import { PaginatedResponse } from "../utils/cursor-pagination";
import {
  applyCursorFilter,
  calculatePageInfo,
  applyCompositeCursorFilter,
  calculateCompositePageInfo,
  SortValueType,
} from "../utils/pagination-helpers";
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
  asset: string;
  profitAmount: number | null;
  profitPercent: number | null;
}

export interface UserTradesSortOptions {
  sortBy?: SortField;
  sortOrder?: SortOrder;
}

interface SortConfig {
  column: any;
  valueType: SortValueType;
  getValue: (item: any) => bigint | string | boolean;
}

const getUsersTrades = async (
  user: Address,
  asset?: string,
  leveragedTokenAddress?: Address,
  after?: string,
  before?: string,
  limit: number = 100,
  sortOptions: UserTradesSortOptions = {}
): Promise<PaginatedResponse<UserTrade>> => {
  try {
    const { sortBy = "date", sortOrder = "desc" } = sortOptions;
    const sortDescending = sortOrder === "desc";

    // Build base where conditions
    const whereConditions: any[] = [eq(schema.trade.recipient, user as Address)];
    if (asset && leveragedTokenAddress) {
      whereConditions.push(eq(schema.leveragedToken.asset, asset));
      whereConditions.push(eq(schema.leveragedToken.address, leveragedTokenAddress));
    } else if (asset) {
      whereConditions.push(eq(schema.leveragedToken.asset, asset));
    } else if (leveragedTokenAddress) {
      whereConditions.push(eq(schema.leveragedToken.address, leveragedTokenAddress));
    }
    const baseWhere = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Configure sort field
    const sortConfigs: Record<SortField, SortConfig> = {
      date: {
        column: schema.trade.timestamp,
        valueType: "bigint",
        getValue: (item) => item.timestamp,
      },
      asset: {
        column: schema.leveragedToken.asset,
        valueType: "string",
        getValue: (item) => item.asset,
      },
      activity: {
        column: schema.trade.isBuy,
        valueType: "boolean",
        getValue: (item) => item.isBuy,
      },
      nomVal: {
        column: schema.trade.baseAssetAmount,
        valueType: "bigint",
        getValue: (item) => item.baseAssetAmount,
      },
    };

    const sortConfig = sortConfigs[sortBy];
    const orderFn = sortDescending ? desc : asc;

    // Order by: primary sort field, then timestamp (desc, as tiebreaker for non-date sorts), then id (asc)
    const isDateSort = sortBy === "date";
    const orderByClause = [
      orderFn(sortConfig.column),
      ...(isDateSort ? [] : [desc(schema.trade.timestamp)]),
      asc(schema.trade.id),
    ];

    // Apply cursor filter: use simple cursor for date sort (timestamp + id),
    // composite cursor for other sort fields (sortValue + timestamp + id)
    const where = isDateSort
      ? applyCursorFilter(baseWhere, after, before, schema.trade.timestamp, schema.trade.id)
      : applyCompositeCursorFilter(baseWhere, after, before, {
          sortColumn: sortConfig.column,
          sortValueType: sortConfig.valueType,
          timestampColumn: schema.trade.timestamp,
          idColumn: schema.trade.id,
          sortDescending,
        });

    // Query with limit + 1 to check if there's a next page
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
        asset: schema.leveragedToken.asset,
        profitAmount: schema.trade.profitAmount,
        profitPercent: schema.trade.profitPercent,
      })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .where(where)
      .orderBy(...orderByClause)
      .limit(limit + 1);

    const hasMore = tradesData.length > limit;
    const items = hasMore ? tradesData.slice(0, limit) : tradesData;
    
    // Calculate page info: simple cursor for date sort, composite for other fields
    const pageInfo = isDateSort
      ? calculatePageInfo(
          items,
          hasMore,
          after,
          before,
          (item) => item.timestamp,
          (item) => item.id
        )
      : calculateCompositePageInfo(
          items,
          hasMore,
          after,
          before,
          sortConfig.getValue,
          (item) => item.timestamp,
          (item) => item.id
        );

    // Get total count (always included) - use base where conditions without cursor filtering
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.trade)
      .innerJoin(
        schema.leveragedToken,
        eq(schema.trade.leveragedToken, schema.leveragedToken.address)
      )
      .where(baseWhere);
    const totalCount = Number(countResult[0]?.count || 0);

    return {
      items: items.map((item) => ({
        ...item,
        targetLeverage: bigIntToNumber(item.targetLeverage, 18),
        profitAmount: item.profitAmount ? bigIntToNumber(item.profitAmount, 6) : null,
        profitPercent: item.profitPercent ? bigIntToNumber(item.profitPercent, 18) : null,
      })),
      pageInfo,
      totalCount,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch user trades");
  }
};

export default getUsersTrades;
