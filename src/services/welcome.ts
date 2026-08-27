/**
 * Welcome gift — independent of first-play tutorial.
 * Overlay may hide for the session; only Claim marks it claimed.
 * Guests persist the claim; the starter pack is granted after signup.
 */

import { addUnopenedFromPurchase, purchaseAlreadyOwned } from "./packInventory";

const CLAIMED_KEY = "sugar.v8.welcomeGiftClaimed";
const PENDING_KEY = "sugar.v8.welcomeGiftPending";
const SESSION_HIDE_KEY = "sugar.v8.welcomeOverlayHidden";

const WELCOME_PACK = {
  purchaseId: "welcome",
  catalogPackId: "ep1",
  packName: "Starter Scratch Pack",
  creator: "Sugar",
  count: 1,
  themeName: "Starter",
} as const;

export function isWelcomeGiftClaimed(accountClaimed = false) {
  if (accountClaimed) return true;
  try {
    if (localStorage.getItem(CLAIMED_KEY) === "1") return true;
    return localStorage.getItem("sugar.v8.welcomeStatus") === "claimed";
  } catch {
    return false;
  }
}

export function isWelcomeGiftEligible(accountClaimed = false) {
  return !isWelcomeGiftClaimed(accountClaimed);
}

export function hasPendingWelcomeGift() {
  try {
    return localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function isSessionHidden() {
  try {
    return sessionStorage.getItem(SESSION_HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Show overlay when unclaimed and not closed this session. */
export function shouldShowWelcomeOverlay(accountClaimed = false) {
  return isWelcomeGiftEligible(accountClaimed) && !isSessionHidden();
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

function markWelcomeGiftPending() {
  try {
    localStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearWelcomeGiftPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function grantWelcomePack() {
  addUnopenedFromPurchase({ ...WELCOME_PACK });
  clearWelcomeGiftPending();
}

export type WelcomeClaimResult = {
  granted: boolean;
  deferred?: boolean;
  error?: boolean;
};

/**
 * Claim the kicker. Guests (`deferGrant`) store intent only;
 * the pack is granted on signup via `fulfillPendingWelcomeGift`.
 */
export function claimWelcomeRewards(
  accountClaimed = false,
  opts?: { deferGrant?: boolean },
): WelcomeClaimResult {
  if (isWelcomeGiftClaimed(accountClaimed)) return { granted: false };
  try {
    markWelcomeClaimed();
    if (opts?.deferGrant) {
      markWelcomeGiftPending();
      return { granted: true, deferred: true };
    }
    grantWelcomePack();
    return { granted: true };
  } catch {
    return { granted: false, error: true };
  }
}

/** After signup: deliver a guest-claimed starter pack if it is still waiting. */
export function fulfillPendingWelcomeGift(accountClaimed = false): boolean {
  if (accountClaimed) {
    clearWelcomeGiftPending();
    return false;
  }
  if (!hasPendingWelcomeGift()) return false;
  try {
    if (purchaseAlreadyOwned(WELCOME_PACK.purchaseId)) {
      clearWelcomeGiftPending();
      return false;
    }
    grantWelcomePack();
    markWelcomeClaimed();
    return true;
  } catch {
    return false;
  }
}

export function clearWelcomeGiftState() {
  try {
    localStorage.removeItem(CLAIMED_KEY);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem("sugar.v8.welcomeStatus");
    sessionStorage.removeItem(SESSION_HIDE_KEY);
  } catch {
    /* ignore */
  }
}
