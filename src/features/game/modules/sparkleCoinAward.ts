/** Coin roll when scratch progress crosses a 10% band (credited to wallet). */
export function rollSparkleCoin(): number {
  return 80 + Math.floor(Math.random() * 21); // 80–100 inclusive
}

/** Hide bottom coin badge after this long without scrub activity. */
export const COIN_BADGE_IDLE_HIDE_MS = 2000;

/** Keep the badge up longer after a 10% award so the +N / count-up can read. */
export const COIN_BADGE_AWARD_HOLD_MS = 3800;
