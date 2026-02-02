import { and, or, lt, gt, eq, SQL } from "drizzle-orm";
import { PageInfo } from "./cursor-pagination";
import { createCursor, parseCursor2 } from "./cursor-pagination";

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
        const [timestampStr, idStr] = parseCursor2(after);
        const timestamp = BigInt(timestampStr);
        const cursorWhere = or(
            lt(timestampColumn, timestamp),
            and(eq(timestampColumn, timestamp), gt(idColumn, idStr))
        ) as T;
        return and(baseWhere, cursorWhere) as T;
    }

    if (before) {
        const [timestampStr, idStr] = parseCursor2(before);
        const timestamp = BigInt(timestampStr);
        const cursorWhere = or(
            gt(timestampColumn, timestamp),
            and(eq(timestampColumn, timestamp), lt(idColumn, idStr))
        ) as T;
        return and(baseWhere, cursorWhere) as T;
    }

    return baseWhere;
}

export function calculatePageInfo<T>(
    items: T[],
    limit: number,
    after: string | undefined,
    before: string | undefined,
    getTimestamp: (item: T) => bigint | string,
    getId: (item: T) => string
): PageInfo {
    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;

    if (pageItems.length === 0) {
        return {
            startCursor: null,
            endCursor: null,
            hasPreviousPage: false,
            hasNextPage: false,
        };
    }

    const firstItem = pageItems[0]!;
    const lastItem = pageItems[pageItems.length - 1]!;
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
        hasPreviousPage: !!before || (!!after && hasMore),
        hasNextPage: hasMore,
    };
}
