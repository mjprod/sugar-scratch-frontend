/**
 * Self-check for motion currency awards (no photo cards).
 * Run: npx tsx src/features/game/modules/motionCurrencyAward.self-check.ts
 */
import {
  MOTION_COINS_PER_PRIZE,
  awardMotionCardCurrency,
  coinsForMotionPrize,
  diamondsForMotionPrize,
  saveGameSession,
  settleHubWalletFromSession,
  type GameSession,
} from "./gameSession";

/** Keep in sync with MotionCurrencyReveal.CARD_CURRENCY_RESULT_MS */
const CARD_CURRENCY_RESULT_MS = 5000;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const local = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => void local.set(key, value),
  removeItem: (key: string) => void local.delete(key),
};
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
(globalThis as { window?: unknown }).window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  dispatchEvent: () => true,
  location: { search: "", href: "http://localhost/" },
};

assert(CARD_CURRENCY_RESULT_MS === 5000, "currency result holds 5 seconds");

assert(diamondsForMotionPrize(0) === 0, "no prize → no diamonds");
assert(diamondsForMotionPrize(3) === 3, "prize units map 1:1 to diamonds");
assert(diamondsForMotionPrize(-2) === 0, "negative prize clamps");

assert(coinsForMotionPrize(0) === 0, "no prize → no coins");
assert(
  coinsForMotionPrize(2) === 2 * MOTION_COINS_PER_PRIZE,
  "hub coins scale from prize",
);
assert(
  coinsForMotionPrize(2, 40, { packLinked: true }) === 40,
  "pack coins use opening reward",
);
assert(
  coinsForMotionPrize(2, 0, { packLinked: true }) === 0,
  "pack with zero reward stays zero (no hub fallback)",
);

function baseSession(over: Partial<GameSession> = {}): GameSession {
  return {
    version: 1,
    phase: "motion",
    motionCardIds: ["m1", "m2"],
    themes: ["Police", "Nurse"],
    modelId: "model-a",
    completedMotionIds: ["m1"],
    photoPrizeTotal: 1,
    wonPhotoIds: [],
    completedPhotoIds: [],
    diamondTotal: 0,
    coinTotal: 0,
    walletCredited: false,
    ...over,
  };
}

local.clear();
saveGameSession(baseSession());
const hubAwarded = awardMotionCardCurrency("m1", 2);
assert(hubAwarded, "hub award returns session");
assert(
  hubAwarded!.diamondTotal === 2,
  "hub banks motion diamonds into diamondTotal",
);
assert(
  hubAwarded!.coinTotal === 2 * MOTION_COINS_PER_PRIZE,
  "hub banks scaled coins into coinTotal",
);
assert(
  hubAwarded!.pendingMotionResult?.diamonds === 2 &&
    hubAwarded!.pendingMotionResult?.coins === 2 * MOTION_COINS_PER_PRIZE,
  "hub pending result mirrors banked currency",
);

let walletDiamonds = 0;
let walletCoins = 0;
const hubSettled = settleHubWalletFromSession(
  (n) => {
    walletDiamonds += n;
  },
  (n) => {
    walletCoins += n;
  },
);
assert(hubSettled?.walletCredited === true, "hub settle marks credited");
assert(walletDiamonds === 2, "hub settle applies diamondTotal once");
assert(
  walletCoins === 2 * MOTION_COINS_PER_PRIZE,
  "hub settle applies coinTotal once (not only optimistic addCoins)",
);
settleHubWalletFromSession(
  (n) => {
    walletDiamonds += n;
  },
  (n) => {
    walletCoins += n;
  },
);
assert(walletDiamonds === 2 && walletCoins === 2 * MOTION_COINS_PER_PRIZE, "hub settle is idempotent");

local.clear();
saveGameSession(
  baseSession({
    packScratch: {
      readyPackId: "pack-1",
      packName: "Test Pack",
      creator: "Ashley",
      openingSession: {
        quantity: 1,
        diamondCost: 10,
        cards: [
          {
            id: "open-1",
            rarity: "Rare",
            reward: 40,
          },
        ],
      },
      openingCardIds: ["open-1", "open-2"],
      settledOpeningIds: [],
    },
  }),
);
const packAwarded = awardMotionCardCurrency("m1", 3);
assert(packAwarded, "pack award returns session");
assert(
  packAwarded!.diamondTotal === 3,
  "pack-linked banks diamondsForMotionPrize into diamondTotal (tally)",
);
assert(packAwarded!.coinTotal === 40, "pack banks opening reward coins");
assert(
  packAwarded!.pendingMotionResult?.diamonds === 3,
  "pack overlay diamonds match banked diamondTotal",
);

walletDiamonds = 0;
walletCoins = 0;
const packSettled = settleHubWalletFromSession(
  (n) => {
    walletDiamonds += n;
  },
  (n) => {
    walletCoins += n;
  },
);
assert(packSettled?.walletCredited === true, "pack settle marks credited");
assert(
  walletDiamonds === 0 && walletCoins === 0,
  "pack settle does not re-apply motion totals (reveal / reward event owns wallet)",
);

local.clear();
saveGameSession(
  baseSession({
    phase: "done",
    diamondTotal: 5,
    photoDiamondTotal: 2,
    coinTotal: 40,
    packScratch: {
      readyPackId: "pack-1",
      packName: "Test Pack",
      creator: "Ashley",
      openingSession: {
        quantity: 1,
        diamondCost: 10,
        cards: [{ id: "open-1", rarity: "Rare", reward: 40 }],
      },
      openingCardIds: ["open-1"],
      settledOpeningIds: ["open-1"],
    },
  }),
);
walletDiamonds = 0;
walletCoins = 0;
const packPhotoSettled = settleHubWalletFromSession(
  (n) => {
    walletDiamonds += n;
  },
  (n) => {
    walletCoins += n;
  },
);
assert(packPhotoSettled?.walletCredited === true, "pack+photo settle marks credited");
assert(
  walletDiamonds === 2 && walletCoins === 0,
  "pack settle applies photoDiamondTotal only (not motion diamondTotal / coinTotal)",
);

local.clear();
saveGameSession(
  baseSession({
    phase: "done",
    diamondTotal: 6,
    packScratch: {
      readyPackId: "pack-legacy",
      packName: "Legacy Pack",
      creator: "Ashley",
      openingSession: {
        quantity: 1,
        diamondCost: 10,
        cards: [{ id: "open-1", rarity: "Rare", reward: 40 }],
      },
      openingCardIds: ["open-1"],
      settledOpeningIds: ["open-1"],
    },
  }),
);
walletDiamonds = 0;
walletCoins = 0;
const legacyPackSettled = settleHubWalletFromSession(
  (n) => {
    walletDiamonds += n;
  },
  (n) => {
    walletCoins += n;
  },
);
assert(legacyPackSettled?.walletCredited === true, "legacy pack settle marks credited");
assert(
  walletDiamonds === 6 && walletCoins === 0,
  "legacy pack session without photoDiamondTotal credits diamondTotal (photo-only era)",
);

console.log("motionCurrencyAward.self-check: ok");
