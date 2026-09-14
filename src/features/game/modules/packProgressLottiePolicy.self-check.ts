/**
 * Offline invariants for pack-progress card-countdown Lottie play policy.
 * Run: npx tsx src/features/game/modules/packProgressLottiePolicy.self-check.ts
 */
import {
  initialCardCountdownPlayKey,
  shouldAutoplayCardCountdown,
  shouldFreezeCardCountdownOnLoad,
} from "./packProgressLottiePolicy";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  initialCardCountdownPlayKey(1) === 0,
  "first card mount stays static (playKey 0)",
);
assert(
  initialCardCountdownPlayKey(2) === 1,
  "HUD remount mid-pack must start with playKey > 0",
);
assert(
  shouldAutoplayCardCountdown(0) === false,
  "playKey 0 does not autoplay",
);
assert(
  shouldAutoplayCardCountdown(1) === true,
  "playKey > 0 autoplays",
);
assert(
  shouldFreezeCardCountdownOnLoad(false) === true,
  "idle load freezes at frame 0 via stop/pause",
);
assert(
  shouldFreezeCardCountdownOnLoad(true) === false,
  "play load must not stop() — that cancels autoplay",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "static first-card mount; remount mid-pack autoplays; stop only when idle",
    },
    null,
    2,
  ),
);
