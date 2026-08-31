import { diamondCostForPackId } from "./homepage.ts";
import {
  buildFoilOpeningSession,
  buildOpeningSession,
  cartCheckoutIdempotencyKey,
  clearOpening,
  freshRevealIds,
  nextUnscratchedIndex,
  packCost,
  resolvePurchasePackId,
  restoreOpening,
  saveOpening,
} from "./purchase.ts";
import {
  clearPackInventory,
  upsertInstancesFromApi,
} from "./packInventory.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const single = buildOpeningSession(1, "ep1");
const bundle = buildOpeningSession(5, "ep1");
const unit = diamondCostForPackId("ep1");

assert(single.diamondCost === unit, "single-pack cost matches ranking");
assert(single.cards.length === 3, "single-pack card count");
assert(bundle.diamondCost === unit * 3, "bundle cost");
assert(bundle.cards.length === 5, "bundle card count");
assert(bundle.cards.at(-1)?.rarity === "Ultra Rare", "bundle rarity order");

const foil = buildFoilOpeningSession(
  [{ id: "foil-1", label: "Foil", videoUrl: "https://example.com/foil.mp4" }],
);
assert(foil.diamondCost === packCost(1), "foil session cost matches single-pack CTA");
assert(foil.cards.length === 1, "selected foil session includes only that pack");
assert(foil.cards[0].id === "foil-1", "selected foil session uses the chosen pack id");
assert(
  buildFoilOpeningSession(
    [{ id: "foil-1", label: "Foil", videoUrl: "https://example.com/foil.mp4" }],
    packCost(1),
  ).diamondCost === packCost(1),
  "foil session honors the charged cost",
);

/* Resume never replays a card that was already scratched. */
assert(nextUnscratchedIndex(single, []) === 0, "fresh session starts at first card");
assert(
  nextUnscratchedIndex(single, [single.cards[0].id, single.cards[1].id]) === 2,
  "resume skips scratched cards",
);
assert(
  nextUnscratchedIndex(single, single.cards.map((card) => card.id)) === null,
  "fully scratched session reports done",
);

const awarded = new Set([single.cards[0].id]);
assert(
  freshRevealIds([single.cards[0].id, single.cards[1].id], awarded).length === 1,
  "fresh reveal ids skip already awarded",
);
assert(
  freshRevealIds([single.cards[0].id], awarded).length === 0,
  "no fresh ids when all awarded",
);

/* Persistence round-trip against an in-memory localStorage stand-in. */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

assert(restoreOpening("ep1").status === "none", "no saved session yet");

saveOpening({
  packId: "ep1",
  session: single,
  stage: "scratch",
  cardIndex: 1,
  scratched: [single.cards[0].id],
  openingId: "opening-uuid-1",
  serverRevealCardIds: [
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
    "cccccccc-dddd-eeee-ffff-000000000000",
  ],
});

const resumed = restoreOpening("ep1");
assert(resumed.status === "resume", "saved session resumes");
assert(
  resumed.status === "resume" && resumed.data.scratched.length === 1,
  "resume keeps scratched cards",
);
assert(
  resumed.status === "resume" && resumed.data.openingId === "opening-uuid-1",
  "resume keeps server opening id",
);
assert(
  resumed.status === "resume" &&
    resumed.data.serverRevealCardIds?.[0] ===
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "resume keeps server reveal card ids",
);
assert(restoreOpening("ep2").status === "none", "other packs ignore this session");

store.set("sugar.v8.openingSession", "{not json");
assert(restoreOpening("ep1").status === "expired", "corrupted session expires");

saveOpening({
  packId: "ep1",
  session: single,
  stage: "ready",
  cardIndex: 0,
  scratched: [],
});
const stale = JSON.parse(store.get("sugar.v8.openingSession")!);
stale.savedAt = Date.now() - 1000 * 60 * 60 * 24;
store.set("sugar.v8.openingSession", JSON.stringify(stale));
assert(restoreOpening("ep1").status === "expired", "stale session expires");

clearOpening();
assert(restoreOpening("ep1").status === "none", "clear removes the session");

clearPackInventory();
const apiInstances = [
  {
    instanceId: "server-uuid-1",
    catalogPackId: "ep1",
    packName: "Neon Rain",
    creator: "Mina",
    creatorId: "mina",
    themeName: "Neon Rain",
    coverUrl: "",
    status: "unopened" as const,
    purchaseId: "purchase-uuid-1",
    savedAt: Date.now(),
  },
  {
    instanceId: "server-uuid-2",
    catalogPackId: "ep1",
    packName: "Neon Rain",
    creator: "Mina",
    creatorId: "mina",
    themeName: "Neon Rain",
    coverUrl: "",
    status: "unopened" as const,
    purchaseId: "purchase-uuid-1",
    savedAt: Date.now(),
  },
];
const upserted = upsertInstancesFromApi(apiInstances);
assert(upserted.length === 2, "api instances persisted");
assert(
  upsertInstancesFromApi(apiInstances).length === 2,
  "duplicate api upsert is idempotent",
);
assert(
  upsertInstancesFromApi(apiInstances)[0]?.instanceId === "server-uuid-1",
  "api upsert keeps server instance ids",
);

assert(
  cartCheckoutIdempotencyKey("cart-abc") !==
    cartCheckoutIdempotencyKey("cart-def"),
  "cart checkout keys are per line",
);
assert(
  cartCheckoutIdempotencyKey("cart-abc") === "cart-buy:cart-abc",
  "cart checkout key format",
);

assert(
  resolvePurchasePackId(
    [{ id: "julianaval-pack", modelId: "julianaval", diamondCost: 80 }],
    "julianaval",
  ) === "julianaval-pack",
  "model id maps to catalog pack product",
);
assert(
  resolvePurchasePackId(
    [{ id: "julianaval-pack", modelId: "julianaval", diamondCost: 80 }],
    "julianaval-1",
  ) === "julianaval-pack",
  "foil id maps to catalog pack product",
);
assert(
  resolvePurchasePackId(
    [{ id: "julianaval-pack", modelId: "julianaval", diamondCost: 80 }],
    "julianaval-pack",
  ) === "julianaval-pack",
  "exact catalog id is preserved",
);

console.log("v8 purchase flow self-check passed");
