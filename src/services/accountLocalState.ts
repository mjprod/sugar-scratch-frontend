/**
 * Account-owned client caches (inventory, scratch, claims, cart).
 * These keys are not namespaced by user id — isolate them on logout / switch.
 */

import { clearCart } from "./cart";
import { clearCollectionLedger } from "./collectionState";
import { resetDailyRewardClaim } from "./dailyReward";
import { clearPackInventory } from "./packInventory";
import { clearOpening } from "./purchase";
import { clearReadyToScratch } from "./readyToScratch";
import { clearRedeemHistory } from "./redeem";
import { clearThemeCompletionRewards } from "./themeCompletionReward";
import {
  clearWelcomeGiftState,
  hasPendingWelcomeGift,
  restoreWelcomeGiftPending,
} from "./welcome";
import { clearAllGameSessions } from "@/features/game/modules/gameSession";

const OWNER_KEY = "sugar.v8.accountStateOwner";

export function getAccountStateOwner(): string | null {
  try {
    const id = localStorage.getItem(OWNER_KEY);
    return id?.trim() || null;
  } catch {
    return null;
  }
}

export function setAccountStateOwner(userId: string) {
  const id = userId.trim();
  if (!id) return;
  try {
    localStorage.setItem(OWNER_KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearAccountStateOwner() {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* ignore */
  }
}

export type ClearAccountLocalStateOptions = {
  /** Keep a guest-deferred welcome claim across signup. */
  preserveWelcomePending?: boolean;
};

/** Wipe play / claim caches that would otherwise attach to the next account. */
export function clearAccountLocalState(
  options?: ClearAccountLocalStateOptions,
) {
  const keepPending =
    options?.preserveWelcomePending === true && hasPendingWelcomeGift();
  clearPackInventory();
  clearReadyToScratch();
  clearCollectionLedger();
  clearOpening();
  clearAllGameSessions();
  clearCart();
  resetDailyRewardClaim();
  clearThemeCompletionRewards();
  clearRedeemHistory();
  clearWelcomeGiftState();
  if (keepPending) {
    restoreWelcomeGiftPending();
  }
}

/**
 * In-progress play that ungated routes (/game, /purchase) can resume after logout.
 * Ready-to-scratch stays so the same user can resume from Collection after re-login.
 */
export function clearUngatedAccountArtifacts() {
  clearAllGameSessions();
  clearOpening();
  clearCart();
  clearWelcomeGiftState();
}

/**
 * Bind client caches to `userId`. When the owner changes, drop the previous
 * account's leftovers (optionally keeping a guest-deferred welcome claim).
 */
export function adoptAccountLocalState(
  userId: string,
  options?: ClearAccountLocalStateOptions,
) {
  const id = userId.trim();
  if (!id) return;
  const previous = getAccountStateOwner();
  // `previous == null` is a first bind (refresh / first login after deploy).
  // Only wipe when a different account is taking over this browser.
  if (previous && previous !== id) {
    clearAccountLocalState({
      preserveWelcomePending: options?.preserveWelcomePending,
    });
  }
  setAccountStateOwner(id);
}
