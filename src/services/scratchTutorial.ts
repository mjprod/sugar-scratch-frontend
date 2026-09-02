/**
 * First-play tutorial — independent of welcome gift.
 * Step 1 is pack tear; steps 2–3 teach the foil on first gameplay.
 */

const KEY = "sugar.v8.scratchTutorialCompleted";

export function isScratchTutorialCompleted() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markScratchTutorialCompleted() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearScratchTutorialState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const TEAR_TUTORIAL_STEP = {
  id: "tear",
  title: "Tear Open the Pack",
  description:
    "Drag across the seal to tear it open and reveal your scratch card.",
} as const;

export const FOIL_TUTORIAL_STEPS = [
  {
    id: "foil-explain",
    title: "Reveal Your Target",
    description: "Scratch away the foil to uncover the symbols you need to match.",
  },
  {
    id: "foil-scratch",
    title: "Scratch Here",
    description: "Drag back and forth across the foil to reveal your target.",
  },
] as const;

export const CREATOR_TUTORIAL_STEP = {
  id: "creator-scratch",
  title: "Start Scratching",
  description: "Scratch across the image to begin your reveal.",
} as const;

export type TutorialScene = "tear" | "foil";
