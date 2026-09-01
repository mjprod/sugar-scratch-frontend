/**
 * Account-owned client cache isolation.
 * Run: npx tsx src/services/accountLocalState.self-check.ts
 */
import {
  adoptAccountLocalState,
  clearAccountLocalState,
  clearAccountStateOwner,
  clearUngatedAccountArtifacts,
  getAccountStateOwner,
} from "./accountLocalState.ts";
import { addPackToCart, listCartPacks } from "./cart.ts";
import { listReadyToScratch, upsertReadyToScratch } from "./readyToScratch.ts";
import { buildOpeningSession, restoreOpening, saveOpening } from "./purchase.ts";
import {
  hasPendingWelcomeGift,
  isWelcomeGiftClaimed,
  restoreWelcomeGiftPending,
} from "./welcome.ts";
import {
  clearAllGameSessions,
  listStoredGameSessions,
  saveGameSession,
  type GameSession,
} from "@/features/game/modules/gameSession.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const local = new Map<string, string>();
const session = new Map<string, string>();

(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => void local.set(key, value),
  removeItem: (key: string) => void local.delete(key),
};
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => void session.set(key, value),
  removeItem: (key: string) => void session.delete(key),
};
(globalThis as { window?: unknown }).window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  dispatchEvent: () => true,
  location: { search: "", href: "http://localhost/" },
};

function seedReadyScratch() {
  upsertReadyToScratch({
    packId: "pack-a1",
    packName: "Cyber Nights",
    creator: "Ashley",
    session: buildOpeningSession(1, "pack-a1"),
    revealed: [],
  });
}

function seedGameSession(ownerUserId?: string) {
  const session: GameSession = {
    version: 1,
    phase: "motion",
    motionCardIds: ["m1"],
    themes: ["Police"],
    modelId: "ashley",
    completedMotionIds: [],
    photoPrizeTotal: 0,
    wonPhotoIds: [],
    completedPhotoIds: [],
    diamondTotal: 0,
    walletCredited: false,
    ownerUserId,
  };
  saveGameSession(session);
}

local.clear();
session.clear();
seedReadyScratch();
saveOpening({
  packId: "ep1",
  session: buildOpeningSession(1, "ep1"),
  stage: "scratch",
  cardIndex: 0,
  scratched: [],
  openingId: "open-1",
});
addPackToCart({
  packId: "ep1",
  packName: "Starter",
  creator: "Sugar",
});
seedGameSession("user-a");
restoreWelcomeGiftPending();
local.set("sugar.v8.welcomeGiftClaimed", "1");
assert(listReadyToScratch().length === 1, "seeded ready-to-scratch");
assert(restoreOpening("ep1").status === "resume", "seeded opening");
assert(listCartPacks().length === 1, "seeded cart");
assert(listStoredGameSessions().length === 1, "seeded game session");
assert(hasPendingWelcomeGift(), "seeded welcome pending");
assert(isWelcomeGiftClaimed(), "seeded welcome claimed");

clearUngatedAccountArtifacts();
assert(listReadyToScratch().length === 1, "logout keeps ready-to-scratch");
assert(restoreOpening("ep1").status === "none", "logout drops opening resume");
assert(listCartPacks().length === 0, "logout clears cart");
assert(listStoredGameSessions().length === 0, "logout drops game sessions");
assert(!hasPendingWelcomeGift(), "logout clears welcome pending");
assert(!isWelcomeGiftClaimed(), "logout clears welcome claimed");

local.clear();
session.clear();
clearAccountStateOwner();
seedReadyScratch();
restoreWelcomeGiftPending();
adoptAccountLocalState("user-a", { preserveWelcomePending: true });
assert(getAccountStateOwner() === "user-a", "first login sets owner");
assert(listReadyToScratch().length === 1, "first bind keeps local scratch");
assert(hasPendingWelcomeGift(), "first login keeps deferred welcome");

adoptAccountLocalState("user-a");
assert(listReadyToScratch().length === 1, "same user re-login keeps scratch");

restoreWelcomeGiftPending();
adoptAccountLocalState("user-b", { preserveWelcomePending: true });
assert(getAccountStateOwner() === "user-b", "switch updates owner");
assert(listReadyToScratch().length === 0, "switch drops prior scratch");
assert(hasPendingWelcomeGift(), "switch can keep guest-deferred welcome");

clearAccountLocalState();
assert(listReadyToScratch().length === 0, "full clear empties scratch");
assert(!hasPendingWelcomeGift(), "full clear drops welcome pending");

clearAllGameSessions();
seedGameSession("user-a");
session.set("sugar.v8.authUserId", "user-b");
saveGameSession({
  version: 1,
  phase: "motion",
  motionCardIds: ["m2"],
  themes: ["Nurse"],
  modelId: "ashley",
  completedMotionIds: [],
  photoPrizeTotal: 0,
  wonPhotoIds: [],
  completedPhotoIds: [],
  diamondTotal: 0,
  walletCredited: false,
  ownerUserId: "user-a",
});
assert(
  listStoredGameSessions().every((row) => row.motionCardIds[0] === "m1"),
  "refuses to save another account's game session",
);

console.log("accountLocalState.self-check: ok");
