import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { ApiError } from "@/lib/api";
import {
  isInsufficientPlayError,
  playCard,
  type CardKind,
} from "@/services/cardPlays";
import { Paths } from "@/routes/Paths";

/**
 * `store` — wallet cannot cover the price (already sent to Store).
 * `failed` — the play could not be registered (network / timeout / server).
 */
export type CardPlayOutcome = "ok" | "store" | "failed";

type CardPlayHandoff = "offer" | "claim";

/** Every paid play charges diamonds, including cards the player already owns. */
export function useRegisterCardPlayOutcome() {
  const { authed } = useAuth();
  const { applyWallet } = useWallet();
  const navigate = useNavigate();

  return useCallback(
    async (
      kind: CardKind,
      cardId: string,
      handoff?: CardPlayHandoff,
    ): Promise<CardPlayOutcome> => {
      const id = cardId.trim();
      if (!id) return "failed";
      if (!authed) return "ok";
      try {
        const result = await playCard(kind, id, { handoff });
        if (result.pricePaid > 0) applyWallet(result.wallet);
        return "ok";
      } catch (error) {
        if (isInsufficientPlayError(error)) {
          navigate(Paths.store);
          return "store";
        }
        // Allow fail-open only for unknown/unpublished cards.
        if (error instanceof ApiError && error.status === 404) return "ok";
        // An owned card is still a paid play — do not fail open into a free scratch.
        return "failed";
      }
    },
    [applyWallet, authed, navigate],
  );
}

/**
 * Register before navigating to a `PaidCardPlayGate` page — the gate claims
 * this play instead of POSTing a second (replay) one.
 * False only when the player was sent to the Store. A failed registration
 * still navigates: the gate retries it and owns the error / retry UI, so the
 * Play tap never silently does nothing.
 */
export function useRegisterCardPlay() {
  const registerPlay = useRegisterCardPlayOutcome();
  return useCallback(
    async (kind: CardKind, cardId: string): Promise<boolean> =>
      (await registerPlay(kind, cardId, "offer")) !== "store",
    [registerPlay],
  );
}
