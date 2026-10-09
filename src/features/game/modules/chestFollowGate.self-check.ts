/**
 * Offline invariants for chest-follow / body-marker gates (Phase 8–9).
 * Run: npx tsx src/features/game/modules/chestFollowGate.self-check.ts
 */
import {
  shouldUpdateBodyMarkers,
  shouldUpdateChestFollow,
} from "./chestFollowGate";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  shouldUpdateChestFollow({ isScratching: false }),
  "idle: chest-follow updates",
);
assert(
  !shouldUpdateChestFollow({ isScratching: true }),
  "scratching: freeze chest-follow",
);
assert(
  shouldUpdateBodyMarkers({ isScratching: false }),
  "idle: body markers update",
);
assert(
  shouldUpdateBodyMarkers({ isScratching: true }),
  "scratching: body markers stay live (not frozen)",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "freeze chest-follow while scratching; body markers always live",
    },
    null,
    2,
  ),
);
