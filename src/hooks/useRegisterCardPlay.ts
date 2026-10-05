import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { ApiError } from "@/lib/api";
import {
  getCachedPlayedCards,
  playCard,
  playedCardKey,
  type CardKind,
} from "@/services/cardPlays";
import { Paths } from "@/routes/Paths";

/**
 * `store` — wallet cannot cover the price (already sent to Store).
 * `failed` — the play could not be registered (network / timeout / server).
 */
export type CardPlayOutcome = "ok" | "store" | "failed";

/** First play buys the card; replays are free. */
export function useRegisterCardPlayOutcome() {
  const { authed } = useAuth();
  const { applyWallet } = useWallet();
  const navigate = useNavigate();

  return useCallback(
    async (kind: CardKind, cardId: string): Promise<CardPlayOutcome> => {
      const id = cardId.trim();
      if (!id) return "failed";
      if (!authed) return "ok";
      try {
        const result = await playCard(kind, id);
        if (result.pricePaid > 0) applyWallet(result.wallet);
        return "ok";
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 400) {
            navigate(Paths.store);
            return "store";
          }
          // Allow fail-open only for unknown/unpublished cards.
          if (error.status === 404) return "ok";
        }
        // Already owned → the replay is free, so a failed backstop charges nothing.
        if (getCachedPlayedCards()?.has(playedCardKey(kind, id))) return "ok";
        return "failed";
      }
    },
    [applyWallet, authed, navigate],
  );
}

/** False when the play was not registered (Store redirect or failure). */
export function useRegisterCardPlay() {
  const registerPlay = useRegisterCardPlayOutcome();
  return useCallback(
    async (kind: CardKind, cardId: string): Promise<boolean> =>
      (await registerPlay(kind, cardId)) === "ok",
    [registerPlay],
  );
}
