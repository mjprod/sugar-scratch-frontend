/**
 * Offline invariants for cursor-FX celebrate milestones + mobile defaults.
 * Run: npx tsx src/features/game/modules/cursorFxCelebrate.self-check.ts
 */
import {
  celebrateParticleBoost,
  crossedProgressMilestone,
  CURSOR_FX_MILESTONE,
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
  assert(mobile.particleSize >= desktop.particleSize, "mobile particles at least as large");
  assert(mobile.particleCount >= desktop.particleCount, "mobile celebrate density matches desktop");

  const reduced = resolveCursorFxDeviceProfile({
    reducedMotion: true,
    coarsePointer: false,
    narrowViewport: false,
  });
  assert(!reduced.fairyDust, "reduced-motion disables dust");
}

assert(celebrateParticleBoost(5) >= 5, "boost does not shrink");
assert(celebrateParticleBoost(5) <= 18, "boost hard-capped");
assert(celebrateParticleBoost(6) >= 12, "mobile base boosts to a dense burst");

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "celebrate ~1.1s desktop / ~2.4s coarse each 10%; mobile larger particles; reduced-motion off",
    },
    null,
    2,
  ),
);
