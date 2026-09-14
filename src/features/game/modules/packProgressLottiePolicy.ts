/**
 * Pack-progress card-countdown Lottie play policy.
 *
 * Stage HUD unmounts the pill after the first scratch, then remounts it on the
 * next card. That remount must still autoplay — treating every mount as a
 * static first paint leaves the transition animation dead.
 */

/** Idle first-card mount stays still; mid-pack remounts (current > 1) play. */
export function initialCardCountdownPlayKey(current: number): number {
  return current > 1 ? 1 : 0;
}

export function shouldAutoplayCardCountdown(playKey: number): boolean {
  return playKey > 0;
}

/**
 * Idle mounts call stop()+pause to paint frame 0 (blank canvas otherwise).
 * Play mounts must not stop — that cancels DotLottie autoplay.
 */
export function shouldFreezeCardCountdownOnLoad(shouldPlay: boolean): boolean {
  return !shouldPlay;
}
