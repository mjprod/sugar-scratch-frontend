/**
 * Scratch sparkle coin awards — optimistic local credit + server persist.
 * Amount is rolled client-side (80–100); server clamps and idempotents per hand/milestone.
 */

import { apiMutate } from "../lib/api";

export const SCRATCH_COIN_MIN = 80;
export const SCRATCH_COIN_MAX = 100;

export type ScratchCoinClaimResult = {
  ok: true;
  coins: number;
  wallet: { diamonds: number; coins: number };
};

export type ScratchCoinClaimBody = {
  amount: number;
  handId: string;
  milestone: number;
  cardId?: string;
};

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

/** Fire-and-forget persist; applies wallet via callback when the server responds. */
export function persistScratchCoins(
  body: ScratchCoinClaimBody,
  applyWallet: (wallet: { diamonds: number; coins: number }) => void,
): void {
  void claimScratchCoins(body).then((result) => {
    if (result?.wallet) applyWallet(result.wallet);
  });
}
