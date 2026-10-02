import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { ApiError } from "@/lib/api";
import { playCard, type CardKind } from "@/services/cardPlays";
import { Paths } from "@/routes/Paths";

/**
 * First play buys the card; replays are free.
 * False when the wallet cannot cover the price (already sent to Store).
 */
export function useRegisterCardPlay() {
  const { authed } = useAuth();
  const { applyWallet } = useWallet();
  const navigate = useNavigate();

  return useCallback(
    async (kind: CardKind, cardId: string): Promise<boolean> => {
      const id = cardId.trim();
      if (!id) return false;
      if (!authed) return true;
      try {
        const result = await playCard(kind, id);
        if (result.pricePaid > 0) applyWallet(result.wallet);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          navigate(Paths.store);
          return false;
        }
        // Unpublished / unknown cards still open; the server mints nothing for them.
        return true;
      }
    },
    [applyWallet, authed, navigate],
  );
}
