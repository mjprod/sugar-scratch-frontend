/**
 * Throttle React publishes for high-frequency scratch HUD values.
 * Live values stay in refs; UI state updates at most every `intervalMs`,
 * with an explicit flush (e.g. pointer-up) to catch the final value.
 */

export type ThrottledUiClock = {
  lastPublishAt: number;
};

export function createThrottledUiClock(): ThrottledUiClock {
  return { lastPublishAt: 0 };
}

/**
 * Returns true when the caller should push ref → React state.
 * `force` always publishes and resets the clock (pointer-up / reset).
 */
export function shouldPublishThrottledUi(
  clock: ThrottledUiClock,
  now: number,
  intervalMs: number,
  force: boolean,
): boolean {
  if (force) {
    clock.lastPublishAt = now;
    return true;
  }
  if (now - clock.lastPublishAt >= intervalMs) {
    clock.lastPublishAt = now;
    return true;
  }
  return false;
}
