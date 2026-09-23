/**
 * Offline invariants for cursor-FX celebrate milestones + mobile defaults.
 * Run: npx tsx src/features/game/modules/cursorFxCelebrate.self-check.ts
 */
import {
  celebrateParticleBoost,
  crossedProgressMilestone,
  CURSOR_FX_EMIT_MODE,
  CURSOR_FX_FALL_GRAVITY,
  CURSOR_FX_FALL_VELOCITY,
  CURSOR_FX_MILESTONE,
  cursorFxSpawnVelocity,
  progressMilestoneIndex,
  resolveCursorFxDeviceProfile,
} from "./cursorFxCelebrate";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(CURSOR_FX_MILESTONE === 0.1, "10% milestone step");
assert(progressMilestoneIndex(0) === 0, "zero progress");
assert(progressMilestoneIndex(0.09) === 0, "under 10%");
assert(progressMilestoneIndex(0.1) === 1, "exactly 10%");
assert(progressMilestoneIndex(0.29) === 2, "29% → band 2");
assert(progressMilestoneIndex(1) === 10, "fully scratched");

assert(
  crossedProgressMilestone(0.05, 0.12) === 1,
  "crossing 10% celebrates",
);
assert(
  crossedProgressMilestone(0.12, 0.15) === null,
  "same band does not re-fire",
);
assert(
  crossedProgressMilestone(0.19, 0.25) === 2,
  "crossing 20% celebrates",
);
assert(
  crossedProgressMilestone(0.95, 1) === 10,
  "crossing 100% celebrates",
);

{
  const desktop = resolveCursorFxDeviceProfile({
    reducedMotion: false,
    coarsePointer: false,
    narrowViewport: false,
  });
  assert(desktop.fairyDust && desktop.maxOverlayDpr >= 2, "desktop richer");

  const mobile = resolveCursorFxDeviceProfile({
    reducedMotion: false,
    coarsePointer: true,
    narrowViewport: true,
  });
  assert(mobile.maxOverlayDpr === 1, "mobile overlay DPR capped");
  assert(mobile.particleCount < desktop.particleCount, "mobile fewer particles");
  assert(mobile.particleSize <= desktop.particleSize, "mobile particles not larger");

  const reduced = resolveCursorFxDeviceProfile({
    reducedMotion: true,
    coarsePointer: false,
    narrowViewport: false,
  });
  assert(!reduced.fairyDust, "reduced-motion disables dust");
}

assert(celebrateParticleBoost(5) >= 5, "boost does not shrink");
assert(celebrateParticleBoost(5) <= 12, "desktop boost hard-capped");
assert(celebrateParticleBoost(1, true) <= 2, "coarse boost stays minimal");

assert(CURSOR_FX_EMIT_MODE === "fall", "product emit is fall (not fireworks)");
assert(CURSOR_FX_FALL_GRAVITY > 0.1, "fall gravity stronger than old fountain");
assert(CURSOR_FX_FALL_VELOCITY.min > 0, "fall speed positive");
assert(
  CURSOR_FX_FALL_VELOCITY.max >= CURSOR_FX_FALL_VELOCITY.min,
  "fall velocity range ordered",
);

{
  let fallDown = 0;
  let fountainUp = 0;
  for (let i = 0; i < 40; i += 1) {
    const fall = cursorFxSpawnVelocity("fall", CURSOR_FX_FALL_VELOCITY, () =>
      (i % 10) / 10,
    );
    assert(fall.vy > 0, `fall spawn #${i} must go down`);
    fallDown += fall.vy;
    const fountain = cursorFxSpawnVelocity(
      "fountain",
      { min: 0.5, max: 1.5 },
      () => (i % 10) / 10,
    );
    assert(fountain.vy <= 0, `fountain spawn #${i} must go up or stay`);
    fountainUp += fountain.vy;
  }
  assert(fallDown > 0, "fall sample accumulates downward speed");
  assert(fountainUp <= 0, "fountain sample never goes down initially");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "celebrate ~1.1s desktop / ~2.4s coarse each 10%; coins fall like foil flakes (not fireworks); mobile 1 particle for perf; reduced-motion off",
    },
    null,
    2,
  ),
);
