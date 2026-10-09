/**
 * Pure frame-timing stats for the `?perf=1` HUD. No DOM access here so it
 * can be exercised from `perfStats.self-check.ts`.
 */

export const PERF_QUERY_KEY = "perf";
export const PERF_STORAGE_KEY = "sugar.perfHud";

/** ~10 s at 60 Hz / ~5 s at 120 Hz. */
export const FRAME_WINDOW = 600;
/** Frame took longer than two 60 Hz vsyncs. */
export const SLOW_FRAME_MS = 34;
/** Visible hitch (matches the long-task threshold). */
export const LONG_FRAME_MS = 50;
/** Gaps this large are tab switches / backgrounding, not jank. */
export const MAX_FRAME_GAP_MS = 1000;

export type PerfToggleStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * `?perf=1` (or bare `?perf`) turns the HUD on and remembers it across
 * client-side navigation; `?perf=0` turns it off.
 */
export function resolvePerfHudEnabled(
  search: string,
  store: PerfToggleStore | null,
): boolean {
  const value = new URLSearchParams(search).get(PERF_QUERY_KEY);
  try {
    if (value !== null) {
      const on = value !== "0" && value !== "false" && value !== "off";
      if (on) store?.setItem(PERF_STORAGE_KEY, "1");
      else store?.removeItem(PERF_STORAGE_KEY);
      return on;
    }
    return store?.getItem(PERF_STORAGE_KEY) === "1";
  } catch {
    return value !== null && value !== "0";
  }
}

/** Nearest-rank percentile over an ascending-sorted array. */
export function percentile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const rank = Math.ceil((Math.min(Math.max(p, 0), 100) / 100) * n);
  return sorted[Math.min(n - 1, Math.max(0, rank - 1))];
}

export type FrameSnapshot = {
  fps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
  totalFrames: number;
  slowFrames: number;
  longFrames: number;
  elapsedMs: number;
};

/** Fixed-size ring of frame intervals; allocation-free on the hot path. */
export class FrameStats {
  private readonly ring: Float64Array;
  private readonly scratch: Float64Array;
  private count = 0;
  private next = 0;
  private totalFrames = 0;
  private slowFrames = 0;
  private longFrames = 0;
  private worstMs = 0;
  private elapsedMs = 0;

  constructor(size = FRAME_WINDOW) {
    this.ring = new Float64Array(size);
    this.scratch = new Float64Array(size);
  }

  push(deltaMs: number): void {
    if (!(deltaMs > 0) || deltaMs > MAX_FRAME_GAP_MS) return;
    this.ring[this.next] = deltaMs;
    this.next = (this.next + 1) % this.ring.length;
    if (this.count < this.ring.length) this.count += 1;
    this.totalFrames += 1;
    this.elapsedMs += deltaMs;
    if (deltaMs > SLOW_FRAME_MS) this.slowFrames += 1;
    if (deltaMs > LONG_FRAME_MS) this.longFrames += 1;
    if (deltaMs > this.worstMs) this.worstMs = deltaMs;
  }

  reset(): void {
    this.count = 0;
    this.next = 0;
    this.totalFrames = 0;
    this.slowFrames = 0;
    this.longFrames = 0;
    this.worstMs = 0;
    this.elapsedMs = 0;
  }

  /** Most recent `limit` intervals, oldest first. */
  recent(limit: number, out: Float64Array): number {
    const n = Math.min(limit, this.count, out.length);
    const size = this.ring.length;
    for (let i = 0; i < n; i += 1) {
      out[i] = this.ring[(this.next - n + i + size) % size];
    }
    return n;
  }

  snapshot(): FrameSnapshot {
    const n = this.count;
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      this.scratch[i] = this.ring[i];
      sum += this.ring[i];
    }
    const sorted = this.scratch.subarray(0, n).sort();
    return {
      fps: sum > 0 ? (n * 1000) / sum : 0,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      worstMs: this.worstMs,
      totalFrames: this.totalFrames,
      slowFrames: this.slowFrames,
      longFrames: this.longFrames,
      elapsedMs: this.elapsedMs,
    };
  }
}
