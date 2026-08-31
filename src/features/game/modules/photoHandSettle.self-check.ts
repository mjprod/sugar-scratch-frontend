/**
 * Self-check for photo-hand complete detection.
 * Run: npx tsx src/features/game/modules/photoHandSettle.self-check.ts
 */
import {
  isPhotoHandFullyComplete,
  type GameSession,
} from "./gameSession";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function baseSession(over: Partial<GameSession> = {}): GameSession {
  return {
    version: 1,
    phase: "photo",
    motionCardIds: ["m1"],
    completedMotionIds: ["m1"],
    themes: ["Test"],
    wonPhotoIds: ["p1", "p2"],
    completedPhotoIds: ["p1", "p2"],
    photoPrizeTotal: 2,
    diamondTotal: 3,
    walletCredited: false,
    modelId: "model-a",
    ...over,
  };
}

assert(
  isPhotoHandFullyComplete(baseSession()),
  "all completed ids should count as fully complete",
);
assert(
  !isPhotoHandFullyComplete(baseSession({ completedPhotoIds: ["p1"] })),
  "missing a won id should not be fully complete",
);
assert(
  !isPhotoHandFullyComplete(baseSession({ wonPhotoIds: [] })),
  "empty won list is not fully complete",
);
assert(
  isPhotoHandFullyComplete(
    baseSession({
      completedPhotoIds: ["p2", "p1", "extra"],
    }),
  ),
  "extra completed ids are fine if every won id is present",
);

console.log("photoHandSettle.self-check: ok");
