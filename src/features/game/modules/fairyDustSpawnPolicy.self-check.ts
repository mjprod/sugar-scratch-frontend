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
  shouldSpawnFairyDust({
    playWindow: true,
    celebrate: true,
    isScratching: false,
    cursorOnMesh: false,
    coarsePointer: true,
  }),
  "coarse: spawn after stroke while celebrate armed",
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
    celebrate: false,
    isScratching: true,
    cursorOnMesh: true,
    coarsePointer: true,
  }),
  "coarse: no spawn outside celebrate",
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

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "coarse celebrate mid-stroke; same-spot jitter does not trail",
    },
    null,
    2,
  ),
);
