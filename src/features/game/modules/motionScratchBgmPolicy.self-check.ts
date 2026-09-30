/**
 * Offline invariants for the motion-scratch BGM level policy.
 * Run: npx tsx src/features/game/modules/motionScratchBgmPolicy.self-check.ts
 */
import {
  resolveMotionScratchBgmGain,
  resolveMotionScratchBgmPlan,
} from "./motionScratchBgmPolicy";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const DOCK_MS = 720;
const BED = 0.22;

const plan = (
  warm: boolean,
  topBarPhase: "center" | "docked" | "showcase",
  skipToPlay = false,
) => resolveMotionScratchBgmPlan({ warm, topBarPhase, skipToPlay, dockMs: DOCK_MS });

// --- not warm always stops, whatever the bar is doing ---
for (const phase of ["center", "docked", "showcase"] as const) {
  assert(plan(false, phase).level === "off", `cold stage must stop (${phase})`);
  assert(
    plan(false, phase, true).level === "off",
    `cold stage must stop even with skipToPlay (${phase})`,
  );
}

// --- foil bar centered: quiet bed, no step-up ---
{
  const p = plan(true, "center");
  assert(p.level === "bed", "center must play the bed");
  assert(p.fullAfterMs == null, "center must not schedule full level");
}

// --- docked stays at the bed; the dock flight must not raise the music ---
{
  const p = plan(true, "docked");
  assert(p.level === "bed", "docked must stay at the bed");
  assert(p.fullAfterMs == null, "docked must not step up");
}

assert(plan(true, "center", true).level === "bed", "skipToPlay stays at the bed");
assert(plan(true, "docked", true).level === "bed", "skipToPlay stays at the bed when docked");

// --- showcase leaves the level alone ---
assert(plan(true, "showcase").level === "keep", "showcase must keep the level");

// --- ducking never raises the level and caps at the bed ---
assert(resolveMotionScratchBgmGain(1, false, BED) === 1, "unducked full stays full");
assert(resolveMotionScratchBgmGain(1, true, BED) === BED, "ducked full drops to bed");
assert(
  resolveMotionScratchBgmGain(0.1, true, BED) === 0.1,
  "ducking must not raise a level already under the bed",
);
for (const g of [0, 0.1, BED, 0.5, 1]) {
  assert(
    resolveMotionScratchBgmGain(g, true, BED) <= BED,
    `ducked gain must never exceed the bed (${g})`,
  );
}

console.log("motionScratchBgmPolicy.self-check: ok");
