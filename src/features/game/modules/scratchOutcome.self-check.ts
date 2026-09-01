/**
 * Self-check for finished-card outcome resolution.
 * Run: npx tsx src/features/game/modules/scratchOutcome.self-check.ts
 */
import { resolveScratchOutcome } from "./matchGame";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// The load-bearing rule: an unfinished card is never "no match", however empty
// it currently looks.
assert(
  resolveScratchOutcome({
    scratchCompleted: false,
    photoCardFound: false,
    diamondFound: false,
  }) === "scratching",
  "nothing found mid-scratch stays scratching",
);
assert(
  resolveScratchOutcome({
    scratchCompleted: false,
    photoCardFound: true,
    diamondFound: true,
  }) === "scratching",
  "completion gates every reward outcome too",
);

// Rewards win over no-match, and photo cards outrank diamonds.
assert(
  resolveScratchOutcome({
    scratchCompleted: true,
    photoCardFound: true,
    diamondFound: true,
  }) === "photo-card",
  "photo card outranks diamond",
);
assert(
  resolveScratchOutcome({
    scratchCompleted: true,
    photoCardFound: false,
    diamondFound: true,
  }) === "diamond",
  "diamond alone resolves to diamond",
);
assert(
  resolveScratchOutcome({
    scratchCompleted: true,
    photoCardFound: false,
    diamondFound: false,
  }) === "no-match",
  "finished with neither reward is no-match",
);

console.log("scratchOutcome.self-check: ok");
