/** Display-only coin roll when scratch progress crosses a 10% band. */
export function rollSparkleCoin(): number {
  return 80 + Math.floor(Math.random() * 21); // 80–100 inclusive
}

/** Hide bottom coin badge after this long without scrub activity. */
export const COIN_BADGE_IDLE_HIDE_MS = 2000;
