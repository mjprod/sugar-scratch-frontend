/**
 * Scratch sparkle coin awards — optimistic local credit + server persist.
 * Amount is rolled client-side (80–100); server clamps and idempotents per hand/milestone.
 *
 * Persist is fire-and-forget. Do not merge the response wallet into client
 * state — a stale snapshot wipes locally-credited diamonds, can re-credit
 * spent coins, and can leak a balance across logout / account switch.
 */

import { apiMutate } from "../lib/api";

export const SCRATCH_COIN_MIN = 80;
export const SCRATCH_COIN_MAX = 100;

export type ScratchWallet = { diamonds: number; coins: number };

export type ScratchCoinClaimResult = {
  ok: true;
  coins: number;
  wallet: ScratchWallet;
};

export type ScratchCoinClaimBody = {
  amount: number;
  handId: string;
  milestone: number;
  cardId?: string;
};

/**
 * Client wallet after a scratch-coin persist response.
 * Always keeps the local balances: optimistic addCoins is the HUD credit,
 * and refreshWallet is the later source of truth.
 */
export function nextWalletAfterScratchPersist(
  local: ScratchWallet,
  remote: ScratchWallet | null | undefined,
  opts: { authed: boolean },
): ScratchWallet {
  // Remote snapshots are never merged — see module doc.
  if (!opts.authed || !remote) return local;
  return local;
}

/** Persist a milestone award. Callers should optimistic-addCoins first. */
export async function claimScratchCoins(
  body: ScratchCoinClaimBody,
): Promise<ScratchCoinClaimResult | null> {
  try {
    return await apiMutate<ScratchCoinClaimResult>("/api/rewards/scratch/coins", {
      method: "POST",
      body: JSON.stringify(body),
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
