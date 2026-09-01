/**
 * Welcome gift — independent of first-play tutorial.
 * Overlay may hide for the session; only Claim marks it claimed.
 * Guests persist pending intent only; the starter pack is granted after signup
 * via POST /api/me/welcome/claim (or local demo grant).
 */

import { apiMutate } from "../lib/api";
import { isDemoMode } from "../lib/demo";
import {
  addUnopenedFromPurchase,
  getPackInstance,
  purchaseAlreadyOwned,
  syncMyPacks,
  upsertInstancesFromApi,
} from "./packInventory";
import type { PackInstanceApi } from "./purchase";

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

export type WelcomeClaimResult = {
  granted: boolean;
  deferred?: boolean;
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

/**
 * Show overlay when unclaimed and not closed this session.
 * A guest deferred claim keeps CLAIMED unset so a failed signup fulfill can recover.
 */
export function shouldShowWelcomeOverlay(accountClaimed = false) {
  if (hasPendingWelcomeGift()) return false;
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

function markWelcomeGiftPending() {
  try {
    localStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Re-apply a guest-deferred claim after an account-switch wipe. */
export function restoreWelcomeGiftPending() {
  markWelcomeGiftPending();
}

function clearWelcomeGiftPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function claimWelcomeRewardsDemo(): WelcomeClaimResult {
  try {
    addUnopenedFromPurchase({ ...WELCOME_PACK });
    markWelcomeClaimedLocal();
    clearWelcomeGiftPending();
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

/**
 * Claim the kicker.
 * Guests (`deferGrant`) store pending intent only — CLAIMED is deferred until
 * signup fulfill succeeds so a failed claim can reopen the overlay.
 * Authed users hit the server (or local demo fixture).
 */
export async function claimWelcomeRewards(
  accountClaimed = false,
  opts?: { deferGrant?: boolean },
): Promise<WelcomeClaimResult> {
  if (isWelcomeGiftClaimed(accountClaimed)) return { granted: false };

  if (opts?.deferGrant) {
    try {
      // Do not mark CLAIMED yet — pending alone hides the overlay until fulfill.
      markWelcomeGiftPending();
      return { granted: true, deferred: true };
    } catch {
      return { granted: false, error: true };
    }
  }

  if (isDemoMode()) {
    return claimWelcomeRewardsDemo();
  }

  try {
    const remote = await claimWelcomeRewardsRemote();
    if (!remote.instance?.instanceId) {
      return { granted: false, error: true };
    }
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

/** Apply claim payload to local wallet + pack inventory. */
export function commitWelcomeClaimLocally(
  result: Pick<WelcomeClaimResult, "instance" | "wallet">,
  applyWallet: (wallet: { diamonds: number; coins: number }) => void,
): boolean {
  if (result.wallet) {
    applyWallet(result.wallet);
  }
  const instance = result.instance;
  if (!instance?.instanceId) {
    return false;
  }
  upsertInstancesFromApi([instance]);
  return Boolean(getPackInstance(instance.instanceId));
}

/**
 * Commit welcome pack from API response, then reconcile with GET /api/me/packs.
 * Returns false when the granted instance never lands in local inventory.
 */
export async function finalizeWelcomeClaimRemote(
  result: WelcomeClaimResult,
  applyWallet: (wallet: { diamonds: number; coins: number }) => void,
): Promise<boolean> {
  if (result.demo) {
    markWelcomeClaimedLocal();
    clearWelcomeGiftPending();
    return true;
  }
  const instanceId = result.instance?.instanceId;
  if (!instanceId) return false;

  if (!commitWelcomeClaimLocally(result, applyWallet)) {
    return false;
  }

  await syncMyPacks();
  if (getPackInstance(instanceId)) {
    markWelcomeClaimedLocal();
    clearWelcomeGiftPending();
    return true;
  }

  if (result.instance) {
    upsertInstancesFromApi([result.instance]);
  }
  if (getPackInstance(instanceId)) {
    markWelcomeClaimedLocal();
    clearWelcomeGiftPending();
    return true;
  }
  return false;
}

/**
 * After signup: deliver a guest-claimed starter pack if it is still waiting.
 * Non-demo path POSTs /api/me/welcome/claim so server welcomeClaimed sticks and
 * inventory sync cannot clobber a local-only instance.
 */
export async function fulfillPendingWelcomeGift(
  accountClaimed = false,
  applyWallet: (wallet: { diamonds: number; coins: number }) => void = () => {},
): Promise<WelcomeClaimResult> {
  if (accountClaimed) {
    clearWelcomeGiftPending();
    markWelcomeClaimedLocal();
    return { granted: false };
  }
  if (!hasPendingWelcomeGift()) return { granted: false };

  if (isDemoMode()) {
    if (purchaseAlreadyOwned(WELCOME_PACK.purchaseId)) {
      clearWelcomeGiftPending();
      markWelcomeClaimedLocal();
      return { granted: false };
    }
    return claimWelcomeRewardsDemo();
  }

  try {
    const remote = await claimWelcomeRewardsRemote();
    if (!remote.instance?.instanceId) {
      // Drop pending so the (now authed) overlay can reopen and retry remotely.
      clearWelcomeGiftPending();
      return { granted: false, error: true };
    }
    const result: WelcomeClaimResult = {
      granted: true,
      welcomeClaimed: remote.welcomeClaimed,
      instance: remote.instance,
      wallet: remote.wallet,
    };
    const committed = await finalizeWelcomeClaimRemote(result, applyWallet);
    if (!committed) {
      clearWelcomeGiftPending();
      return { granted: false, error: true };
    }
    return result;
  } catch {
    // Network / API failure: allow recovery via the authed overlay claim path.
    clearWelcomeGiftPending();
    return { granted: false, error: true };
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
