/**
 * User x cards played — server ledger of cards the player has bought/played.
 *
 * First play is the purchase (photo cards charge `card_price` diamonds once).
 * Played cards render in colour and replay for free; replays earn no rewards
 * (the server issues practice scratch hands for them).
 */

import { ApiError, apiFetch, apiMutate } from "../lib/api";
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
let inFlight: { ownerId: string | null; request: Promise<Set<string>> } | null =
  null;
const playInFlight = new Map<string, Promise<PlayCardResult>>();
/** How long a pre-navigation registration stays claimable by the play gate. */
export const PLAY_HANDOFF_MS = 30_000;
const playHandoffs = new Map<string, { result: PlayCardResult; at: number }>();
const listeners = new Set<(keys: Set<string>) => void>();

function publish(keys: Set<string>, ownerId: string | null = getAuthUserId()) {
  cache = { ownerId, keys };
  for (const listener of listeners) listener(keys);
}

/** Cached played-card keys for the signed-in user; empty when signed out. */
export function getCachedPlayedCards(): Set<string> | null {
  if (!cache || cache.ownerId !== getAuthUserId()) return null;
  return cache.keys;
}

export function fetchPlayedCards(opts?: { force?: boolean }): Promise<Set<string>> {
  const ownerId = getAuthUserId();
  const cached = getCachedPlayedCards();
  if (cached && !opts?.force) return Promise.resolve(cached);
  if (!ownerId) {
    const empty = new Set<string>();
    publish(empty, null);
    return Promise.resolve(empty);
  }
  if (inFlight && inFlight.ownerId === ownerId) return inFlight.request;
  const request = apiFetch<{ played: PlayedCard[] }>("/api/me/cards/played")
    .then((data) => {
      // Account switched while this GET was in flight — do not publish under the new user.
      if (getAuthUserId() !== ownerId) {
        return getCachedPlayedCards() ?? new Set<string>();
      }
      // Failed GET (network / 401 / timeout) must not wipe a just-recorded play
      // or treat every card as unplayed.
      if (data == null) {
        return getCachedPlayedCards() ?? new Set<string>();
      }
      const keys = new Set(
        (data.played ?? []).map((p) => playedCardKey(p.cardKind, p.cardId)),
      );
      // playCard may have published while this GET was in flight.
      const live = getCachedPlayedCards();
      if (live) {
        for (const key of live) keys.add(key);
      }
      publish(keys, ownerId);
      return keys;
    })
    .finally(() => {
      if (inFlight?.request === request) inFlight = null;
    });
  inFlight = { ownerId, request };
  return request;
}

export function subscribePlayedCards(
  listener: (keys: Set<string>) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Wallet cannot cover the first play — other 4xx are real failures, not a Store redirect. */
export function isInsufficientPlayError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 400 && error.status !== 402 && error.status !== 409) return false;
  return error.message.toLowerCase().includes("insufficient");
}

/**
 * Register a play. First call buys the card (throws ApiError 400 `insufficient`
 * when the wallet cannot cover the price); later calls are free replays.
 *
 * Concurrent calls for the same card share one POST so a double-tap cannot
 * submit two first-play charges before the ledger row exists.
 *
 * `handoff: "offer"` — a screen registering right before it navigates to the
 * scratch page; the result is kept for one `handoff: "claim"` by the play gate
 * so the gate does not POST again. A missed handoff (offer failed / response
 * lost) is safe: the retry is a free replay, and the server binds rewards to the
 * card's first scratch hand, not to the purchasing POST.
 */
export async function playCard(
  kind: CardKind,
  cardId: string,
  opts?: { handoff?: "offer" | "claim"; now?: number },
): Promise<PlayCardResult> {
  const key = playedCardKey(kind, cardId);
  const ownerId = getAuthUserId();
  const inFlightKey = `${ownerId ?? "anonymous"}:${key}`;
  const pending = playInFlight.get(inFlightKey);
  if (pending) return pending;

  if (opts?.handoff === "claim") {
    const handoff = playHandoffs.get(inFlightKey);
    playHandoffs.delete(inFlightKey);
    if (handoff && (opts.now ?? Date.now()) - handoff.at < PLAY_HANDOFF_MS) {
      return handoff.result;
    }
  } else {
    playHandoffs.delete(inFlightKey);
  }

  const request = apiMutate<PlayCardResult>("/api/me/cards/play", {
    method: "POST",
    body: JSON.stringify({ cardKind: kind, cardId: cardId.trim() }),
  })
    .then((result) => {
      if (opts?.handoff === "offer") {
        playHandoffs.set(inFlightKey, { result, at: opts.now ?? Date.now() });
      }
      if (getAuthUserId() !== ownerId) return result;
      const next = new Set(getCachedPlayedCards() ?? []);
      next.add(key);
      publish(next, ownerId);
      return result;
    })
    .finally(() => {
      if (playInFlight.get(inFlightKey) === request) playInFlight.delete(inFlightKey);
    });
  playInFlight.set(inFlightKey, request);
  return request;
}

/** Test helper — reset module cache / in-flight state. */
export function resetCardPlaysForTests(): void {
  cache = null;
  inFlight = null;
  playInFlight.clear();
  playHandoffs.clear();
  listeners.clear();
}
