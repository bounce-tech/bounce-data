export function encodeCursor(value: string): string {
    return Buffer.from(value).toString("base64");
}

export function decodeCursor(cursor: string): string {
    try {
        return Buffer.from(cursor, "base64").toString("utf-8");
    } catch (error) {
        throw new Error("Invalid cursor format");
    }
}

export function createCursor(fields: Record<string, string | bigint | number>): string {
    const cursorValue = Object.values(fields)
        .map((v) => (typeof v === "bigint" ? v.toString() : String(v)))
        .join("|");
    return encodeCursor(cursorValue);
}

export function parseCursor(cursor: string, fieldCount: number): string[] {
    const decoded = decodeCursor(cursor);
    const parts = decoded.split("|");
    if (parts.length !== fieldCount) {
        throw new Error(`Invalid cursor: expected ${fieldCount} fields, got ${parts.length}`);
    }
    return parts;
}

export function parseCursor2(cursor: string): [string, string] {
    const parts = parseCursor(cursor, 2);
    return [parts[0]!, parts[1]!];
}

export interface PageInfo {
    startCursor: string | null;
    endCursor: string | null;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
    items: T[];
    pageInfo: PageInfo;
    totalCount: number;
}
