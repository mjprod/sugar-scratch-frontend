/**
 * Perf HUD stats self-check.
 * Run: npx tsx src/lib/perf/perfStats.self-check.ts
 */
import {
  FrameStats,
  MAX_FRAME_GAP_MS,
  PERF_STORAGE_KEY,
  percentile,
  resolvePerfHudEnabled,
  type PerfToggleStore,
} from "./perfStats.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function near(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function memoryStore(): PerfToggleStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

// percentile
assert(percentile([], 99) === 0, "empty percentile is 0");
assert(percentile([5], 50) === 5, "single value");
const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
assert(percentile(hundred, 50) === 50, "p50 of 1..100");
assert(percentile(hundred, 99) === 99, "p99 of 1..100");
assert(percentile(hundred, 100) === 100, "p100 is max");

// toggle
{
  const store = memoryStore();
  assert(!resolvePerfHudEnabled("", store), "off by default");
  assert(resolvePerfHudEnabled("?perf=1", store), "?perf=1 enables");
  assert(store.data.get(PERF_STORAGE_KEY) === "1", "enable persists");
  assert(resolvePerfHudEnabled("?foo=bar", store), "persists across navigation");
  assert(!resolvePerfHudEnabled("?perf=0", store), "?perf=0 disables");
  assert(!store.data.has(PERF_STORAGE_KEY), "disable clears storage");
  assert(resolvePerfHudEnabled("?perf", store), "bare ?perf enables");
  assert(resolvePerfHudEnabled("?perf=1", null), "works without storage");
}

// frame stats
{
  const stats = new FrameStats(10);
  for (let i = 0; i < 10; i += 1) stats.push(1000 / 60);
  const steady = stats.snapshot();
  assert(near(steady.fps, 60, 1e-6), "steady 60 fps");
  assert(steady.slowFrames === 0 && steady.longFrames === 0, "no jank at 60 fps");

  stats.push(40);
  stats.push(80);
  const janky = stats.snapshot();
  assert(janky.slowFrames === 2, "40 ms and 80 ms are slow");
  assert(janky.longFrames === 1, "only 80 ms is long");
  assert(janky.worstMs === 80, "worst tracked");
  assert(janky.p99Ms === 80, "p99 picks the hitch");
  assert(janky.totalFrames === 12, "total counts beyond ring size");

  const before = stats.snapshot().totalFrames;
  stats.push(MAX_FRAME_GAP_MS + 1);
  stats.push(0);
  stats.push(Number.NaN);
  assert(stats.snapshot().totalFrames === before, "tab-switch gaps ignored");

  const out = new Float64Array(3);
  const n = stats.recent(3, out);
  assert(n === 3 && out[1] === 40 && out[2] === 80, "recent is oldest-first");

  stats.reset();
  const cleared = stats.snapshot();
  assert(cleared.totalFrames === 0 && cleared.fps === 0 && cleared.worstMs === 0, "reset clears");
}

console.log("perfStats self-check OK");
