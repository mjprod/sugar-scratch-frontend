/** Press-and-hold: fire once, then keep firing faster until release. */

export const HOLD_REPEAT_DELAY_MS = 100;
export const HOLD_REPEAT_INTERVAL_MS = 50;
export const HOLD_REPEAT_MIN_INTERVAL_MS = 16;
export const HOLD_REPEAT_ACCEL = 0.5;

export function createHoldRepeat(
  action: () => void,
  options?: {
    delayMs?: number;
    intervalMs?: number;
    minIntervalMs?: number;
    accel?: number;
  },
) {
  const delayMs = options?.delayMs ?? HOLD_REPEAT_DELAY_MS;
  const intervalMs = options?.intervalMs ?? HOLD_REPEAT_INTERVAL_MS;
  const minIntervalMs = options?.minIntervalMs ?? HOLD_REPEAT_MIN_INTERVAL_MS;
  const accel = options?.accel ?? HOLD_REPEAT_ACCEL;
  let tickId: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    if (tickId) clearTimeout(tickId);
    tickId = null;
  }

  function start(isDisabled?: () => boolean) {
    stop();
    if (isDisabled?.()) return;
    action();
    let gap = intervalMs;
    function arm(ms: number) {
      tickId = setTimeout(() => {
        tickId = null;
        if (isDisabled?.()) {
          stop();
          return;
        }
        action();
        arm(gap);
        gap = Math.max(minIntervalMs, Math.round(gap * accel));
      }, ms);
    }
    arm(delayMs);
  }

  return { start, stop };
}
