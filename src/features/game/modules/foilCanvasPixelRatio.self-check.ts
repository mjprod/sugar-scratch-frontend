/**
 * Offline invariants for foil canvas DPR (Phase 9).
 * Run: npx tsx src/features/game/modules/foilCanvasPixelRatio.self-check.ts
 */
import { resolveFoilCanvasPixelRatio } from "./foilCanvasPixelRatio";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  resolveFoilCanvasPixelRatio({ coarsePointer: true, devicePixelRatio: 3 }) ===
    1.5,
  "coarse foil caps at 1.5",
);
assert(
  resolveFoilCanvasPixelRatio({ coarsePointer: false, devicePixelRatio: 3 }) ===
    2,
  "fine foil caps at 2",
);
assert(
  resolveFoilCanvasPixelRatio({ coarsePointer: true, devicePixelRatio: 1 }) ===
    1,
  "non-retina stays 1",
);

console.log(
  JSON.stringify(
    { ok: true, policy: "foil canvas coarse ≤1.5, fine ≤2" },
    null,
    2,
  ),
);
