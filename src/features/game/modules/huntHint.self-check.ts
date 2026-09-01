/**
 * Self-check for the one-at-a-time hunt hint cycle.
 * Run: npx tsx src/features/game/modules/huntHint.self-check.ts
 */
import {
  advanceHuntHintCycle,
  pickNextUnfoundSymbol,
  type HuntHintCycle,
} from "./matchGame";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const DWELL = 2600;
const GAP = 1600;

function cycle(): HuntHintCycle {
  return { index: -1, shownAt: 0, phase: "show" };
}

function step(
  state: HuntHintCycle,
  now: number,
  revealed: boolean[],
  eligible = true,
) {
  return advanceHuntHintCycle(state, {
    now,
    revealed,
    eligible,
    dwellMs: DWELL,
    gapMs: GAP,
  });
}

// pickNextUnfoundSymbol walks forward then wraps.
assert(
  pickNextUnfoundSymbol([true, false, true, false], -1) === 1,
  "picks the first unfound",
);
assert(
  pickNextUnfoundSymbol([true, false, true, false], 1) === 3,
  "walks forward past the current index",
);
assert(
  pickNextUnfoundSymbol([true, false, true, false], 3) === 1,
  "wraps to the first unfound at the end",
);
assert(
  pickNextUnfoundSymbol([true, true], 0) === -1,
  "all found yields no index",
);

// Ineligible never rings, and resets any held mark.
{
  const state = cycle();
  const revealed = [false, false, false];
  assert(step(state, 0, revealed) === 0, "eligible rings the first unfound");
  assert(
    step(state, 100, revealed, false) === -1,
    "going ineligible stops the hint",
  );
  assert(state.index === -1, "ineligible clears the held index");
  assert(state.phase === "show", "ineligible resets the phase");
}

// The load-bearing rule: one mark at a time — hold through dwell, then gap
// (ringing nothing), then move to the next unfound mark.
{
  const state = cycle();
  const revealed = [false, false, false];
  assert(step(state, 0, revealed) === 0, "rings index 0");
  assert(step(state, DWELL - 1, revealed) === 0, "holds through the dwell");
  assert(step(state, DWELL, revealed) === -1, "dwell over → gap rings nothing");
  assert(
    step(state, DWELL + GAP - 1, revealed) === -1,
    "stays dark through the gap",
  );
  assert(
    step(state, DWELL + GAP, revealed) === 1,
    "gap over → rings the next mark",
  );
}

// Finding the ringed mark drops it immediately rather than pointing at a
// symbol the player already collected.
{
  const state = cycle();
  const revealed = [false, false];
  assert(step(state, 0, revealed) === 0, "rings index 0");
  revealed[0] = true;
  assert(step(state, 10, revealed) === -1, "found while showing → stops");
  assert(step(state, 10 + GAP, revealed) === 1, "then moves to the last one");
}

// A mark found during the gap is skipped when the next one is picked.
{
  const state = cycle();
  const revealed = [false, false, false];
  assert(step(state, 0, revealed) === 0, "rings index 0");
  assert(step(state, DWELL, revealed) === -1, "enters the gap");
  revealed[1] = true;
  assert(
    step(state, DWELL + GAP, revealed) === 2,
    "skips the symbol found during the gap",
  );
}

// Last symbol found while it was being ringed: nothing left to point at.
{
  const state = cycle();
  const revealed = [true, false];
  assert(step(state, 0, revealed) === 1, "rings the only unfound mark");
  revealed[1] = true;
  assert(step(state, 10, revealed) === -1, "found → gap");
  assert(
    step(state, 10 + GAP, revealed) === -1,
    "nothing unfound left to ring",
  );
}

console.log("huntHint.self-check: ok");
