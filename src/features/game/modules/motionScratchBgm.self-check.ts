/**
 * Offline invariants for motion-scratch looped BGM helpers.
 * Run: npx tsx src/features/game/modules/motionScratchBgm.self-check.ts
 */

import {
  MOTION_SCRATCH_BGM_BED_GAIN,
  MOTION_SCRATCH_BGM_BED_TO_FULL_MS,
  MOTION_SCRATCH_BGM_FADE_IN_MS,
  MOTION_SCRATCH_BGM_FADE_OUT_MS,
  MOTION_SCRATCH_BGM_FULL_GAIN,
  MOTION_SCRATCH_BGM_SRC,
  isMotionScratchBgmPlaying,
  preloadMotionScratchBgm,
  setMotionScratchBgmActive,
  setMotionScratchBgmBed,
  setMotionScratchBgmFull,
  stopMotionScratchBgm,
  syncMotionScratchBgm,
  unlockMotionScratchBgm,
} from "./motionScratchBgm";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  MOTION_SCRATCH_BGM_SRC.startsWith("/bgm/"),
  "BGM must live under /bgm (Vite proxies /sounds to media host)",
);
assert(
  MOTION_SCRATCH_BGM_SRC.endsWith(".mp3"),
  "BGM src should be an mp3 path",
);
assert(MOTION_SCRATCH_BGM_FADE_IN_MS > 0, "fade-in ms");
assert(MOTION_SCRATCH_BGM_FADE_OUT_MS > 0, "fade-out ms");
assert(MOTION_SCRATCH_BGM_BED_TO_FULL_MS > 0, "bed→full ms");
assert(
  MOTION_SCRATCH_BGM_BED_GAIN > 0 &&
    MOTION_SCRATCH_BGM_BED_GAIN < MOTION_SCRATCH_BGM_FULL_GAIN,
  "bed gain must be quieter than full",
);
assert(typeof setMotionScratchBgmActive === "function", "setMotionScratchBgmActive export");
assert(typeof setMotionScratchBgmBed === "function", "setMotionScratchBgmBed export");
assert(typeof setMotionScratchBgmFull === "function", "setMotionScratchBgmFull export");
assert(typeof stopMotionScratchBgm === "function", "stopMotionScratchBgm export");
assert(typeof syncMotionScratchBgm === "function", "syncMotionScratchBgm export");
assert(typeof preloadMotionScratchBgm === "function", "preloadMotionScratchBgm export");
assert(typeof unlockMotionScratchBgm === "function", "unlockMotionScratchBgm export");
assert(typeof isMotionScratchBgmPlaying === "function", "isMotionScratchBgmPlaying export");

// Safe in Node (no AudioContext) — must not throw.
stopMotionScratchBgm({ fadeOutMs: 0 });
unlockMotionScratchBgm();
preloadMotionScratchBgm();
setMotionScratchBgmBed({ fadeInMs: 100 });
syncMotionScratchBgm({ targetGain: MOTION_SCRATCH_BGM_BED_GAIN, fadeInMs: 100 });
setMotionScratchBgmFull({ fadeInMs: 100 });
assert(
  isMotionScratchBgmPlaying() === false,
  "Node has no audio context — playing must be false",
);
setMotionScratchBgmActive(false, { fadeOutMs: 0 });
stopMotionScratchBgm({ fadeOutMs: 0 });

console.log("motionScratchBgm.self-check: ok");
