/**
 * Played-card ledger — concurrent first-play must share one POST, and a
 * failed/stale GET must not wipe a just-recorded play.
 * Run: npx tsx src/services/cardPlays.self-check.ts
 */
import { ApiError } from "../lib/api.ts";
import {
  fetchPlayedCards,
  getCachedPlayedCards,
  isInsufficientPlayError,
  playCard,
  playedCardKey,
  resetCardPlaysForTests,
} from "./cardPlays.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const session = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => void session.set(key, value),
  removeItem: (key: string) => void session.delete(key),
};

session.set("sugar.v8.authUserId", "user-a");

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function playResult(cardId: string, firstPlay: boolean) {
  return {
    firstPlay,
    rewardsEnabled: firstPlay,
    pricePaid: firstPlay ? 5 : 0,
    played: {
      cardKind: "photo",
      cardId,
      playCount: firstPlay ? 1 : 2,
      pricePaid: firstPlay ? 5 : 0,
      firstPlayedAt: 1,
    },
    wallet: { diamonds: 10, coins: 0 },
  };
}

let posts = 0;
let gets = 0;
let getBody: unknown = { played: [] };
let getStatus = 200;
let playDelayMs = 20;
let getDelayMs = 0;
const playCountsByUser = new Map<string, number>();

const fetchMock: FetchHandler = async (input, init) => {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.includes("/api/me/cards/play") && method === "POST") {
    posts += 1;
    await new Promise((resolve) => setTimeout(resolve, playDelayMs));
    const body = JSON.parse(String(init?.body ?? "{}")) as { cardId?: string };
    const ownerId = session.get("sugar.v8.authUserId") ?? "anonymous";
    const playCount = (playCountsByUser.get(ownerId) ?? 0) + 1;
    playCountsByUser.set(ownerId, playCount);
    return jsonResponse(200, playResult(body.cardId ?? "card", playCount === 1));
  }
  if (url.includes("/api/me/cards/played")) {
    gets += 1;
    if (getDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, getDelayMs));
    }
    if (getStatus >= 400) {
      return jsonResponse(getStatus, { detail: "failed" });
    }
    return jsonResponse(200, getBody);
  }
  return jsonResponse(404, { detail: "missing" });
};

(globalThis as { fetch?: FetchHandler }).fetch = fetchMock;

resetCardPlaysForTests();
posts = 0;
playCountsByUser.clear();
const [first, second] = await Promise.all([
  playCard("photo", "slot-1"),
  playCard("photo", "slot-1"),
]);
assert(posts === 1, "concurrent playCard for the same card shares one POST");
assert(first.pricePaid === 5 && second.pricePaid === 5, "shared POST returns the same first-play result");
assert(
  getCachedPlayedCards()?.has(playedCardKey("photo", "slot-1")) === true,
  "successful play is cached",
);

resetCardPlaysForTests();
posts = 0;
playCountsByUser.clear();
session.set("sugar.v8.authUserId", "user-a");
const firstResult = await playCard("photo", "cross-user");
assert(firstResult.pricePaid === 5, "first user is charged once for a first play");
assert(
  getCachedPlayedCards()?.has(playedCardKey("photo", "cross-user")) === true,
  "first user is cached after a successful first play",
);

session.set("sugar.v8.authUserId", "user-b");
const secondResult = await playCard("photo", "cross-user");
assert(posts === 2, "playCard dedupes only within the same authenticated user");
assert(secondResult.pricePaid === 5, "second user is also charged once for a first play");
assert(
  getCachedPlayedCards()?.has(playedCardKey("photo", "cross-user")) === true,
  "second user receives the cached first play after switching accounts",
);

resetCardPlaysForTests();
posts = 0;
await playCard("photo", "slot-1");
await playCard("photo", "slot-1");
assert(posts === 2, "sequential playCard after settle issues a second POST (replay)");

resetCardPlaysForTests();
session.set("sugar.v8.authUserId", "user-a");
getBody = { played: [{ cardKind: "photo", cardId: "old", playCount: 1, pricePaid: 1, firstPlayedAt: 1 }] };
gets = 0;
posts = 0;
playDelayMs = 5;
getDelayMs = 40;
const listing = fetchPlayedCards({ force: true });
await playCard("photo", "new-slot");
const keys = await listing;
assert(
  keys.has(playedCardKey("photo", "old")) && keys.has(playedCardKey("photo", "new-slot")),
  "in-flight GET must keep a play recorded while it was outstanding",
);

resetCardPlaysForTests();
session.set("sugar.v8.authUserId", "user-a");
getDelayMs = 0;
getStatus = 200;
await playCard("photo", "kept");
getStatus = 500;
gets = 0;
const afterFail = await fetchPlayedCards({ force: true });
assert(
  afterFail.has(playedCardKey("photo", "kept")),
  "failed GET must not wipe cached played cards",
);
assert(
  getCachedPlayedCards()?.has(playedCardKey("photo", "kept")) === true,
  "failed GET must not publish an empty set",
);

assert(
  isInsufficientPlayError(new ApiError(400, "insufficient")),
  "400 insufficient is a Store redirect",
);
assert(
  isInsufficientPlayError(new ApiError(402, "Insufficient diamonds")),
  "402 insufficient is a Store redirect",
);
assert(
  !isInsufficientPlayError(new ApiError(400, "Bad Request")),
  "other 400s must not be treated as insufficient funds",
);
assert(
  !isInsufficientPlayError(new ApiError(500, "insufficient")),
  "5xx is a failure even if the message mentions insufficient",
);
assert(!isInsufficientPlayError(new Error("insufficient")), "non-API errors are not a Store redirect");

resetCardPlaysForTests();
console.log("cardPlays.self-check: ok");
