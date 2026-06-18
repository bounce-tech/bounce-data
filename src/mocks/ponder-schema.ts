// Mock for ponder:schema in tests.
//
// Returns the accessed property name as a stable string identifier (e.g.
// `schema.balance` -> "balance"). The in-memory test db keys its tables by
// these names, which lets us drive the real handlers that reference
// `schema.<table>`.
const schema: any = new Proxy(
  {},
  {
    get: (_target, prop) => (typeof prop === "symbol" ? undefined : prop),
  }
);

export default schema;
