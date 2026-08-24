/**
 * Photo slot fills — ownership (`collected`) must never be inferred from the
 * presence of catalog preview art.
 */
import {
  buildPhotoSlotFills,
  getPhotoFilledCount,
  getVideoCardCount,
  PHOTO_SLOTS,
  PHOTO_SLOT_IMAGE,
} from "./photoSlots.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const fullGrid = Array.from({ length: PHOTO_SLOTS }, (_, i) => `/p/${i}.jpg`);

// --- Override drives ownership; catalog art is preview only ---

const none = buildPhotoSlotFills("card-a", 0, fullGrid);
assert(none.length === PHOTO_SLOTS, "always returns a full grid");
assert(
  none.every((slot) => !slot.collected),
  "override 0 collects nothing even with a full catalog grid",
);
assert(
  none.every((slot, i) => slot.src === fullGrid[i]),
  "uncollected slots still expose preview art",
);
assert(getPhotoFilledCount("card-a", 0, fullGrid) === 0, "count follows collected");

const partial = buildPhotoSlotFills("card-a", 3, fullGrid);
assert(
  partial.filter((slot) => slot.collected).length === 3,
  "override 3 collects exactly the first three slots",
);
assert(
  partial.slice(0, 3).every((slot) => slot.collected) &&
    partial.slice(3).every((slot) => !slot.collected),
  "collected slots are the leading ones",
);
assert(getPhotoFilledCount("card-a", 3, fullGrid) === 3, "count follows override");

// --- Override clamps to the grid ---

assert(
  getPhotoFilledCount("card-a", -5, fullGrid) === 0,
  "negative override clamps to 0",
);
assert(
  getPhotoFilledCount("card-a", 99, fullGrid) === PHOTO_SLOTS,
  "oversized override clamps to PHOTO_SLOTS",
);

// --- Collected slot with no catalog art falls back to the placeholder ---

const sparse = ["", "", "/p/2.jpg", "", "", "", "", "", "", ""];
const sparseFills = buildPhotoSlotFills("card-b", 2, sparse);
assert(
  sparseFills[0]!.collected && sparseFills[0]!.src === PHOTO_SLOT_IMAGE,
  "a collected slot with no catalog URL shows the placeholder image",
);
assert(
  !sparseFills[2]!.collected && sparseFills[2]!.src === "/p/2.jpg",
  "an uncollected slot keeps its own preview",
);

// --- No override: demo decks treat catalog art as collected ---

const demo = buildPhotoSlotFills("card-c", null, fullGrid);
assert(
  demo.every((slot, i) => slot.collected && slot.src === fullGrid[i]),
  "without an override, catalog URLs count as collected",
);

// --- No override and no art: deterministic per cardKey ---

const randA = buildPhotoSlotFills("card-d", null, null);
const randB = buildPhotoSlotFills("card-d", null, null);
assert(
  JSON.stringify(randA) === JSON.stringify(randB),
  "same cardKey yields the same random layout",
);
assert(
  randA.every((slot) => (slot.collected ? slot.src != null : slot.src == null)),
  "random fills keep src and collected consistent",
);

// --- Video card count never invents ownership ---

assert(getVideoCardCount("card-e", 0) === 0, "explicit 0 wins over the demo default");
assert(getVideoCardCount("card-e", 99) === 5, "override clamps to 5");
assert(getVideoCardCount("card-e", null) >= 1, "demo decks still get a play count");
assert(
  getVideoCardCount("card-e", null) === getVideoCardCount("card-e", null),
  "demo play count is deterministic",
);

console.log("photoSlots.self-check: ok");
