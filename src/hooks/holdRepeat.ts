/** Press-and-hold: fire once, then keep firing until release. */

export const HOLD_REPEAT_DELAY_MS = 400;
export const HOLD_REPEAT_INTERVAL_MS = 300;

export function createHoldRepeat(
  action: () => void,
  options?: { delayMs?: number; intervalMs?: number },
) {
  const delayMs = options?.delayMs ?? HOLD_REPEAT_DELAY_MS;
  const intervalMs = options?.intervalMs ?? HOLD_REPEAT_INTERVAL_MS;
  let delayId = 0;
  let intervalId = 0;

  function stop() {
    if (delayId) clearTimeout(delayId);
    if (intervalId) clearInterval(intervalId);
    delayId = 0;
    intervalId = 0;
  }

  function start(isDisabled?: () => boolean) {
    stop();
    if (isDisabled?.()) return;
    action();
    delayId = setTimeout(() => {
      delayId = 0;
      intervalId = setInterval(() => {
        if (isDisabled?.()) {
          stop();
          return;
        }
        action();
      }, intervalMs);
    }, delayMs);
  }

  return { start, stop };
}
