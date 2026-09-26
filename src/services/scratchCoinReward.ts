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

import { ApiError, apiMutate } from "../lib/api";

/** Optimistic floor/ceil — single source in sparkleCoinAward (must match backend). */
export {
  SCRATCH_COIN_MAX,
  SCRATCH_COIN_MIN,
} from "../features/game/modules/sparkleCoinAward";

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

/** Backend SCRATCH_HANDS_PER_DAY — stop POSTing after the first 429. */
let scratchHandQuotaExhausted = false;
const scratchHandInFlight = new Map<string, Promise<ScratchHandResult | null>>();

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

/** True after the server returns 429 for daily scratch-hand quota. */
export function isScratchHandQuotaExhausted(): boolean {
  return scratchHandQuotaExhausted;
}

/** Test helper — reset module quota / in-flight state. */
export function resetScratchHandQuotaForTests(): void {
  scratchHandQuotaExhausted = false;
  scratchHandInFlight.clear();
}

/** Ask the server for a new scratch hand id (rate-limited; 24/day). */
export function startScratchHand(
  cardId?: string,
): Promise<ScratchHandResult | null> {
  if (scratchHandQuotaExhausted) return Promise.resolve(null);

  const key = cardId?.trim() || "";
  const pending = scratchHandInFlight.get(key);
  if (pending) return pending;

  let settle!: (value: ScratchHandResult | null) => void;
  const request = new Promise<ScratchHandResult | null>((resolve) => {
    settle = resolve;
  });
  scratchHandInFlight.set(key, request);

  void (async () => {
    try {
      const hand = await apiMutate<ScratchHandResult>(
        "/api/rewards/scratch/hands",
        {
          method: "POST",
          body: JSON.stringify(cardId ? { cardId } : {}),
        },
      );
      settle(hand);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        scratchHandQuotaExhausted = true;
        try {
          if (import.meta.env?.DEV) {
            console.warn(
              "[scratchCoinReward] daily scratch-hand quota reached — skipping further starts",
            );
          }
        } catch {
          // import.meta.env unavailable outside Vite
        }
        settle(null);
        return;
      }
      try {
        if (import.meta.env?.DEV) {
          console.warn("[scratchCoinReward] start hand failed", error);
        }
      } catch {
        // ignore
      }
      settle(null);
    } finally {
      scratchHandInFlight.delete(key);
    }
  })();

  return request;
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
