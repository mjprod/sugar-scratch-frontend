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
const DUCK = 0.22;

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

// --- foil + docked: same on level (no quiet bed / step-up) ---
assert(plan(true, "center").level === "on", "center must play");
assert(plan(true, "docked").level === "on", "docked must play");
assert(plan(true, "center", true).level === "on", "skipToPlay plays");
assert(plan(true, "docked", true).level === "on", "skipToPlay plays when docked");

// --- showcase fades the loop out before win/nowin ---
assert(plan(true, "showcase").level === "off", "showcase must stop (fade)");
assert(
  plan(true, "showcase", true).level === "on",
  "lab skipToPlay keeps BGM through showcase",
);

// --- ducking never raises the level and caps at the duck gain ---
assert(resolveMotionScratchBgmGain(1, false, DUCK) === 1, "unducked full stays full");
assert(resolveMotionScratchBgmGain(1, true, DUCK) === DUCK, "ducked full drops to duck");
assert(
  resolveMotionScratchBgmGain(0.1, true, DUCK) === 0.1,
  "ducking must not raise a level already under the duck gain",
);
for (const g of [0, 0.1, DUCK, 0.5, 1]) {
  assert(
    resolveMotionScratchBgmGain(g, true, DUCK) <= DUCK,
    `ducked gain must never exceed the duck gain (${g})`,
  );
}

console.log("motionScratchBgmPolicy.self-check: ok");
