/**
 * Pure policy for the motion-scratch BGM loop — on/off from stage warmth,
 * and the gain actually applied once the pause menu ducks it.
 *
 * One level for the whole stage (foil reveal through scratch). Loudness is
 * owned by `SOUND_MIX_DEFAULTS.bgm`; this module only gates play/stop + duck.
 */
import type { TopBarPhase } from "./TopSymbolBar";

export type MotionScratchBgmLevel = "off" | "on" | "keep";

export type MotionScratchBgmPlan = {
  level: MotionScratchBgmLevel;
};

export function resolveMotionScratchBgmPlan(input: {
  warm: boolean;
  topBarPhase: TopBarPhase;
  skipToPlay: boolean;
  /** Kept for call-site compatibility; no longer schedules a level step. */
  dockMs: number;
}): MotionScratchBgmPlan {
  if (!input.warm) return { level: "off" };
  if (input.skipToPlay) return { level: "on" };
  if (input.topBarPhase === "center" || input.topBarPhase === "docked") {
    return { level: "on" };
  }
  // showcase: leave the loop alone until warm clears.
  return { level: "keep" };
}

/** Pause menu ducks to a quieter level; never louder than what the stage asked. */
export function resolveMotionScratchBgmGain(
  desiredGain: number,
  ducked: boolean,
  duckGain: number,
): number {
  return ducked ? Math.min(desiredGain, duckGain) : desiredGain;
}
