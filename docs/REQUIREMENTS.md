# Requirements

Functional requirements for the Bounce data service. Each entry states *what*
the behaviour is and *why*, in product terms.

## Bridge-rate correction — shared `correct()` (#24 §3)

**Why.** The live `leveragedToken.exchangeRate` scalar is unreliable in the block
that follows a `BridgeToEvm` event: the RPC returns an incorrect rate for that
block. Serving it directly produces wrong prices and wrong historical change
percentages. Both the REST API and the WebSocket feed must apply the *same*
correction so a given `(token, block)` resolves to an identical corrected rate.

**What.** A single pure function corrects a sampled rate against bridge markers:

- **Signature:** `correct(targetBlock, rawRate, prevCorrectedRate, markers[], opts?)`.
  It is pure and never queries a database — callers do the bulk reads and pass
  the markers at/near `targetBlock`.
- **Hold predicate:** if a bridge marker exists at `targetBlock` or
  `targetBlock - 1`, the raw rate is untrusted and the previous distinct block's
  corrected rate is held. With no such marker the raw rate is used as-is.
- **Chaining:** `prevCorrectedRate` is the previous distinct sampled block's
  correction result, so a hold chains across consecutive bridge blocks.
- **Bounded lookback `K` (default 8 distinct sampled blocks):** if the hold chain
  exceeds `K`, there is no trusted predecessor within the window. The result is
  `unavailable` with the rate field present but flagged untrusted (the raw
  value) — never silently computed from a partial chain.
- **Marker-completeness:** when a committed `watermark` is supplied and
  `targetBlock > watermark`, the block is not yet marker-complete and the result
  is `raw`. `targetBlock <= watermark` is a necessary (not sufficient) condition
  for `corrected`: `K` exhaustion can still make a marker-complete block
  `unavailable`.
- **Status surface:** every result carries `status` (`corrected` | `raw` |
  `unavailable`), `held`, and `holdDepth` so callers can gate serving and emit
  K-exceeded telemetry.

**Determinism contract.** A given `(token, block)` resolves to an identical
corrected rate across REST and the WS DO only when both fold over the *same*
canonical `token_snapshots` sampled-block sequence. To make this enforceable
rather than caller discipline, `correctSeries(samples, opts?)` takes that ordered
window and performs the bounded predecessor lookup internally — callers cannot
supply a divergent `prevCorrectedRate`. It requires a **complete, contiguous**
slice of the canonical sequence: strictly ascending by `block` and strictly
consecutive by `ordinal` (rejects gaps, reversal, and duplicates), because the
bounded lookback `K` counts distinct sampled blocks — a window that skips a
canonical row would under-count the hold chain and diverge from the complete
window. Given a complete window, a corrected rate at block B depends only on the
run of held blocks back to the nearest clean anchor (within `K`), so any window
that reaches that anchor agrees on B regardless of polling cadence; a window
starting mid-hold-chain yields `unavailable`, never a wrong number.

**Packaging.** The function lives in `src/correction/` and is intentionally
dependency-free so it can be lifted into a git-ref'd TS package imported by REST
and the WS DO at one pinned ref. (Package extraction and the consumer repoint are
tracked separately — #53 §4.)
