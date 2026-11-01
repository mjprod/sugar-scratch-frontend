/**
 * Theme-video policy while NO MATCH owns the stage.
 * Showcase keeps the performer (win is `/game/win`).
 */

/** Watchdog / play-nudge must not revive theme clips under the result. */
export function shouldReviveGameVideos(opts: {
  userPaused: boolean;
  introActive: boolean;
  cardTransitionActive: boolean;
  /** No-match overlay covering the stage. */
  resultOverlayActive: boolean;
}): boolean {
  if (opts.userPaused) return false;
  if (opts.introActive) return false;
  if (opts.cardTransitionActive) return false;
  if (opts.resultOverlayActive) return false;
  return true;
}

/** Card src attach is owned by the result-overlay effect while this is true. */
export function shouldDeferCardVideoAttach(opts: {
  introActive: boolean;
  resultOverlayActive: boolean;
}): boolean {
  return opts.introActive || opts.resultOverlayActive;
}

/** Hide the stage picture under NO MATCH / leftover overlay wins — not showcase. */
export function shouldClearStagePicture(opts: {
  topBarPhase: string;
  motionOutcome: string | null | undefined;
}): boolean {
  return opts.motionOutcome === "diamond" || opts.motionOutcome === "no-match";
}
