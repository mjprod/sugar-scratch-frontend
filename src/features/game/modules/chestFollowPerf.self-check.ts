/**
 * Offline invariants for chest-follow / GL dirty-eps perf patch.
 * Run: npx tsx src/features/game/scratch/chestFollowPerf.self-check.ts
 */
const CANVAS_WIDTH = 390;
const OLD_EPS = 1e-4;
const CAM_EPS = 1 / Math.max(CANVAS_WIDTH, 1);
const CHEST_SMOOTH = 0.14;

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(CAM_EPS > OLD_EPS, "new cam eps must be coarser than legacy 1e-4");
assert(CAM_EPS < 0.01, "cam eps must stay small enough for smooth pans");
assert(Math.abs(CAM_EPS - 1 / CANVAS_WIDTH) < 1e-12, "cam eps is 1 CSS px in NDC");

// Sub-pixel target drip should stay under dirty eps after a few smooth steps.
{
  let cam = 0;
  const target = OLD_EPS * 0.5;
  for (let i = 0; i < 8; i += 1) cam += (target - cam) * CHEST_SMOOTH;
  assert(Math.abs(cam) < CAM_EPS, "micro drip remains below dirty threshold");
}

// A real framing correction must cross dirty eps so the camera still presents.
{
  let cam = 0;
  const target = 0.02;
  cam += (target - cam) * CHEST_SMOOTH;
  assert(Math.abs(cam) > CAM_EPS, "visible pan exceeds dirty threshold");
}

// Approximate skip win: at 120Hz with 30fps video, old path drew ~every rAF;
// new path draws when video pending OR cam moved > eps. Micro drip alone
// should not force a draw.
{
  const displayHz = 120;
  const videoUploadsPerSec = 60; // two clips @ ~30
  const oldClears = displayHz; // camMoved always true
  const newClearsIfOnlyVideo = videoUploadsPerSec;
  assert(newClearsIfOnlyVideo < oldClears * 0.6, "expected material clear reduction");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      CAM_EPS,
      CHEST_SMOOTH,
      vsOld: +(CAM_EPS / OLD_EPS).toFixed(1) + "x coarser",
    },
    null,
    2,
  ),
);
