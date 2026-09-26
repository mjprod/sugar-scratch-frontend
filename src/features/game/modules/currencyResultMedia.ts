/**
 * Theme-video policy while a per-card result overlay owns the screen
 * (YOU WON currency reveal or NO MATCH). Static backdrop — keep decoders quiet
 * so Safari can free the finished card and warm the next motion card.
 */

/** Watchdog / play-nudge must not revive theme clips under the result. */
export function shouldReviveGameVideos(opts: {
  userPaused: boolean;
  introActive: boolean;
  cardTransitionActive: boolean;
  /** Currency win or no-match overlay covering the stage. */
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
