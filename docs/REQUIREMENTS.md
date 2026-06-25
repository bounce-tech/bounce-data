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
- The marker set is **factory-driven** — markers are recorded for any
  leveraged token the indexer encounters (including factory-created tokens that
  bootstrap on first event), not a static address list.
- Reads are **canonical-only**. The table stores no manual canonical flag;
  non-canonical rows are removed by Ponder's native reorg rollback, so the read
  interface never exposes them.
- No rate truth is stored here. A full Ponder reindex reconstructs the entire
  marker history purely from logs.

### Operational note

`startBlock` in `ponder.config.ts` must be at or below the first
`BridgeToEvm` ever emitted; otherwise historical markers would be missing.
Markers are re-derivable on reindex, so lowering `startBlock` and reindexing
once is a safe one-time correction if needed.
