# Requirements

## Bridge marker history (§1)

The indexer records a durable history of every `BridgeToEvm` event so that a
rate change-anchor from weeks ago can be corrected against the bridge marker
that was true **at that block**, rather than against the single live
`latestBridgeToEvmBlock` scalar.

### Behavior

- Each `BridgeToEvm` event writes one `bridgeMarker` row, identified uniquely by
  `(chainId, txHash, logIndex)`. The row carries the token address, block
  number, block timestamp, bridged amount, and sender.
- This is **additive**: the existing `latestBridgeToEvmBlock` scalar continues to
  drive the live path; the history table sits alongside it.
- The handler records a marker for **any** leveraged token Ponder delivers a
  `BridgeToEvm` event for, bootstrapping a token row on first sight if needed —
  it is not limited to a token list baked into the handler. (Which tokens Ponder
  *delivers* events for is governed by the address source; see Scope boundaries.)
- Reads are **canonical-only**. The table stores no manual canonical flag;
  non-canonical rows are removed by Ponder's native reorg rollback, so the read
  interface never exposes them.
- No rate truth is stored here. A full Ponder reindex reconstructs the entire
  marker history purely from logs.

### Scope boundaries

- **Factory-driven token set.** The marker handler bootstraps any token it
  receives an event for, but Ponder's `LeveragedToken` address source is a
  static, hand-maintained list today, so genuinely new tokens are not yet
  auto-tracked. Converting that source to a Factory-derived one is cross-cutting
  (it affects every `LeveragedToken` handler and needs a full reindex) and is
  tracked separately in bounce-tech/bounce-data-ingestion#55 rather than bundled
  into this additive table.

### Operational note

`startBlock` in `ponder.config.ts` bounds how far back marker history is
reconstructed. Markers are fully re-derivable on reindex, so if earlier history
is ever needed, lowering `startBlock` and reindexing once recovers it.
