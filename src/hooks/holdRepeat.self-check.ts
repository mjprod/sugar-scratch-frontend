/**
 * Hold-repeat: first press fires immediately, then accelerating timeouts until stop.
 * Run: npx tsx src/hooks/holdRepeat.self-check.ts
 */
import {
  HOLD_REPEAT_DELAY_MS,
  HOLD_REPEAT_INTERVAL_MS,
  HOLD_REPEAT_MIN_INTERVAL_MS,
  createHoldRepeat,
} from "./holdRepeat.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const queued: Array<() => void> = [];
const delays: number[] = [];
const savedTimeout = globalThis.setTimeout;
const savedClearTimeout = globalThis.clearTimeout;

globalThis.setTimeout = ((fn: () => void, ms?: number) => {
  queued.push(fn);
  delays.push(Number(ms ?? 0));
  return delays.length;
}) as typeof setTimeout;
globalThis.clearTimeout = (() => {
  queued.length = 0;
}) as typeof clearTimeout;

try {
  let n = 0;
  let disabled = false;
  const hold = createHoldRepeat(() => {
    n += 1;
  });

  hold.start(() => disabled);
  assert(n === 1, "start fires immediately");
  assert(queued.length === 1, "delay timer armed");
  assert(delays[0] === HOLD_REPEAT_DELAY_MS, "first wait is the delay");

  queued[0]();
  assert(n === 2, "first repeat fires after delay");
  assert(delays[1] === HOLD_REPEAT_INTERVAL_MS, "first repeat uses the start interval");

  queued[1]();
  queued[2]();
  assert(n === 4, `later repeats fire (got ${n})`);
  assert(delays[2]! < delays[1]!, "repeat interval speeds up");
  assert(delays[3]! < delays[2]!, "keeps speeding up");
  assert(
    delays[3]! >= HOLD_REPEAT_MIN_INTERVAL_MS,
    "does not drop below the floor",
  );

  hold.stop();
  assert(queued.length === 0, "stop clears the pending tick");

  n = 0;
  disabled = true;
  hold.start(() => disabled);
  assert(n === 0, "start no-ops when disabled");

  assert(HOLD_REPEAT_DELAY_MS > HOLD_REPEAT_INTERVAL_MS / 2, "delay before burst");
  console.log("holdRepeat.self-check: ok");
} finally {
  globalThis.setTimeout = savedTimeout;
  globalThis.clearTimeout = savedClearTimeout;
}
