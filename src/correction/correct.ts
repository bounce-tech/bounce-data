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
