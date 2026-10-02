import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPlayedCards,
  getCachedPlayedCards,
  playedCardKey,
  subscribePlayedCards,
  type CardKind,
} from "@/services/cardPlays";

/** Played-card set for the signed-in user; `isPlayed` drives colour vs black & white. */
export function usePlayedCards() {
  const { authed } = useAuth();
  const [keys, setKeys] = useState<Set<string>>(
    () => getCachedPlayedCards() ?? new Set(),
  );
  const [loaded, setLoaded] = useState(() => getCachedPlayedCards() != null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribePlayedCards((next) => {
      if (!cancelled) setKeys(next);
    });
    void fetchPlayedCards({ force: true })
      .then((next) => {
        if (cancelled) return;
        setKeys(next);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authed]);

  const isPlayed = useCallback(
    (kind: CardKind, cardId: string) => keys.has(playedCardKey(kind, cardId)),
    [keys],
  );

  return { isPlayed, loaded };
}
