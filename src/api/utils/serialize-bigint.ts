import { Context } from "hono";

/**
 * Recursively converts BigInt values to strings for JSON serialization
 */
const serializeBigInt = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeBigInt(val);
    }
    return result;
  }
  return value;
};

/**
 * Hono middleware that automatically serializes BigInt values in JSON responses
 */
export const bigIntSerializationMiddleware = async (
  c: Context,
  next: () => Promise<void>
) => {
  // Store original json method
  const originalJson = c.json.bind(c);

  // Override json method to serialize BigInt values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c.json = ((body: unknown, statusOrInit?: any, headers?: any) => {
    const serialized = serializeBigInt(body);
    if (headers !== undefined) {
      return originalJson(serialized, statusOrInit, headers);
    } else if (statusOrInit !== undefined) {
      return originalJson(serialized, statusOrInit);
    } else {
      return originalJson(serialized);
    }
  }) as typeof c.json;

  await next();
};

export default serializeBigInt;
