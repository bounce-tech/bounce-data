import { MAX_QUERY_SIZE } from "./config";

export function validateOffsetPaginationParams(
    page: string | undefined,
    limit: string | undefined
): string | null {
    if (page !== undefined) {
        const parsedPage = Number(page);
        if (!Number.isInteger(parsedPage)) return "Page must be a valid integer";
        if (parsedPage < 1) return "Page must be at least 1";
    }
    if (limit !== undefined) {
        const parsedLimit = Number(limit);
        if (!Number.isInteger(parsedLimit)) return "Limit must be a valid integer";
        if (parsedLimit > MAX_QUERY_SIZE) return `Limit cannot exceed ${MAX_QUERY_SIZE}`;
        if (parsedLimit < 1) return "Limit must be at least 1";
    }
    return null;
}

export type SortField = "date" | "targetAsset" | "activity" | "nomVal" | "pnlAmount" | "pnlPercent";
export type SortOrder = "asc" | "desc";

const VALID_SORT_FIELDS: SortField[] = ["date", "targetAsset", "activity", "nomVal", "pnlAmount", "pnlPercent"];

export function validateSortParams(
    sortBy: string | undefined,
    sortOrder: string | undefined
): string | null {
    if (sortBy !== undefined) {
        if (!VALID_SORT_FIELDS.includes(sortBy as SortField)) {
            return `sortBy must be one of: ${VALID_SORT_FIELDS.join(", ")}`;
        }
    }
    if (sortOrder !== undefined) {
        if (sortOrder !== "asc" && sortOrder !== "desc") {
            return "sortOrder must be 'asc' or 'desc'";
        }
    }
    return null;
}
