/**
 * Self-check for collection-ledger dedupe of awarded photo cards.
 * Run: npx tsx src/features/game/modules/collectedPhotoIds.self-check.ts
 */
import {
  pendingCollectionPhotoIds,
  type GameSession,
} from "./gameSession";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function session(patch: Partial<GameSession>): GameSession {
  return {
    version: 1,
    phase: "photo_reveal",
    motionCardIds: [],
    themes: [],
    modelId: "",
    completedMotionIds: [],
    photoPrizeTotal: 0,
    wonPhotoIds: [],
    completedPhotoIds: [],
    diamondTotal: 0,
    walletCredited: false,
    ...patch,
  };
}

// Freshly awarded cards are all pending.
assert(
  pendingCollectionPhotoIds(session({ wonPhotoIds: ["a", "b"] })).length === 2,
  "un-counted wins are pending",
);

// The load-bearing rule: once counted, a hand must never be counted again —
// this is what kept a scratched 2-card hand reading as 4 in the collection.
assert(
  pendingCollectionPhotoIds(
    session({ wonPhotoIds: ["a", "b"], collectedPhotoIds: ["a", "b"] }),
  ).length === 0,
  "already-counted wins are never re-counted",
);

// A later Motion Card win adds to a partly counted hand.
assert(
  pendingCollectionPhotoIds(
    session({ wonPhotoIds: ["a", "b", "c"], collectedPhotoIds: ["a"] }),
  ).join(",") === "b,c",
  "only the new ids are pending",
);

// Sessions persisted before collectedPhotoIds existed must still settle.
const legacy = session({ wonPhotoIds: ["a"] });
delete legacy.collectedPhotoIds;
assert(
  pendingCollectionPhotoIds(legacy).join(",") === "a",
  "a legacy session with no collectedPhotoIds counts its wins",
);

console.log("collectedPhotoIds.self-check: ok");
