import {
  buildFoilOpeningSession,
  buildOpeningSession,
  cartCheckoutIdempotencyKey,
  clampBuyPackQuantity,
  clearOpening,
  commitLinearPurchaseIdempotencyKey,
  freshRevealIds,
  linearPackTotalCost,
  nextUnscratchedIndex,
  packCost,
  packUnitCost,
  resolvePurchasePackId,
  restoreOpening,
  saveOpening,
  isJulianaCoverflowBuyAb,
} from "./purchase.ts";
import {
  clearPackInventory,
  upsertInstancesFromApi,
} from "./packInventory.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const single = buildOpeningSession(1, "starter");
const bundle = buildOpeningSession(5, "starter");
const unit = packUnitCost("starter");

assert(single.diamondCost === unit, "single-pack cost matches ranking");
assert(single.cards.length === 3, "single-pack card count");
assert(bundle.diamondCost === unit * 3, "bundle cost");
assert(bundle.cards.length === 5, "bundle card count");
assert(bundle.cards.at(-1)?.rarity === "Ultra Rare", "bundle rarity order");
assert(clampBuyPackQuantity(0) === 1, "qty floor");
assert(clampBuyPackQuantity(99) === 10, "qty ceiling");
assert(linearPackTotalCost("starter", 3) === unit * 3, "linear qty cost");

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

assert(restoreOpening("starter").status === "none", "no saved session yet");

saveOpening({
  packId: "starter",
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

const resumed = restoreOpening("starter");
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
assert(restoreOpening("starter").status === "expired", "corrupted session expires");

saveOpening({
  packId: "starter",
  session: single,
  stage: "ready",
  cardIndex: 0,
  scratched: [],
});
const stale = JSON.parse(store.get("sugar.v8.openingSession")!);
stale.savedAt = Date.now() - 1000 * 60 * 60 * 24;
store.set("sugar.v8.openingSession", JSON.stringify(stale));
assert(restoreOpening("starter").status === "expired", "stale session expires");

clearOpening();
assert(restoreOpening("starter").status === "none", "clear removes the session");

clearPackInventory();
const apiInstances = [
  {
    instanceId: "server-uuid-1",
    catalogPackId: "mina-pack",
    packName: "Starter",
    creator: "Mina",
    creatorId: "mina",
    themeName: "Starter",
    coverUrl: "",
    status: "unopened" as const,
    purchaseId: "purchase-uuid-1",
    savedAt: Date.now(),
  },
  {
    instanceId: "server-uuid-2",
    catalogPackId: "mina-pack",
    packName: "Starter",
    creator: "Mina",
    creatorId: "mina",
    themeName: "Starter",
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

assert(isJulianaCoverflowBuyAb("julianaval"), "julianaval is juliana A/B");
assert(isJulianaCoverflowBuyAb("julianaval-1"), "juliana foil is juliana A/B");
assert(
  isJulianaCoverflowBuyAb("julianaval-pack"),
  "juliana catalog pack is juliana A/B",
);
assert(isJulianaCoverflowBuyAb("Juliana"), "display name is juliana A/B");
assert(!isJulianaCoverflowBuyAb("glauca"), "glauca is not juliana A/B");
assert(!isJulianaCoverflowBuyAb("Rosa Ryyti"), "rosa is not juliana A/B");
assert(!isJulianaCoverflowBuyAb(""), "empty id is not juliana A/B");

/* Linear commit must drop both linear and legacy 1|5 session keys. */
const session = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => void session.set(key, value),
  removeItem: (key: string) => void session.delete(key),
};
session.set("sugar.purchase.idempotency.linear:starter:1", "stale-linear-1");
session.set("sugar.v8.packBuyIdempotency:starter:1", "stale-legacy-1");
commitLinearPurchaseIdempotencyKey("starter", 1);
assert(
  !session.has("sugar.purchase.idempotency.linear:starter:1"),
  "commit clears linear qty-1 key",
);
assert(
  !session.has("sugar.v8.packBuyIdempotency:starter:1"),
  "commit clears legacy qty-1 key after 1-pack linear buy",
);

session.set("sugar.purchase.idempotency.linear:starter:5", "stale-linear-5");
session.set("sugar.v8.packBuyIdempotency:starter:5", "stale-legacy-5");
commitLinearPurchaseIdempotencyKey("starter", 5);
assert(
  !session.has("sugar.purchase.idempotency.linear:starter:5") &&
    !session.has("sugar.v8.packBuyIdempotency:starter:5"),
  "commit clears linear + legacy keys after 5-pack linear buy",
);

session.set("sugar.purchase.idempotency.linear:starter:3", "stale-linear-3");
session.set("sugar.v8.packBuyIdempotency:starter:1", "stale-legacy-1-from-singles");
commitLinearPurchaseIdempotencyKey("starter", 3);
assert(
  !session.has("sugar.purchase.idempotency.linear:starter:3") &&
    !session.has("sugar.v8.packBuyIdempotency:starter:1"),
  "commit clears singles-fallback legacy qty-1 key for N≠1,5",
);

console.log("v8 purchase flow self-check passed");
