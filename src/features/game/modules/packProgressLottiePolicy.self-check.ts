/**
 * Offline invariants for pack-progress card-countdown Lottie play policy.
 * Run: npx tsx src/features/game/modules/packProgressLottiePolicy.self-check.ts
 */
import {
  claimPackProgressLottieHook,
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

{
  const state: { __packProgressHooked?: boolean } = {};
  assert(
    claimPackProgressLottieHook(state) === true,
    "first claim wires load/play hooks",
  );
  assert(
    claimPackProgressLottieHook(state) === false,
    "re-invoke must not re-attach load or re-play",
  );
  assert(
    state.__packProgressHooked === true,
    "instance stays marked hooked",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "static first-card mount; remount mid-pack autoplays; stop only when idle; hook once per instance",
    },
    null,
    2,
  ),
);
