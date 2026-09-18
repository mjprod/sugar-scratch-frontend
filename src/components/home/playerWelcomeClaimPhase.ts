/**
 * Pure claim-card phase helpers for PlayerWelcomeBar.
 * Keeps exit recovery / timeout policy offline-testable.
 */

export type ClaimUiPhase = "ready" | "exiting" | "claimed";

/** Matches `player-welcome-card-exit` duration in theme.css. */
export const CLAIM_CARD_EXIT_MS = 620;

/**
 * Fallback if `animationend` is skipped (backgrounded tab, interrupted animation).
 * Slightly past the CSS duration, same idea as GamePauseButton's leave timeout.
 */
export const CLAIM_CARD_EXIT_FALLBACK_MS = CLAIM_CARD_EXIT_MS + 130;

/**
 * Daily tick / midnight recovery for claim chrome.
 * - Day rolls over → always back to ready (no exit replay).
 * - Still claimed but stuck in exiting → recover to claimed.
 */
export function nextClaimUiPhaseOnTick(
  phase: ClaimUiPhase,
  stillClaimedToday: boolean,
): ClaimUiPhase {
  if (!stillClaimedToday) return "ready";
  if (phase === "exiting") return "claimed";
  return phase;
}

export function shouldArmClaimExitFallback(phase: ClaimUiPhase): boolean {
  return phase === "exiting";
}
