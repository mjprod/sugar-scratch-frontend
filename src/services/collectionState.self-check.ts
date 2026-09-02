/**
 * Collection adaptive inventory states — visibility matrix.
 * Run: npx tsx src/services/collectionState.self-check.ts
 */
import {
  addUnopenedFromPurchase,
  clearPackInventory,
  markPackOpened,
} from "./packInventory.ts";
import { buildOpeningSession } from "./purchase.ts";
import {
  clearReadyToScratch,
  upsertReadyToScratch,
} from "./readyToScratch.ts";
import {
  clearCollectionLedger,
  getCollectionPageState,
  noteCreatorStarted,
  recordRevealedCards,
} from "./collectionState.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

function reset() {
  clearPackInventory();
  clearReadyToScratch();
  clearCollectionLedger();
  store.clear();
}

reset();
{
  const s = getCollectionPageState();
  assert(s.isTrueEmpty, "true empty");
  assert(!s.hasCollectedCards, "no summary");
  assert(!s.hasPendingReveal, "no ready");
  assert(!s.hasStartedCollection, "no continue");
}

{
  const owned = addUnopenedFromPurchase({
    purchaseId: "tx-1",
    catalogPackId: "cyber",
    packName: "Cyber Nights",
    creator: "Ashley",
    count: 1,
  });
  noteCreatorStarted(owned[0]!.creatorId, "Ashley");
  const s = getCollectionPageState();
  assert(!s.isTrueEmpty, "not empty after purchase");
  assert(!s.hasCollectedCards, "summary hidden until reveal");
  assert(s.hasPendingReveal && s.hasUnopenedPacks, "ready for unopened");
  assert(s.hasStartedCollection, "continue after purchase");
  assert(s.continueCreators.some((c) => c.name === "Ashley" && c.pct === 0), "0% Ashley");
}

{
  const instance = addUnopenedFromPurchase({
    purchaseId: "tx-1",
    catalogPackId: "cyber",
    packName: "Cyber Nights",
    creator: "Ashley",
    count: 1,
  })[0];
  // already owned from previous step — open existing
  const packs = JSON.parse(store.get("sugar.v8.packInventory")!) as {
    instanceId: string;
  }[];
  const id = packs[0]!.instanceId;
  markPackOpened(id);
  const session = buildOpeningSession(1);
  upsertReadyToScratch({
    packId: id,
    packName: "Cyber Nights",
    creator: "Ashley",
    session,
    revealed: [],
  });
  const s = getCollectionPageState();
  assert(s.hasUnscratchedCards, "unscratched after open");
  assert(!s.hasUnopenedPacks, "pack opened");
  assert(s.hasPendingReveal, "ready remains");
  assert(!s.hasCollectedCards, "still no summary");
  void instance;
}

{
  recordRevealedCards({
    count: 3,
    creatorId: "ashley",
    creatorName: "Ashley",
  });
  clearReadyToScratch();
  const s = getCollectionPageState();
  assert(s.hasCollectedCards && s.summary.cardsCollected === 3, "summary after reveal");
  assert(s.summary.creatorsCollectedFrom >= 1, "creators from collected");
  assert(typeof s.summary.collectionsInProgress === "number", "collections in progress");
  assert(s.summary.rewardReadyCount === 0 || s.summary.rewardReadyCount >= 0, "reward ready absolute");
  assert(!s.hasPendingReveal, "ready hidden when nothing pending");
  assert(s.hasStartedCollection, "continue remains");
  assert(
    s.continueCreators.find((c) => c.id === "ashley")!.collected >= 3,
    "progress updates",
  );
}

reset();
{
  const owned = addUnopenedFromPurchase({
    purchaseId: "tx-cyber-theme",
    catalogPackId: "cyber-holo",
    packName: "Pack 1",
    creator: "Emily",
    count: 1,
    themeName: "Pack 1",
  });
  noteCreatorStarted(owned[0]!.creatorId, "Emily", "Pack 1");
  const s = getCollectionPageState();
  const emily = s.continueCreators.find((c) => c.name === "Emily");
  assert(emily?.themeName === "Cyber Nights", "resolves Pack 1 via catalog to Cyber Nights");
}

reset();
{
  const owned = addUnopenedFromPurchase({
    purchaseId: "tx-juliana-foil",
    catalogPackId: "julianaval-1",
    packName: "Pack 1",
    creator: "Juliana",
    count: 1,
    themeName: "Pack 1",
  });
  noteCreatorStarted(owned[0]!.creatorId, "Juliana", "Pack 1");
  const s = getCollectionPageState();
  const juliana = s.continueCreators.find((c) => c.name === "Juliana");
  assert(juliana?.themeName === "Firegirl", "Juliana Pack 1 → Firegirl");
}

console.log("v8 collection state self-check passed");
