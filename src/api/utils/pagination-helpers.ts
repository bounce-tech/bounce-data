import { and, or, lt, gt, eq, SQL } from "drizzle-orm";
import { PageInfo } from "./cursor-pagination";
import { createCursor, parseCursor } from "./cursor-pagination";

export function applyCursorFilter<T extends SQL>(
    baseWhere: T,
    after: string | undefined,
    before: string | undefined,
    timestampColumn: any,
    idColumn: any
): T {
    if (after && before) {
        throw new Error("Cannot specify both 'after' and 'before' cursor parameters");
    }

    if (after) {
        const [timestampStr, idStr] = parseCursor(after, 2);
        const timestamp = BigInt(timestampStr!);
        const cursorWhere = or(
            lt(timestampColumn, timestamp),
            and(eq(timestampColumn, timestamp), gt(idColumn, idStr))
        ) as T;
        return and(baseWhere, cursorWhere) as T;
    }

    if (before) {
        const [timestampStr, idStr] = parseCursor(before, 2);
        const timestamp = BigInt(timestampStr!);
        const cursorWhere = or(
            gt(timestampColumn, timestamp),
            and(eq(timestampColumn, timestamp), lt(idColumn, idStr))
        ) as T;
        return and(baseWhere, cursorWhere) as T;
    }

    return baseWhere;
}

export type SortValueType = "bigint" | "string" | "boolean";

export interface CompositeCursorConfig {
    sortColumn: any;
    sortValueType: SortValueType;
    timestampColumn: any;
    idColumn: any;
    sortDescending: boolean;
}

/**
 * Apply cursor filter for composite cursors (sortValue|timestamp|id)
 * This enables stable pagination for any sort field by using timestamp as a tie-breaker
 */
export function applyCompositeCursorFilter<T extends SQL>(
    baseWhere: T,
    after: string | undefined,
    before: string | undefined,
    config: CompositeCursorConfig
): T {
    if (after && before) {
        throw new Error("Cannot specify both 'after' and 'before' cursor parameters");
    }

    const { sortColumn, sortValueType, timestampColumn, idColumn, sortDescending } = config;

    if (!after && !before) {
        return baseWhere;
    }

    const cursor = after || before;
    const [sortValueStr, timestampStr, idStr] = parseCursor(cursor!, 3);
    
    // Parse sort value based on type
    let sortValue: bigint | string | boolean;
    if (sortValueType === "bigint") {
        sortValue = BigInt(sortValueStr!);
    } else if (sortValueType === "boolean") {
        sortValue = sortValueStr === "true";
    } else {
        sortValue = sortValueStr!;
    }
    const timestamp = BigInt(timestampStr!);

    // For "after" with descending sort, we want values LESS than cursor
    // For "after" with ascending sort, we want values GREATER than cursor
    // For "before", it's the opposite
    const isAfter = !!after;
    const wantLessThan = (isAfter && sortDescending) || (!isAfter && !sortDescending);

    const sortCompare = wantLessThan ? lt : gt;
    
    // Composite cursor filter:
    // (sortValue <> cursorSortValue) OR
    // (sortValue = cursorSortValue AND timestamp < cursorTimestamp) OR
    // (sortValue = cursorSortValue AND timestamp = cursorTimestamp AND id > cursorId)
    // 
    // Note: timestamp is always descending as secondary sort, id always ascending as tertiary
    const cursorWhere = or(
        sortCompare(sortColumn, sortValue),
        and(
            eq(sortColumn, sortValue),
            lt(timestampColumn, timestamp)
        ),
        and(
            eq(sortColumn, sortValue),
            eq(timestampColumn, timestamp),
            gt(idColumn, idStr)
        )
    ) as T;

    // For "before" pagination, we need to flip the logic
    if (!isAfter) {
        const beforeWhere = or(
            sortCompare(sortColumn, sortValue),
            and(
                eq(sortColumn, sortValue),
                gt(timestampColumn, timestamp)
            ),
            and(
                eq(sortColumn, sortValue),
                eq(timestampColumn, timestamp),
                lt(idColumn, idStr)
            )
        ) as T;
        return and(baseWhere, beforeWhere) as T;
    }

    return and(baseWhere, cursorWhere) as T;
}

export function calculatePageInfo<T>(
    items: T[],
    hasMore: boolean,
    after: string | undefined,
    before: string | undefined,
    getTimestamp: (item: T) => bigint | string,
    getId: (item: T) => string
): PageInfo {
    if (items.length === 0) {
        return {
            startCursor: null,
            endCursor: null,
            hasPreviousPage: false,
            hasNextPage: false,
        };
    }

    const firstItem = items[0]!;
    const lastItem = items[items.length - 1]!;
    const startCursor = createCursor({
        timestamp: getTimestamp(firstItem).toString(),
        id: getId(firstItem),
    });
    const endCursor = createCursor({
        timestamp: getTimestamp(lastItem).toString(),
        id: getId(lastItem),
    });

    return {
        startCursor,
        endCursor,
        hasPreviousPage: before ? hasMore : !!after,
        hasNextPage: before ? true : hasMore,
    };
}

/**
 * Calculate page info for composite cursors (sortValue|timestamp|id)
 */
export function calculateCompositePageInfo<T>(
    items: T[],
    hasMore: boolean,
    after: string | undefined,
    before: string | undefined,
    getSortValue: (item: T) => bigint | string | boolean,
    getTimestamp: (item: T) => bigint | string,
    getId: (item: T) => string
): PageInfo {
    if (items.length === 0) {
        return {
            startCursor: null,
            endCursor: null,
            hasPreviousPage: false,
            hasNextPage: false,
        };
    }

    const firstItem = items[0]!;
    const lastItem = items[items.length - 1]!;
    
    const startCursor = createCursor({
        sortValue: getSortValue(firstItem).toString(),
        timestamp: getTimestamp(firstItem).toString(),
        id: getId(firstItem),
    });
    const endCursor = createCursor({
        sortValue: getSortValue(lastItem).toString(),
        timestamp: getTimestamp(lastItem).toString(),
        id: getId(lastItem),
    });

    return {
        startCursor,
        endCursor,
        hasPreviousPage: before ? hasMore : !!after,
        hasNextPage: before ? true : hasMore,
    };
}
