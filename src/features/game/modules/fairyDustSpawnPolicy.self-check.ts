/**
 * Offline invariants for fairy-dust spawn policy (Phase 9).
 * Run: npx tsx src/features/game/modules/fairyDustSpawnPolicy.self-check.ts
 */
import {
  fairyDustSpawnMinDistancePx,
  shouldSampleFabricAlpha,
  shouldSpawnFairyDust,
  shouldSpawnFairyDustForMove,
} from "./fairyDustSpawnPolicy";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  shouldSpawnFairyDust({
    playWindow: true,
    celebrate: true,
    isScratching: true,
    cursorOnMesh: true,
    coarsePointer: true,
  }),
  "coarse: celebrate spawns while scratching",
);
assert(
  !shouldSpawnFairyDust({
    playWindow: true,
    celebrate: true,
    isScratching: false,
    cursorOnMesh: false,
    coarsePointer: true,
  }),
  "coarse: no trail once the finger lifts",
);
assert(
  shouldSpawnFairyDust({
    playWindow: true,
    celebrate: true,
    isScratching: true,
    cursorOnMesh: true,
    coarsePointer: false,
  }),
  "fine: spawn while scratching on mesh",
);
assert(
  !shouldSpawnFairyDust({
    playWindow: true,
    celebrate: true,
    isScratching: true,
    cursorOnMesh: false,
    coarsePointer: false,
  }),
  "fine: no trail off the mesh",
);
for (const coarsePointer of [true, false]) {
  assert(
    !shouldSpawnFairyDust({
      playWindow: true,
      celebrate: false,
      isScratching: true,
      cursorOnMesh: true,
      coarsePointer,
    }),
    `${coarsePointer ? "coarse" : "fine"}: coins only in the 10% celebrate window`,
  );
}
assert(
  !shouldSpawnFairyDust({
    playWindow: false,
    celebrate: true,
    isScratching: true,
    cursorOnMesh: true,
    coarsePointer: true,
  }),
  "no spawn outside the play window",
);
assert(
  !shouldSampleFabricAlpha({
    fairyDust: true,
    coarsePointer: true,
    isScratching: true,
  }),
  "coarse scratching: skip fabric readPixels",
);
assert(
  shouldSampleFabricAlpha({
    fairyDust: true,
    coarsePointer: false,
    isScratching: true,
  }),
  "fine: sample fabric when dust on",
);
assert(
  !shouldSampleFabricAlpha({
    fairyDust: false,
    coarsePointer: false,
    isScratching: true,
  }),
  "dust off: never sample",
);
assert(
  !shouldSpawnFairyDustForMove(2, 2, fairyDustSpawnMinDistancePx(true)),
  "coarse: same-spot jitter does not spawn",
);
assert(
  shouldSpawnFairyDustForMove(40, 0, fairyDustSpawnMinDistancePx(true)),
  "coarse: a real swipe still spawns",
);
assert(
  !shouldSpawnFairyDustForMove(3, 1, fairyDustSpawnMinDistancePx(false)),
  "fine: sub-threshold move does not spawn",
);

// Mirrors FairyDustCursor: distance is measured from the last emitted coin, so
// a slow drag (tiny per-event deltas) still trails once it has travelled far.
function simulateTrail(stepPx: number, steps: number, coarse: boolean): number {
  const min = fairyDustSpawnMinDistancePx(coarse);
  let anchorX = 0;
  let x = 0;
  let emitted = 0;
  for (let i = 0; i < steps; i += 1) {
    x += stepPx;
    if (shouldSpawnFairyDustForMove(x - anchorX, 0, min)) {
      anchorX = x;
      emitted += 1;
    }
  }
  return emitted;
}

for (const coarse of [true, false]) {
  const slow = simulateTrail(1.5, 200, coarse);
  const fast = simulateTrail(30, 10, coarse);
  assert(slow >= 5, `${coarse ? "coarse" : "fine"}: slow drag still trails`);
  assert(
    slow >= fast,
    `${coarse ? "coarse" : "fine"}: slow drag trails at least as densely as a fast swipe`,
  );
}

{
  // Same-spot jitter never walks the anchor away.
  const min = fairyDustSpawnMinDistancePx(true);
  let emitted = 0;
  for (let i = 0; i < 400; i += 1) {
    const jx = (i % 2 === 0 ? 1 : -1) * 3;
    if (shouldSpawnFairyDustForMove(jx, 2, min)) emitted += 1;
  }
  assert(emitted === 0, "coarse: jitter around the anchor never trails");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "coins only in the 10% celebrate window while scratching; any stroke speed trails (anchor distance); jitter does not trail",
    },
    null,
    2,
  ),
);
