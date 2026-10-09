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
  SCRATCH_STALE_QUIET_MS,
  endScratchSoundStroke,
  nextScratchStaleState,
  noteScratchSoundActivity,
  noteScratchStamp,
  preloadScratchSounds,
  quietScratchSound,
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

{
  const fresh = nextScratchStaleState(true, 100, 500);
  assert(fresh.staleSince === null && !fresh.quiet, "fresh stamp clears the grace timer");

  const start = nextScratchStaleState(false, null, 1000);
  assert(start.staleSince === 1000 && !start.quiet, "first stale stamp starts the timer");

  const brief = nextScratchStaleState(false, 1000, 1000 + SCRATCH_STALE_QUIET_MS - 1);
  assert(!brief.quiet, "a quick pass over scratched fabric keeps the sound");

  const held = nextScratchStaleState(false, 1000, 1000 + SCRATCH_STALE_QUIET_MS);
  assert(held.quiet && held.staleSince === 1000, "lingering on scratched fabric quiets");
}

// Safe in Node (no AudioContext) — must not throw.
preloadScratchSounds();
noteScratchSoundActivity(0);
noteScratchSoundActivity(SCRATCH_SOUND_LONG_AFTER_MS);
endScratchSoundStroke();
noteScratchSoundActivity(0);
noteScratchStamp(true, 0);
noteScratchStamp(false, 10);
noteScratchStamp(false, 10 + SCRATCH_STALE_QUIET_MS);
quietScratchSound();
quietScratchSound();
stopScratchSounds();
stopScratchSounds();

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "stroke → short clip, chained medium after 1s, long after 2.8s; only fresh (unscratched) stamps keep clips going; ≥150ms on scratched fabric → fade; lift → clips ring out; mute/unmount → fade out",
    },
    null,
    2,
  ),
);
