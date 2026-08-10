import {
  buildOpeningSession,
  clearOpening,
  nextUnscratchedIndex,
  restoreOpening,
  saveOpening,
} from "./purchase.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

import { diamondCostForPackId } from "./homepage.ts";

const single = buildOpeningSession(1, "ep1");
const bundle = buildOpeningSession(5, "ep1");
const unit = diamondCostForPackId("ep1");

assert(single.diamondCost === unit, "single-pack cost matches ranking");
assert(single.cards.length === 3, "single-pack card count");
assert(bundle.diamondCost === unit * 3, "bundle cost");
assert(bundle.cards.length === 5, "bundle card count");
assert(bundle.cards.at(-1)?.rarity === "Ultra Rare", "bundle rarity order");

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
});

const resumed = restoreOpening("ep1");
assert(resumed.status === "resume", "saved session resumes");
assert(
  resumed.status === "resume" && resumed.data.scratched.length === 1,
  "resume keeps scratched cards",
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

console.log("v8 purchase flow self-check passed");
