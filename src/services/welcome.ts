/**
 * Welcome gift — independent of first-play tutorial.
 * Overlay may hide for the session; only Claim marks it claimed.
 */

import { addUnopenedFromPurchase } from "./packInventory";

const CLAIMED_KEY = "sugar.v8.welcomeGiftClaimed";
const SESSION_HIDE_KEY = "sugar.v8.welcomeOverlayHidden";

const WELCOME_PACK = {
  purchaseId: "welcome",
  catalogPackId: "ep1",
  packName: "Starter Scratch Pack",
  creator: "Sugar",
  count: 1,
  themeName: "Starter",
} as const;

export function isWelcomeGiftClaimed() {
  try {
    if (localStorage.getItem(CLAIMED_KEY) === "1") return true;
    return localStorage.getItem("sugar.v8.welcomeStatus") === "claimed";
  } catch {
    return false;
  }
}

export function isWelcomeGiftEligible() {
  return !isWelcomeGiftClaimed();
}

function isSessionHidden() {
  try {
    return sessionStorage.getItem(SESSION_HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Show overlay when unclaimed and not closed this session. */
export function shouldShowWelcomeOverlay() {
  return isWelcomeGiftEligible() && !isSessionHidden();
}

export function hideWelcomeOverlayForSession() {
  try {
    sessionStorage.setItem(SESSION_HIDE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function markWelcomeClaimed() {
  try {
    localStorage.setItem(CLAIMED_KEY, "1");
    sessionStorage.removeItem(SESSION_HIDE_KEY);
  } catch {
    /* ignore */
  }
}

/** Grant starter pack once. Duplicate purchaseId is a no-op. */
export function claimWelcomeRewards(): { granted: boolean; error?: boolean } {
  if (isWelcomeGiftClaimed()) return { granted: false };
  try {
    addUnopenedFromPurchase({ ...WELCOME_PACK });
    markWelcomeClaimed();
    return { granted: true };
  } catch {
    return { granted: false, error: true };
  }
}

export function clearWelcomeGiftState() {
  try {
    localStorage.removeItem(CLAIMED_KEY);
    sessionStorage.removeItem(SESSION_HIDE_KEY);
  } catch {
    /* ignore */
  }
}
