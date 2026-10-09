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
import { getAuthUserId } from "./auth";

/** Optimistic floor/ceil — single source in sparkleCoinAward (must match backend). */
export {
  SCRATCH_COIN_MAX,
  SCRATCH_COIN_MIN,
} from "../features/game/modules/sparkleCoinAward";

export type ScratchWallet = { diamonds: number; coins: number };

export type ScratchHandResult = {
  handId: string;
  /** False only for an explicit free-play hand: the server mints nothing. */
  rewardsEnabled: boolean;
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
 * Backend SCRATCH_HANDS_PER_DAY is a rolling 24h window per user, so a slot can
 * free up at any time — back off after a 429 instead of latching forever.
 */
export const SCRATCH_HAND_QUOTA_BACKOFF_MS = 15 * 60 * 1000;

/** Set on 429; only blocks starts for the same account until `until`. */
let scratchHandQuotaBlock: { ownerId: string | null; until: number } | null =
  null;
const scratchHandInFlight = new Map<
  string,
  Promise<ScratchHandResult | null>
>();

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

/**
 * True while a recent 429 for this account is still inside its backoff.
 * A different (or signed-out) account, or an expired backoff, clears it.
 */
export function isScratchHandQuotaExhausted(
  ownerId: string | null = getAuthUserId(),
  now: number = Date.now(),
): boolean {
  const block = scratchHandQuotaBlock;
  if (!block) return false;
  if (block.ownerId !== ownerId || now >= block.until) {
    scratchHandQuotaBlock = null;
    return false;
  }
  return true;
}

/** Record a quota 429 for `ownerId` (exported for self-checks). */
export function markScratchHandQuotaExhausted(
  ownerId: string | null = getAuthUserId(),
  now: number = Date.now(),
): void {
  scratchHandQuotaBlock = { ownerId, until: now + SCRATCH_HAND_QUOTA_BACKOFF_MS };
}

/** Test helper — reset module quota / in-flight state. */
export function resetScratchHandQuotaForTests(): void {
  scratchHandQuotaBlock = null;
  scratchHandInFlight.clear();
}

/** Ask the server for a new scratch hand id (rate-limited; 24/day). */
export function startScratchHand(
  cardId?: string,
): Promise<ScratchHandResult | null> {
  const ownerId = getAuthUserId();
  if (isScratchHandQuotaExhausted(ownerId)) return Promise.resolve(null);

  const key = `${ownerId ?? ""}:${cardId?.trim() || ""}`;
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
        markScratchHandQuotaExhausted(ownerId);
        try {
          if (import.meta.env?.DEV) {
            console.warn(
              "[scratchCoinReward] daily scratch-hand quota reached — backing off",
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

export type ScratchCoinAwardAction = "skip" | "hold" | "persist" | "local";

/**
 * Paid-hand sparkle coins must not hit the HUD until they can be persisted.
 * AutoScratch / a fast first stroke can cross 10% bands while
 * `POST /hands` is still in flight (or after quota/start failure). Optimistic
 * `addCoins` without persist is then wiped by `refreshWallet`, and the
 * already-consumed progress bands are never claimed.
 *
 * `hold` — signed-in, waiting for a server hand: queue milestones and flush
 *           when `handId` arrives.
 * `persist` — have a hand: credit + POST.
 * `local` — guest juice only (no wallet refresh to wipe it).
 * `skip` — free-play / practice: no coins.
 */
export function scratchCoinAwardAction(input: {
  freePlay: boolean;
  practice: boolean;
  authed: boolean;
  handId: string;
}): ScratchCoinAwardAction {
  if (input.freePlay || input.practice) return "skip";
  if (input.handId.trim()) return "persist";
  if (!input.authed) return "local";
  return "hold";
}

/** Persist a milestone award. Callers should optimistic-addCoins first. */
export async function claimScratchCoins(
  body: ScratchCoinClaimBody,
): Promise<ScratchCoinClaimResult | null> {
  try {
    return await apiMutate<ScratchCoinClaimResult>(
      "/api/rewards/scratch/coins",
      {
        method: "POST",
        body: JSON.stringify({
          handId: body.handId,
          milestone: body.milestone,
          ...(body.cardId ? { cardId: body.cardId } : {}),
        }),
      },
    );
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
