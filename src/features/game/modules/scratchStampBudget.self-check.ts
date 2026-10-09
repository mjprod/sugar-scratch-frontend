/**
 * Offline invariants for scratch stamp budgets (Phase 9).
 * Run: npx tsx src/features/game/modules/scratchStampBudget.self-check.ts
 */
import {
  resolveAutoScratchBudget,
  resolveManualScratchBudget,
} from "./scratchStampBudget";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const fineManual = resolveManualScratchBudget({ coarsePointer: false });
const coarseManual = resolveManualScratchBudget({ coarsePointer: true });
assert(coarseManual.maxPoints < fineManual.maxPoints, "coarse fewer densify points");
assert(coarseManual.pathStep > fineManual.pathStep, "coarse larger path step");
assert(coarseManual.maxPoints === 12, "coarse maxPoints = 12");
assert(fineManual.maxPoints === 40, "fine maxPoints = 40");

const fineAuto = resolveAutoScratchBudget({ coarsePointer: false });
const coarseAuto = resolveAutoScratchBudget({ coarsePointer: true });
assert(coarseAuto.maxPerFrame < fineAuto.maxPerFrame, "coarse fewer auto stamps/frame");
assert(coarseAuto.fillBatch < fineAuto.fillBatch, "coarse smaller fill batch");
assert(coarseAuto.maxPerFrame === 12 && coarseAuto.fillBatch === 16, "coarse auto caps");
assert(fineAuto.maxPerFrame === 32 && fineAuto.fillBatch === 36, "fine auto caps");

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "coarse ≤12 densify / 12 auto/frame; fine keeps 40 / 32",
    },
    null,
    2,
  ),
);
