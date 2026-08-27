/**
 * Welcome gift — independent of first-play tutorial.
 * Overlay may hide for the session; only Claim marks it claimed.
 */

import { apiMutate } from "../lib/api";
import { isDemoMode } from "../lib/demo";
import { addUnopenedFromPurchase } from "./packInventory";
import type { PackInstanceApi } from "./purchase";

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

export type WelcomeClaimResult = {
  granted: boolean;
  error?: boolean;
  /** True when the offline demo fixture path ran. */
  demo?: boolean;
  welcomeClaimed?: boolean;
  instance?: PackInstanceApi | null;
  wallet?: { diamonds: number; coins: number };
};

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

function markWelcomeClaimedLocal() {
  try {
    localStorage.setItem(CLAIMED_KEY, "1");
    sessionStorage.removeItem(SESSION_HIDE_KEY);
  } catch {
    /* ignore */
  }
}

function claimWelcomeRewardsDemo(): WelcomeClaimResult {
  try {
    addUnopenedFromPurchase({ ...WELCOME_PACK });
    markWelcomeClaimedLocal();
    return { granted: true, demo: true, welcomeClaimed: true };
  } catch {
    return { granted: false, error: true };
  }
}

export async function claimWelcomeRewardsRemote() {
  return apiMutate<{
    ok: boolean;
    welcomeClaimed: boolean;
    instance: PackInstanceApi | null;
    wallet: { diamonds: number; coins: number };
  }>("/api/me/welcome/claim", { method: "POST" });
}

/** Grant starter pack once — server when authed, local only in demo mode. */
export async function claimWelcomeRewards(
  accountClaimed = false,
): Promise<WelcomeClaimResult> {
  if (isWelcomeGiftClaimed(accountClaimed)) return { granted: false };

  if (isDemoMode()) {
    return claimWelcomeRewardsDemo();
  }

  try {
    const remote = await claimWelcomeRewardsRemote();
    return {
      granted: true,
      welcomeClaimed: remote.welcomeClaimed,
      instance: remote.instance,
      wallet: remote.wallet,
    };
  } catch {
    return { granted: false, error: true };
  }
}

export function clearWelcomeGiftState() {
  try {
    localStorage.removeItem(CLAIMED_KEY);
    localStorage.removeItem("sugar.v8.welcomeStatus");
    sessionStorage.removeItem(SESSION_HIDE_KEY);
  } catch {
    /* ignore */
  }
}
