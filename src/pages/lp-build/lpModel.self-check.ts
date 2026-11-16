/**
 * Landing card pick follows the hero's case-insensitive model id.
 * Run: npx tsx src/pages/lp-build/lpModel.self-check.ts
 */
import type { CatalogMotionCard } from "../../features/game/shared/catalog.ts";
import { pickLandingPlayCard } from "./lpModel.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function card(id: string, modelId: string, sort = 0): CatalogMotionCard {
  return {
    id,
    label: id,
    bottom: "",
    foreground: "",
    mesh: "",
    chromaKey: false,
    model_id: modelId,
    sort_order: sort,
  };
}

const cards = [
  card("other_1", "other", 0),
  card("juliana_2", "JulianaVal", 2),
  card("juliana_1", "julianaval", 1),
];

assert(
  pickLandingPlayCard(cards, "JULIANAVAL", "") === "juliana_1",
  "mixed-case model query still picks that influencer's first card",
);
assert(
  pickLandingPlayCard(cards, "julianaval", "juliana_2") === "juliana_2",
  "requested owned card is kept",
);
assert(
  pickLandingPlayCard(cards, "nobody", "other_1") === "other_1",
  "a catalog card in the URL is kept when the model has none",
);
assert(
  pickLandingPlayCard([], "nobody", "") === "juliana_1",
  "empty catalog falls back to the template card",
);

console.log("lpModel.self-check ok");
