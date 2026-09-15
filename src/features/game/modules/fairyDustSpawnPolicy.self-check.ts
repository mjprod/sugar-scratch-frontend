/**
 * Offline invariants for fairy-dust spawn policy (Phase 9).
 * Run: npx tsx src/features/game/modules/fairyDustSpawnPolicy.self-check.ts
 */
import {
  shouldSampleFabricAlpha,
  shouldSpawnFairyDust,
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

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "coarse celebrate spawns mid-stroke; skip fabric probe mid-scratch",
    },
    null,
    2,
  ),
);
