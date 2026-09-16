/**
 * Scratch sparkle coin awards — optimistic local credit + server persist.
 * Hands are server-issued; amounts are rolled server-side. Client amount is
 * only used for optimistic UI.
 *
 * Persist is fire-and-forget. Do not merge the response wallet into client
 * state — a stale snapshot wipes locally-credited diamonds, can re-credit
 * spent coins, and can leak a balance across logout / account switch.
 * `refreshWallet` remains the later source of truth.
 */

import { apiMutate } from "../lib/api";

export const SCRATCH_COIN_MIN = 80;
export const SCRATCH_COIN_MAX = 100;

export type ScratchWallet = { diamonds: number; coins: number };

export type ScratchHandResult = {
  handId: string;
  milestonesRemaining: number;
  handsRemainingToday: number;
};

export type ScratchCoinClaimResult = {
  ok: true;
  coins: number;
  alreadyClaimed?: boolean;
  wallet: ScratchWallet;
};

export type ScratchCoinClaimBody = {
  handId: string;
  milestone: number;
  cardId?: string;
  /** Optimistic UI only — server ignores and rolls its own amount. */
  amount?: number;
};

/**
 * Client wallet after a scratch-coin persist response.
 * Always keeps the local balances: optimistic addCoins is the HUD credit,
 * and refreshWallet is the later source of truth.
 */
export function nextWalletAfterScratchPersist(
  local: ScratchWallet,
  _remote: ScratchWallet | null | undefined,
  _opts: { authed: boolean },
): ScratchWallet {
  // Remote snapshots are never merged — see module doc.
  return local;
}

/** Ask the server for a new scratch hand id (rate-limited). */
export async function startScratchHand(
  cardId?: string,
): Promise<ScratchHandResult | null> {
  try {
    return await apiMutate<ScratchHandResult>("/api/rewards/scratch/hands", {
      method: "POST",
      body: JSON.stringify(cardId ? { cardId } : {}),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[scratchCoinReward] start hand failed", error);
    }
    return null;
  }
}

/** Persist a milestone award. Callers should optimistic-addCoins first. */
export async function claimScratchCoins(
  body: ScratchCoinClaimBody,
): Promise<ScratchCoinClaimResult | null> {
  try {
    return await apiMutate<ScratchCoinClaimResult>("/api/rewards/scratch/coins", {
      method: "POST",
      body: JSON.stringify({
        handId: body.handId,
        milestone: body.milestone,
        ...(body.cardId ? { cardId: body.cardId } : {}),
      }),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[scratchCoinReward] persist failed", error);
    }
    return null;
  }
}

/** Fire-and-forget persist. Does not write the response into the client wallet. */
export function persistScratchCoins(body: ScratchCoinClaimBody): void {
  void claimScratchCoins(body);
}
