import { MAX_QUERY_SIZE } from "./config";

export function validatePaginationParams(
    after: string | undefined,
    before: string | undefined,
    limit: string | undefined
): string | null {
    if (after && before) return "Cannot specify both 'after' and 'before' cursor parameters";
    if (limit === undefined) return null;
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit)) return "Limit must be a valid number";
    if (parsedLimit > MAX_QUERY_SIZE) return `Limit cannot exceed ${MAX_QUERY_SIZE}`;
    if (parsedLimit < 1) return "Limit must be at least 1";
    return null;
}
