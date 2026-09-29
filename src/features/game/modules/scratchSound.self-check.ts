/**
 * Offline invariants for scratch SFX helpers.
 * Run: npx tsx src/features/game/modules/scratchSound.self-check.ts
 *
 * Web Audio isn't available in Node — we assert the tier policy and that the
 * play/stop API is a safe no-op without an AudioContext.
 */
import {
  SCRATCH_SOUND_LONG_AFTER_MS,
  SCRATCH_SOUND_MEDIUM_AFTER_MS,
  SCRATCH_SOUND_TIERS,
  noteScratchSoundActivity,
  preloadScratchSounds,
  scratchSoundTier,
  stopScratchSounds,
} from "./scratchSound";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(scratchSoundTier(0) === "short", "stroke opens on a short clip");
assert(
  scratchSoundTier(SCRATCH_SOUND_MEDIUM_AFTER_MS - 1) === "short",
  "short until the medium threshold",
);
assert(
  scratchSoundTier(SCRATCH_SOUND_MEDIUM_AFTER_MS) === "medium",
  "medium at the medium threshold",
);
assert(
  scratchSoundTier(SCRATCH_SOUND_LONG_AFTER_MS) === "long",
  "long at the long threshold",
);
assert(
  SCRATCH_SOUND_MEDIUM_AFTER_MS < SCRATCH_SOUND_LONG_AFTER_MS,
  "tiers escalate",
);

for (const [tier, srcs] of Object.entries(SCRATCH_SOUND_TIERS)) {
  assert(srcs.length > 0, `${tier} tier has clips`);
  for (const src of srcs) {
    assert(
      src.startsWith("/sfx/") && src.endsWith(".mp3"),
      `${src} path (outside the dev-proxied prefixes)`,
    );
    assert(src.includes(`_${tier}_`), `${src} filed under ${tier}`);
  }
}

// Safe in Node (no AudioContext) — must not throw.
preloadScratchSounds();
noteScratchSoundActivity(0);
noteScratchSoundActivity(SCRATCH_SOUND_LONG_AFTER_MS);
stopScratchSounds();
stopScratchSounds();

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "stroke → short clip, chained medium after 1s, long after 2.8s; lift/idle/mute → fade out",
    },
    null,
    2,
  ),
);
