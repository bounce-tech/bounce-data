// Mock for `ponder:registry` used in unit tests.
//
// The real `ponder` object registers event handlers that Ponder invokes at
// index time. In tests we capture the registered handlers so we can invoke
// them directly against an in-memory database, exercising the *real* handler
// logic in `src/LeveragedToken.ts` without spinning up the indexer.

type Handler = (args: { event: any; context: any }) => Promise<void> | void;

const handlers: Record<string, Handler> = {};

export const ponder = {
  on(name: string, handler: Handler) {
    handlers[name] = handler;
  },
};

export const getHandler = (name: string): Handler => {
  const handler = handlers[name];
  if (!handler) throw new Error(`No handler registered for "${name}"`);
  return handler;
};
