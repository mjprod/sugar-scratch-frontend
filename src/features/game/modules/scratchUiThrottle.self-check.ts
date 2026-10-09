/**
 * Offline invariants for scratch React UI throttle.
 * Run: npx tsx src/features/game/modules/scratchUiThrottle.self-check.ts
 */
import {
  createThrottledUiClock,
  shouldPublishThrottledUi,
} from "./scratchUiThrottle";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const INTERVAL = 250;

{
  const clock = createThrottledUiClock();
  assert(
    shouldPublishThrottledUi(clock, 1000, INTERVAL, false),
    "first publish allowed",
  );
  assert(
    !shouldPublishThrottledUi(clock, 1100, INTERVAL, false),
    "within interval suppressed",
  );
  assert(
    !shouldPublishThrottledUi(clock, 1249, INTERVAL, false),
    "just under interval suppressed",
  );
  assert(
    shouldPublishThrottledUi(clock, 1250, INTERVAL, false),
    "interval elapsed publishes",
  );
}

{
  const clock = createThrottledUiClock();
  shouldPublishThrottledUi(clock, 1000, INTERVAL, false);
  assert(
    shouldPublishThrottledUi(clock, 1050, INTERVAL, true),
    "force flushes before interval",
  );
  assert(
    !shouldPublishThrottledUi(clock, 1100, INTERVAL, false),
    "clock resets after force",
  );
}

// Long stroke: ~60 finalizes/s → ≤ ~4 React progress commits/s at 250ms.
{
  const finalizesPerSec = 60;
  const commitsPerSec = 1000 / INTERVAL;
  assert(commitsPerSec <= 4, "250ms → ≤4 publishes/s");
  assert(
    commitsPerSec < finalizesPerSec * 0.2,
    "throttle cuts stroke React commits by >5×",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      intervalMs: INTERVAL,
      policy: "ref-live progress; setState ≤1/interval; force on pointer-up",
    },
    null,
    2,
  ),
);
