// Shared, pure bridge-rate correction (#24 §3).
//
// This module is intentionally dependency-free (no ponder / viem / DB imports)
// so it can be lifted into a git-ref'd TS package and imported by REST + the WS
// DO at one pinned ref, producing an identical corrected rate for a given
// `(token, block)`. The function never queries a DB: callers do the bulk reads
// and pass the markers at/near `targetBlock`.

/**
 * Bounded lookback, in distinct sampled blocks (NOT raw chain height). If the
 * hold chain exceeds this many consecutive bridge blocks, there is no trusted
 * predecessor within the window and the result is `unavailable`.
 */
export const DEFAULT_K = 8;

export type CorrectionStatus = "corrected" | "raw" | "unavailable";

/** A `BridgeToEvm` marker near the target block. Only the block number matters here. */
export interface Marker {
  blockNumber: bigint;
}

export interface CorrectionResult {
  /**
   * The corrected rate. For `unavailable` this is the raw value — present but
   * flagged untrusted, never silently computed from a partial chain.
   */
  rate: bigint;
  status: CorrectionStatus;
  /** Whether a bridge marker forced a hold of the previous corrected rate. */
  held: boolean;
  /**
   * Number of consecutive held blocks ending at this one (0 when not held).
   * Chains across consecutive bridge blocks; used to enforce `K` and to emit
   * K-exceeded telemetry from the caller.
   */
  holdDepth: number;
}

export interface CorrectOptions {
  /** Bounded lookback in distinct sampled blocks. Defaults to {@link DEFAULT_K}. */
  K?: number;
  /**
   * Global committed correctness boundary (`indexed_through_block`). When
   * provided and `targetBlock > watermark` the block is not yet marker-complete,
   * so the result is `raw`. When omitted, the caller is responsible for the
   * watermark gate.
   */
  watermark?: bigint;
}

/**
 * Hold predicate: a bridge marker at `targetBlock` or `targetBlock - 1` makes
 * the raw rate untrustworthy (the RPC returns an incorrect rate in the block
 * following a bridge). Mirrors the live `>= blockNumber - 1` rule, but evaluated
 * against marker *history* for the target block rather than the live scalar.
 */
const hasHoldMarker = (targetBlock: bigint, markers: Marker[]): boolean =>
  markers.some(
    (m) => m.blockNumber === targetBlock || m.blockNumber === targetBlock - 1n
  );

/**
 * Pure bridge-rate correction.
 *
 * @param targetBlock        Block the corrected rate is wanted for.
 * @param rawRate            Raw (uncorrected) rate sampled at `targetBlock`.
 * @param prevCorrectedRate  The previous *distinct* sampled block's correction
 *                           result, or `null` at the start of a chain. Carrying
 *                           the full result (not just the rate) is what lets the
 *                           hold chain across consecutive bridge blocks and lets
 *                           `K` exhaustion propagate as `unavailable`.
 * @param markers            Markers at/near `targetBlock` (the caller bulk-reads
 *                           at most `K` sampled blocks; this fn never queries).
 * @param opts               Optional `K` override and committed `watermark`.
 */
export function correct(
  targetBlock: bigint,
  rawRate: bigint,
  prevCorrectedRate: CorrectionResult | null,
  markers: Marker[],
  opts: CorrectOptions = {}
): CorrectionResult {
  const K = opts.K ?? DEFAULT_K;
  // Guard the bounded-lookback bound: a NaN / Infinity / negative K would make
  // `holdDepth > K` silently never trip, corrupting the correctness guarantee.
  if (!Number.isInteger(K) || K < 0) {
    throw new Error("correct(): opts.K must be a non-negative integer");
  }

  // Marker-completeness gate: a target above the committed watermark is not yet
  // marker-complete (a necessary condition for correction), so surface `raw`.
  if (opts.watermark !== undefined && targetBlock > opts.watermark) {
    return { rate: rawRate, status: "raw", held: false, holdDepth: 0 };
  }

  // No marker ⇒ the raw rate is trustworthy at a marker-complete block.
  if (!hasHoldMarker(targetBlock, markers)) {
    return { rate: rawRate, status: "corrected", held: false, holdDepth: 0 };
  }

  // A bridge marker holds: carry the previous distinct block's corrected rate.
  const holdDepth = (prevCorrectedRate?.holdDepth ?? 0) + 1;

  // Bounded lookback: with no trusted predecessor (chain start, predecessor not
  // itself corrected, or chain longer than K) there is nothing safe to hold —
  // `unavailable`, rate present but flagged untrusted (the raw value).
  if (
    prevCorrectedRate === null ||
    prevCorrectedRate.status !== "corrected" ||
    holdDepth > K
  ) {
    return { rate: rawRate, status: "unavailable", held: true, holdDepth };
  }

  return {
    rate: prevCorrectedRate.rate,
    status: "corrected",
    held: true,
    holdDepth,
  };
}

/** One sampled rate observation in the canonical `token_snapshots` sequence. */
export interface RateSample {
  /**
   * Position in the canonical `token_snapshots` sampled-block sequence. Must be
   * strictly consecutive across the window (each `prev.ordinal + 1`) so the
   * bounded lookback counts true sampled-block distance, not array position — a
   * window that skips a canonical row would otherwise under-count the hold chain
   * and return a different rate than the complete window for the same block.
   */
  ordinal: bigint;
  block: bigint;
  rawRate: bigint;
  markers: Marker[];
}

/**
 * Correct an ordered window of sampled rates, performing the bounded predecessor
 * lookup internally so callers cannot supply a divergent `prevCorrectedRate`.
 *
 * Determinism contract: `samples` MUST be a **complete, contiguous** slice of the
 * canonical `token_snapshots` sampled-block sequence — strictly ascending by
 * `block` and strictly consecutive by `ordinal` (no skipped rows). Both are
 * enforced (throws otherwise), because the bounded lookback `K` counts distinct
 * sampled blocks: a gappy window would under-count the hold chain and diverge
 * from the complete window. Given a complete window, a corrected rate at block B
 * depends only on the run of held blocks back to the nearest clean anchor (within
 * `K`), so the result for a given `(token, block)` is identical across REST and
 * the WS DO regardless of how often each polls, as long as the window reaches
 * that anchor. A window that starts mid-hold-chain yields `unavailable` for the
 * leading blocks — the same K-exhaustion semantics as a chain with no trusted
 * predecessor; never a silently mis-anchored value.
 *
 * Returns one {@link CorrectionResult} per input sample, in the same order.
 */
export function correctSeries(
  samples: RateSample[],
  opts: CorrectOptions = {}
): CorrectionResult[] {
  const out: CorrectionResult[] = [];
  let prev: CorrectionResult | null = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    if (i > 0) {
      const p = samples[i - 1]!;
      if (s.block <= p.block) {
        throw new Error(
          "correctSeries(): samples must be strictly ascending by block"
        );
      }
      if (s.ordinal !== p.ordinal + 1n) {
        throw new Error(
          "correctSeries(): samples must be a complete contiguous canonical window (consecutive ordinals)"
        );
      }
    }
    const result = correct(s.block, s.rawRate, prev, s.markers, opts);
    out.push(result);
    prev = result;
  }
  return out;
}
