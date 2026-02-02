import { db } from "ponder:api";
import schema from "ponder:schema";
import { gt, desc, sql } from "drizzle-orm";
import { PaginatedResponse } from "../utils/cursor-pagination";
import { applyCursorFilter, calculatePageInfo } from "../utils/pagination-helpers";

const getAllUsers = async (
  after?: string,
  before?: string,
  limit: number = 100
): Promise<PaginatedResponse<any>> => {
  try {
    const baseWhere = gt(schema.user.tradeCount, 0);
    const where = applyCursorFilter(
      baseWhere,
      after,
      before,
      schema.user.lastTradeTimestamp,
      schema.user.address
    );

    // Query with limit + 1 to check if there's a next page
    const users = await db
      .select({
        address: schema.user.address,
        tradeCount: schema.user.tradeCount,
        mintVolumeNominal: schema.user.mintVolumeNominal,
        redeemVolumeNominal: schema.user.redeemVolumeNominal,
        totalVolumeNominal: schema.user.totalVolumeNominal,
        mintVolumeNotional: schema.user.mintVolumeNotional,
        redeemVolumeNotional: schema.user.redeemVolumeNotional,
        totalVolumeNotional: schema.user.totalVolumeNotional,
        lastTradeTimestamp: schema.user.lastTradeTimestamp,
      })
      .from(schema.user)
      .where(where)
      .orderBy(desc(schema.user.lastTradeTimestamp), schema.user.address)
      .limit(limit + 1);

    const pageInfo = calculatePageInfo(
      users,
      limit,
      after,
      before,
      (item) => item.lastTradeTimestamp,
      (item) => item.address
    );

    const items = users.length > limit ? users.slice(0, limit) : users;

    // Get total count (always included)
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.user)
      .where(baseWhere);
    const totalCount = Number(countResult[0]?.count || 0);

    return {
      items,
      pageInfo,
      totalCount,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch all users");
  }
};

export default getAllUsers;
