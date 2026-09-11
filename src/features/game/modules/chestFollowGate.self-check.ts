/**
 * Offline invariants for chest-follow gate (Phase 8).
 * Run: npx tsx src/features/game/modules/chestFollowGate.self-check.ts
 */
import { shouldUpdateChestFollow } from "./chestFollowGate";

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

console.log(
  JSON.stringify(
    { ok: true, policy: "freeze chest-follow while finger is down" },
    null,
    2,
  ),
);
