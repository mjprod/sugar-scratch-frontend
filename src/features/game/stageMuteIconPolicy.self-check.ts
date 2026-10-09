/**
 * Mute-icon policy: hub countdown unlock must not fake "sound on" while the
 * theme intro is still autoplay-muted.
 * Run: npx tsx src/features/game/stageMuteIconPolicy.self-check.ts
 */
import { stageMuteIconShowsSoundOn } from "./stageMuteIconPolicy";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  stageMuteIconShowsSoundOn({
    liveAudioOn: true,
    prefsSoundOn: false,
    introNeedsGestureUnlock: true,
  }),
  "live audio wins even when prefs say off",
);

assert(
  !stageMuteIconShowsSoundOn({
    liveAudioOn: false,
    prefsSoundOn: false,
    introNeedsGestureUnlock: false,
  }),
  "prefs off → muted icon",
);

assert(
  !stageMuteIconShowsSoundOn({
    liveAudioOn: false,
    prefsSoundOn: true,
    introNeedsGestureUnlock: true,
  }),
  "prefs on + intro still needs unlock → muted icon (hub Play case)",
);

assert(
  stageMuteIconShowsSoundOn({
    liveAudioOn: false,
    prefsSoundOn: true,
    introNeedsGestureUnlock: false,
  }),
  "prefs on + intro unlocked (or no intro) → unmuted icon",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "introNeedsGestureUnlock forces muted icon; countdown unlock alone does not",
    },
    null,
    2,
  ),
);
