/**
 * Offline invariants for the "already scratched" coverage grid.
 * Run: npx tsx src/features/game/modules/scratchCoverage.self-check.ts
 */
import {
  createScratchCoverage,
  createStrokeFreshness,
  isFreshStamp,
  noteStrokeStamp,
  rebuildScratchCoverage,
  resetScratchCoverage,
  resetStrokeFreshness,
  stampScratchCoverage,
} from "./scratchCoverage";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const RADIUS = 0.045;
/** Same spacing ScratchPrototype densifies manual strokes at (~0.65 radius). */
const STEP = RADIUS * 0.65;

function strokeAcross(
  cov: ReturnType<typeof createScratchCoverage>,
  v: number,
): boolean[] {
  const fresh: boolean[] = [];
  for (let u = 0.15; u <= 0.85; u += STEP) {
    fresh.push(isFreshStamp(stampScratchCoverage(cov, u, v, RADIUS), RADIUS, cov.size));
  }
  return fresh;
}

{
  const cov = createScratchCoverage();
  const first = strokeAcross(cov, 0.5);
  assert(first.length > 10, "stroke has enough stamps to be meaningful");
  assert(first.every(Boolean), "stroke across untouched clothing is fresh every stamp");

  const again = strokeAcross(cov, 0.5);
  assert(again.every((f) => !f), "repeating the same stroke is never fresh");

  // The opening stamp of an offset stroke can add a crescent; the rest only
  // graze the cleared lane's edge.
  const nearby = strokeAcross(cov, 0.5 + RADIUS * 0.3);
  assert(
    nearby.slice(1).every((f) => !f),
    "grazing the edge of a cleared patch does not count as fresh",
  );

  const parallel = strokeAcross(cov, 0.5 + RADIUS * 2.5);
  assert(parallel.every(Boolean), "a new lane beside the cleared one is fresh");

  resetScratchCoverage(cov);
  assert(cov.cells.every((c) => c === 0), "reset clears every cell");
  assert(strokeAcross(cov, 0.5).every(Boolean), "fresh again after reset");
}

{
  // Garment only on the left half of a 4×4 vertex grid.
  const cols = 4;
  const rows = 4;
  const garment: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) garment.push(c < 2 ? 1 : 0);
  }
  const cov = createScratchCoverage(64, garment, cols, rows);
  const offGarment = stampScratchCoverage(cov, 0.85, 0.5, RADIUS);
  assert(offGarment === 0, "off-garment cells never count as fresh");
  const onGarment = stampScratchCoverage(cov, 0.15, 0.5, RADIUS);
  assert(isFreshStamp(onGarment, RADIUS, cov.size), "on-garment stamp is fresh");

  resetScratchCoverage(cov);
  assert(
    stampScratchCoverage(cov, 0.85, 0.5, RADIUS) === 0,
    "reset keeps off-garment cells marked",
  );
}

{
  const cov = createScratchCoverage();
  rebuildScratchCoverage(cov, [{ u: 0.3, v: 0.3, radius: RADIUS }]);
  assert(
    stampScratchCoverage(cov, 0.3, 0.3, RADIUS) === 0,
    "rebuild restores marks as already scratched",
  );
  assert(
    isFreshStamp(stampScratchCoverage(cov, 0.7, 0.7, RADIUS), RADIUS, cov.size),
    "rebuild leaves untouched areas fresh",
  );
}

/** Drives the stroke tracker like addScratch does; returns per-stamp freshness. */
function trackedStroke(
  cov: ReturnType<typeof createScratchCoverage>,
  v: number,
  stepUv: number,
): boolean[] {
  const state = createStrokeFreshness();
  const out: boolean[] = [];
  let prevU: number | null = null;
  for (let u = 0.15; u <= 0.85; u += stepUv) {
    const cells = stampScratchCoverage(cov, u, v, RADIUS);
    out.push(noteStrokeStamp(state, cells, prevU === null ? 0 : u - prevU, RADIUS, cov.size));
    prevU = u;
  }
  return out;
}

{
  const SLOW = 0.003; // ~2 canvas px per event
  const cov = createScratchCoverage();
  assert(trackedStroke(cov, 0.4, SLOW).every(Boolean), "slow drag on fresh fabric stays fresh");
  const slowAgain = trackedStroke(cov, 0.4, SLOW);
  assert(!slowAgain[0], "slow drag over a cleared lane starts stale");
  assert(slowAgain.every((f) => !f), "slow drag over a cleared lane stays stale");
  assert(
    trackedStroke(cov, 0.4, STEP).every((f) => !f),
    "fast swipe over a cleared lane is stale (grazing cells don't add up)",
  );
  const graze = trackedStroke(cov, 0.4 + RADIUS * 0.3, SLOW);
  assert(graze.slice(1).every((f) => !f), "slow graze along a cleared edge is stale");
  // The graze lane cleared up to v = 0.4 + 1.3·radius; centre a stroke on that
  // edge so half of each stamp lands on new fabric.
  const widen = trackedStroke(cov, 0.4 + RADIUS * 1.3, SLOW);
  assert(
    widen.slice(-10).every(Boolean),
    "half the stamp on new fabric (widening a patch) counts as fresh",
  );

  const state = createStrokeFreshness();
  noteStrokeStamp(state, 26, 0, RADIUS);
  resetStrokeFreshness(state);
  assert(!state.started && !state.fresh, "reset clears the stroke tracker");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "64×64 UV grid; stroke opens fresh if ≥20% of the stamp is new, then fresh while ≥40% of the swept area is new (any speed); off-garment pre-marked; reset/rebuild restore",
    },
    null,
    2,
  ),
);
