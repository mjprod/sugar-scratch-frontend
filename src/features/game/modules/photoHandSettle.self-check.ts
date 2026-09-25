/**
 * Self-check for photo-hand complete detection + pack photo wallet settle.
 * Run: npx tsx src/features/game/modules/photoHandSettle.self-check.ts
 */
import {
  isPhotoHandFullyComplete,
  recordPhotoCardResult,
  saveGameSession,
  settleDonePhotoHand,
  type GameSession,
} from "./gameSession";

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

function baseSession(over: Partial<GameSession> = {}): GameSession {
  return {
    version: 1,
    phase: "photo",
    motionCardIds: ["m1"],
    completedMotionIds: ["m1"],
    themes: ["Test"],
    wonPhotoIds: ["p1", "p2"],
    completedPhotoIds: ["p1", "p2"],
    photoPrizeTotal: 2,
    diamondTotal: 3,
    walletCredited: false,
    modelId: "model-a",
    ...over,
  };
}

assert(
  isPhotoHandFullyComplete(baseSession()),
  "all completed ids should count as fully complete",
);
assert(
  !isPhotoHandFullyComplete(baseSession({ completedPhotoIds: ["p1"] })),
  "missing a won id should not be fully complete",
);
assert(
  !isPhotoHandFullyComplete(baseSession({ wonPhotoIds: [] })),
  "empty won list is not fully complete",
);
assert(
  isPhotoHandFullyComplete(
    baseSession({
      completedPhotoIds: ["p2", "p1", "extra"],
    }),
  ),
  "extra completed ids are fine if every won id is present",
);

local.clear();
saveGameSession(
  baseSession({
    phase: "photo",
    wonPhotoIds: ["p1"],
    completedPhotoIds: [],
    diamondTotal: 3,
    photoDiamondTotal: 0,
    packScratch: {
      readyPackId: "pack-photo",
      packName: "Photo Pack",
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
const afterPhoto = recordPhotoCardResult("p1", 4);
assert(afterPhoto?.photoDiamondTotal === 4, "photo result banks photoDiamondTotal");
assert(afterPhoto?.diamondTotal === 7, "photo result still adds to diamondTotal tally");

let walletDiamonds = 0;
let walletCoins = 0;
const settled = settleDonePhotoHand(
  (n) => {
    walletDiamonds += n;
  },
  (n) => {
    walletCoins += n;
  },
);
assert(settled, "settleDonePhotoHand succeeds for pack photo hand");
assert(walletDiamonds === 4, "pack photo settle credits photo diamonds to wallet");
assert(walletCoins === 0, "pack photo settle does not re-credit motion coins");

local.clear();
saveGameSession(
  baseSession({
    phase: "photo",
    wonPhotoIds: ["p1"],
    completedPhotoIds: [],
    diamondTotal: 5,
    packScratch: {
      readyPackId: "pack-legacy-mid",
      packName: "Legacy Mid Pack",
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
const afterLegacyPhoto = recordPhotoCardResult("p1", 2);
assert(
  afterLegacyPhoto?.photoDiamondTotal === 7,
  "legacy mid-hand load backfills photoDiamondTotal from diamondTotal before adding",
);
assert(afterLegacyPhoto?.diamondTotal === 7, "legacy mid-hand still adds to diamondTotal");

walletDiamonds = 0;
walletCoins = 0;
const legacySettled = settleDonePhotoHand(
  (n) => {
    walletDiamonds += n;
  },
  (n) => {
    walletCoins += n;
  },
);
assert(legacySettled, "legacy pack photo settle succeeds");
assert(
  walletDiamonds === 7,
  "legacy mid-hand pack settle credits pre-upgrade diamonds plus the new card",
);

console.log("photoHandSettle.self-check: ok");
