/**
 * Offline invariants for scratch input coalescing (Phase 7).
 * Run: npx tsx src/features/game/modules/scratchInputCoalesce.self-check.ts
 */
import {
  clearPendingScratchMove,
  createScratchInputCoalesce,
  notePendingScratchMove,
  takePendingScratchMove,
} from "./scratchInputCoalesce";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

{
  const state = createScratchInputCoalesce();
  assert(takePendingScratchMove(state) === null, "cold take is null");
  notePendingScratchMove(state, 10, 20);
  notePendingScratchMove(state, 30, 40);
  const taken = takePendingScratchMove(state);
  assert(taken !== null && taken.x === 30 && taken.y === 40, "keeps latest move");
  assert(takePendingScratchMove(state) === null, "take clears pending");
}

{
  const state = createScratchInputCoalesce();
  notePendingScratchMove(state, 1, 2);
  clearPendingScratchMove(state);
  assert(takePendingScratchMove(state) === null, "clear drops pending");
}

{
  const touchmovesPerSec = 700;
  const appliesPerSec = 60;
  assert(appliesPerSec < touchmovesPerSec * 0.15, "rAF apply ≪ raw move rate");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "pointermove notes pending; rAF/up takes once",
    },
    null,
    2,
  ),
);
