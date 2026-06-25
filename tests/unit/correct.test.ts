import { describe, it, expect } from "vitest";
import {
  correct,
  correctSeries,
  DEFAULT_K,
  type CorrectionResult,
  type Marker,
  type RateSample,
} from "../../src/correction";

// Convenience: a "corrected, not held" predecessor at some rate.
const trusted = (rate: bigint): CorrectionResult => ({
  rate,
  status: "corrected",
  held: false,
  holdDepth: 0,
});

const marker = (blockNumber: bigint): Marker => ({ blockNumber });

describe("correct() — pure bridge-rate correction (#24 §3)", () => {
  it("no-marker: outputs the raw rate, status corrected", () => {
    const r = correct(100n, 500n, trusted(490n), []);
    expect(r).toEqual({ rate: 500n, status: "corrected", held: false, holdDepth: 0 });
  });

  it("bridge block: marker at targetBlock holds the previous corrected rate", () => {
    const r = correct(100n, 999n, trusted(490n), [marker(100n)]);
    expect(r.rate).toBe(490n); // raw 999n discarded
    expect(r.status).toBe("corrected");
    expect(r.held).toBe(true);
    expect(r.holdDepth).toBe(1);
  });

  it("next block: marker at targetBlock - 1 also holds (RPC lag after bridge)", () => {
    const r = correct(101n, 999n, trusted(490n), [marker(100n)]);
    expect(r.rate).toBe(490n);
    expect(r.held).toBe(true);
    expect(r.holdDepth).toBe(1);
  });

  it("gap/skip: a marker more than one block away does not hold", () => {
    const r = correct(102n, 500n, trusted(490n), [marker(100n)]);
    expect(r).toEqual({ rate: 500n, status: "corrected", held: false, holdDepth: 0 });
  });

  it("multi/duplicate markers in a block: holds exactly once", () => {
    const dupes = [marker(100n), marker(100n), marker(99n)];
    const r = correct(100n, 999n, trusted(490n), dupes);
    expect(r.rate).toBe(490n);
    expect(r.held).toBe(true);
    expect(r.holdDepth).toBe(1);
  });

  it("consecutive bridges: hold chains across blocks, carrying the pre-bridge rate", () => {
    // B0 clean, then B1, B2, B3 all bridge blocks — each holds B0's rate.
    let prev = correct(0n, 490n, null, []); // clean anchor
    expect(prev.status).toBe("corrected");

    const b1 = correct(1n, 111n, prev, [marker(1n)]);
    const b2 = correct(2n, 222n, b1, [marker(2n)]);
    const b3 = correct(3n, 333n, b2, [marker(3n)]);

    for (const [i, r] of [b1, b2, b3].entries()) {
      expect(r.rate).toBe(490n);
      expect(r.status).toBe("corrected");
      expect(r.holdDepth).toBe(i + 1);
    }
  });

  it("consecutive bridges beyond K: status flips to unavailable, raw value flagged", () => {
    let prev = correct(0n, 490n, null, []); // clean anchor, holdDepth 0
    let last = prev;
    // K consecutive bridge blocks remain corrected (holdDepth 1..K)...
    for (let i = 1n; i <= BigInt(DEFAULT_K); i++) {
      last = correct(i, 700n + i, prev, [marker(i)]);
      expect(last.status).toBe("corrected");
      expect(last.rate).toBe(490n);
      prev = last;
    }
    expect(last.holdDepth).toBe(DEFAULT_K);

    // ...the (K+1)th exceeds the lookback window → unavailable, raw present.
    const exceeded = correct(BigInt(DEFAULT_K) + 1n, 12345n, last, [
      marker(BigInt(DEFAULT_K) + 1n),
    ]);
    expect(exceeded.status).toBe("unavailable");
    expect(exceeded.rate).toBe(12345n); // raw, flagged untrusted
    expect(exceeded.holdDepth).toBe(DEFAULT_K + 1);
  });

  it("respects a configurable K override", () => {
    let prev = correct(0n, 490n, null, []);
    const b1 = correct(1n, 1n, prev, [marker(1n)]);
    const b2 = correct(2n, 2n, b1, [marker(2n)]); // holdDepth 2 > K=1
    expect(b1.status).toBe("corrected");
    expect(correct(2n, 2n, b1, [marker(2n)], { K: 1 }).status).toBe("unavailable");
    expect(b2.status).toBe("corrected"); // default K=8 still corrected
  });

  it("rejects an invalid K so the lookback guarantee cannot be bypassed", () => {
    for (const bad of [NaN, Infinity, -1, 1.5]) {
      expect(() => correct(1n, 1n, null, [], { K: bad })).toThrow(/opts\.K/);
    }
  });

  it("hold with no trusted predecessor is unavailable", () => {
    const r = correct(100n, 999n, null, [marker(100n)]);
    expect(r.status).toBe("unavailable");
    expect(r.rate).toBe(999n);
    expect(r.holdDepth).toBe(1);
  });

  it("hold propagates unavailable from a non-corrected predecessor", () => {
    const stale: CorrectionResult = {
      rate: 0n,
      status: "unavailable",
      held: true,
      holdDepth: DEFAULT_K + 1,
    };
    const r = correct(100n, 999n, stale, [marker(100n)]);
    expect(r.status).toBe("unavailable");
    expect(r.rate).toBe(999n);
  });

  describe("watermark gate (both sides)", () => {
    it("targetBlock > watermark ⇒ raw (not yet marker-complete)", () => {
      const r = correct(101n, 500n, trusted(490n), [marker(101n)], { watermark: 100n });
      expect(r).toEqual({ rate: 500n, status: "raw", held: false, holdDepth: 0 });
    });

    it("targetBlock <= watermark ⇒ correction applies (marker-complete)", () => {
      const r = correct(100n, 999n, trusted(490n), [marker(100n)], { watermark: 100n });
      expect(r.status).toBe("corrected");
      expect(r.rate).toBe(490n);
      expect(r.held).toBe(true);
    });

    it("at the watermark boundary a clean block is corrected", () => {
      const r = correct(100n, 500n, trusted(490n), [], { watermark: 100n });
      expect(r).toEqual({ rate: 500n, status: "corrected", held: false, holdDepth: 0 });
    });
  });

  describe("correctSeries() — canonical-window determinism (Codex P1/P2)", () => {
    // Canonical token_snapshots sequence. Sampled blocks are NOT consecutive
    // block numbers (sampled every ~tick), so `ordinal` — not block — is what the
    // bounded lookback counts. ord 0..1 clean, ord 2 clean anchor, ord 3..5 a
    // 3-sample bridge hold, ord 6 clean again.
    const canonical: RateSample[] = [
      { ordinal: 0n, block: 40n, rawRate: 480n, markers: [] },
      { ordinal: 1n, block: 70n, rawRate: 485n, markers: [] },
      { ordinal: 2n, block: 100n, rawRate: 490n, markers: [] }, // anchor
      { ordinal: 3n, block: 130n, rawRate: 111n, markers: [marker(130n)] },
      { ordinal: 4n, block: 160n, rawRate: 222n, markers: [marker(160n)] },
      { ordinal: 5n, block: 190n, rawRate: 333n, markers: [marker(190n)] },
      { ordinal: 6n, block: 220n, rawRate: 500n, markers: [] },
    ];
    const fromAnchor = canonical.slice(2); // ord 2..6

    it("folds the predecessor internally; hold chain carries the anchor rate", () => {
      const out = correctSeries(fromAnchor);
      expect(out.map((r) => r.rate)).toEqual([490n, 490n, 490n, 490n, 500n]);
      expect(out.map((r) => r.status)).toEqual([
        "corrected",
        "corrected",
        "corrected",
        "corrected",
        "corrected",
      ]);
      expect(out.map((r) => r.holdDepth)).toEqual([0, 1, 2, 3, 0]);
    });

    it("is cadence-independent: any complete window reaching the anchor agrees on a block", () => {
      // The corrected rate at block 190 (ord 5) is identical whether a consumer's
      // window starts at the clean anchor (ord 2) or earlier (ord 0).
      const at190FromAnchor = correctSeries(fromAnchor).find(
        (_, i) => fromAnchor[i]!.block === 190n
      )!;
      const full = correctSeries(canonical);
      const at190FromEarlier = full[5]!;
      expect(at190FromEarlier).toEqual(at190FromAnchor);
    });

    it("rejects a sparse window that skips a canonical row (P1 regression)", () => {
      // Dropping ord 4 leaves ords [2,3,5,6] — a gap. With a complete window
      // block 190 holds (depth 3); a gappy window would under-count and could
      // return a wrong rate, so it must be rejected outright.
      const sparse = [canonical[2]!, canonical[3]!, canonical[5]!, canonical[6]!];
      expect(() => correctSeries(sparse)).toThrow(/contiguous canonical window/);
    });

    it("a window starting mid-hold-chain (no anchor) is unavailable, never a wrong number", () => {
      const out = correctSeries(canonical.slice(3)); // starts at ord 3 (held)
      expect(out[0]!.status).toBe("unavailable");
      expect(out[0]!.rate).toBe(111n); // raw, flagged
    });

    it("rejects non-ascending and duplicate blocks (P2)", () => {
      const reversed = [...fromAnchor].reverse();
      expect(() => correctSeries(reversed)).toThrow(/ascending|contiguous/);
      const dup: RateSample[] = [
        { ordinal: 0n, block: 100n, rawRate: 1n, markers: [] },
        { ordinal: 1n, block: 100n, rawRate: 2n, markers: [] },
      ];
      expect(() => correctSeries(dup)).toThrow(/strictly ascending/);
    });
  });
});
