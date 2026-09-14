/**
 * Offline invariants for game canvas DPR (Phase 7 + Safari sharpness).
 * Run: npx tsx src/features/game/modules/gameCanvasPixelRatio.self-check.ts
 */
import { resolveGameCanvasPixelRatio } from "./gameCanvasPixelRatio";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  resolveGameCanvasPixelRatio({ coarsePointer: true, devicePixelRatio: 3 }) ===
    1.5,
  "iOS / coarse caps at 1.5 (sharper than 1, less RAM than full 3×)",
);
assert(
  resolveGameCanvasPixelRatio({ coarsePointer: true, devicePixelRatio: 1 }) ===
    1,
  "non-retina coarse stays at 1",
);
assert(
  resolveGameCanvasPixelRatio({ coarsePointer: false, devicePixelRatio: 2 }) ===
    2,
  "desktop retina uses up to 2",
);
assert(
  resolveGameCanvasPixelRatio({ coarsePointer: false, devicePixelRatio: 3 }) ===
    2,
  "desktop caps at 2",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "coarse ≤1.5, fine ≤2 (Safari sharpness without full phone DPR)",
    },
    null,
    2,
  ),
);
