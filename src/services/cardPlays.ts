/**
 * User x cards played — server ledger of cards the player has bought/played.
 *
 * First play is the purchase (photo cards charge `card_price` diamonds once).
 * Played cards render in colour and replay for free; replays earn no rewards
 * (the server issues practice scratch hands for them).
 */

import { apiFetch, apiMutate } from "../lib/api";
import { getAuthUserId } from "./auth";

export type CardKind = "motion" | "photo";

export type PlayedCard = {
  cardKind: CardKind;
  cardId: string;
  playCount: number;
  pricePaid: number;
  firstPlayedAt: number;
};

export type PlayCardResult = {
  firstPlay: boolean;
  rewardsEnabled: boolean;
  pricePaid: number;
  played: PlayedCard;
  wallet: { diamonds: number; coins: number };
};

export function playedCardKey(kind: CardKind, cardId: string): string {
  return `${kind}:${cardId.trim()}`;
}

type Cache = { ownerId: string | null; keys: Set<string> };

let cache: Cache | null = null;
let inFlight: Promise<Set<string>> | null = null;
const listeners = new Set<(keys: Set<string>) => void>();

function publish(keys: Set<string>) {
  cache = { ownerId: getAuthUserId(), keys };
  for (const listener of listeners) listener(keys);
}

/** Cached played-card keys for the signed-in user; empty when signed out. */
export function getCachedPlayedCards(): Set<string> | null {
  if (!cache || cache.ownerId !== getAuthUserId()) return null;
  return cache.keys;
}

export function fetchPlayedCards(opts?: { force?: boolean }): Promise<Set<string>> {
  const cached = getCachedPlayedCards();
  if (cached && !opts?.force) return Promise.resolve(cached);
  if (!getAuthUserId()) {
    const empty = new Set<string>();
    publish(empty);
    return Promise.resolve(empty);
  }
  if (inFlight) return inFlight;
  const request = apiFetch<{ played: PlayedCard[] }>("/api/me/cards/played")
    .then((data) => {
      const keys = new Set(
        (data?.played ?? []).map((p) => playedCardKey(p.cardKind, p.cardId)),
      );
      publish(keys);
      return keys;
    })
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}

export function subscribePlayedCards(
  listener: (keys: Set<string>) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Register a play. First call buys the card (throws ApiError 400 `insufficient`
 * when the wallet cannot cover the price); later calls are free replays.
 */
export async function playCard(
  kind: CardKind,
  cardId: string,
): Promise<PlayCardResult> {
  const result = await apiMutate<PlayCardResult>("/api/me/cards/play", {
    method: "POST",
    body: JSON.stringify({ cardKind: kind, cardId: cardId.trim() }),
  });
  const next = new Set(getCachedPlayedCards() ?? []);
  next.add(playedCardKey(kind, cardId));
  publish(next);
  return result;
}
