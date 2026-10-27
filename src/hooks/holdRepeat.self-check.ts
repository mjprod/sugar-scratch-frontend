/**
 * Hold-repeat: first press fires immediately, then interval until stop.
 * Run: npx tsx src/hooks/holdRepeat.self-check.ts
 */
import {
  HOLD_REPEAT_DELAY_MS,
  HOLD_REPEAT_INTERVAL_MS,
  createHoldRepeat,
} from "./holdRepeat.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const queued: Array<() => void> = [];
const intervals: Array<() => void> = [];
const savedTimeout = globalThis.setTimeout;
const savedInterval = globalThis.setInterval;
const savedClearTimeout = globalThis.clearTimeout;
const savedClearInterval = globalThis.clearInterval;

globalThis.setTimeout = ((fn: () => void) => {
  queued.push(fn);
  return 1;
}) as typeof setTimeout;
globalThis.setInterval = ((fn: () => void) => {
  intervals.push(fn);
  return 2;
}) as typeof setInterval;
globalThis.clearTimeout = (() => {
  queued.length = 0;
}) as typeof clearTimeout;
globalThis.clearInterval = (() => {
  intervals.length = 0;
}) as typeof clearInterval;

try {
  let n = 0;
  let disabled = false;
  const hold = createHoldRepeat(() => {
    n += 1;
  });

  hold.start(() => disabled);
  assert(n === 1, "start fires immediately");
  assert(queued.length === 1, "delay timer armed");
  queued[0]();
  assert(intervals.length === 1, "interval armed after delay");
  intervals[0]();
  intervals[0]();
  assert(n === 3, `repeat fires (got ${n})`);

  hold.stop();
  assert(intervals.length === 0, "stop clears the repeat interval");

  n = 0;
  disabled = true;
  hold.start(() => disabled);
  assert(n === 0, "start no-ops when disabled");

  assert(HOLD_REPEAT_DELAY_MS > HOLD_REPEAT_INTERVAL_MS / 2, "delay before burst");
  console.log("holdRepeat.self-check: ok");
} finally {
  globalThis.setTimeout = savedTimeout;
  globalThis.setInterval = savedInterval;
  globalThis.clearTimeout = savedClearTimeout;
  globalThis.clearInterval = savedClearInterval;
}
