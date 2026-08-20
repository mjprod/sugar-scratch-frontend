/**
 * Scratch tutorial self-check.
 * Run: npx tsx src/services/scratchTutorial.self-check.ts
 */
import {
  CREATOR_TUTORIAL_STEP,
  FOIL_TUTORIAL_STEPS,
  isScratchTutorialCompleted,
  markScratchTutorialCompleted,
  TEAR_TUTORIAL_STEP,
} from "./scratchTutorial.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

assert(!isScratchTutorialCompleted(), "starts incomplete");
assert(TEAR_TUTORIAL_STEP.id === "tear", "step 1 is tear");
assert(FOIL_TUTORIAL_STEPS.length === 2, "foil has explain then scratch");
assert(FOIL_TUTORIAL_STEPS[0].id === "foil-explain", "step 2 explains foil");
assert(CREATOR_TUTORIAL_STEP.id === "creator-scratch", "step 4 is creator scratch");
markScratchTutorialCompleted();
assert(isScratchTutorialCompleted(), "persists completed");

console.log("scratchTutorial.self-check: ok");
