/**
 * Scratch sparkle coin awards — optimistic local credit + server persist.
 * Hands are server-issued; amounts are rolled server-side. Client amount is
 * only used for optimistic UI and reconciled from the wallet response.
 */

import { apiMutate } from "../lib/api";

export const SCRATCH_COIN_MIN = 80;
export const SCRATCH_COIN_MAX = 100;

export type ScratchHandResult = {
  handId: string;
  milestonesRemaining: number;
  handsRemainingToday: number;
};

export type ScratchCoinClaimResult = {
  ok: true;
  coins: number;
  alreadyClaimed?: boolean;
  wallet: { diamonds: number; coins: number };
};

export type ScratchCoinClaimBody = {
  handId: string;
  milestone: number;
  cardId?: string;
  /** Optimistic UI only — server ignores and rolls its own amount. */
  amount?: number;
};

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

/** Fire-and-forget persist; applies wallet via callback when the server responds. */
export function persistScratchCoins(
  body: ScratchCoinClaimBody,
  applyWallet: (wallet: { diamonds: number; coins: number }) => void,
): void {
  void claimScratchCoins(body).then((result) => {
    if (result?.wallet) applyWallet(result.wallet);
  });
}
