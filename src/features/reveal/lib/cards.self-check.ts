/**
 * Pack-open fan must stay on the opened model.
 * Run: npx tsx src/features/reveal/lib/cards.self-check.ts
 */
import { createMixedCategoryPackCards } from "./cards.ts";
import type { BackendFanCatalog } from "../../../shared/backend/collection.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const mixedFan: BackendFanCatalog = {
  cards: [
    {
      id: "julianaval_cop",
      label: "Juliana Police",
      videoUrl: "/cards/julianaval_cop.mp4",
      characterId: "policewoman",
      modelId: "julianaval",
      sortOrder: 0,
    },
    {
      id: "halli_cop",
      label: "Halli Police",
      videoUrl: "/cards/halli_cop.mp4",
      characterId: "policewoman",
      modelId: "wildhalli",
      sortOrder: 1,
    },
    {
      id: "halli_nurse",
      label: "Halli Nurse",
      videoUrl: "/cards/halli_nurse.mp4",
      characterId: "nurse",
      modelId: "wildhalli",
      sortOrder: 2,
    },
  ],
  byRole: {
    policewoman: [
      {
        id: "julianaval_cop",
        label: "Juliana Police",
        videoUrl: "/cards/julianaval_cop.mp4",
        characterId: "policewoman",
        modelId: "julianaval",
        sortOrder: 0,
      },
      {
        id: "halli_cop",
        label: "Halli Police",
        videoUrl: "/cards/halli_cop.mp4",
        characterId: "policewoman",
        modelId: "wildhalli",
        sortOrder: 1,
      },
    ],
    nurse: [
      {
        id: "halli_nurse",
        label: "Halli Nurse",
        videoUrl: "/cards/halli_nurse.mp4",
        characterId: "nurse",
        modelId: "wildhalli",
        sortOrder: 2,
      },
    ],
  },
};

const halliCards = createMixedCategoryPackCards({
  backendFan: mixedFan,
  modelId: "wildhalli",
  girlName: "Halli",
});

assert(halliCards.length === 2, "halli fan only uses halli roles that have clips");
assert(
  halliCards.every((card) => card.id.startsWith("reveal-api-halli_")),
  "halli fan never picks juliana api ids",
);
assert(
  halliCards.every((card) => !card.mediaUrl.includes("julianaval")),
  "halli fan never uses juliana media",
);
assert(
  halliCards.every((card) => card.overlay?.name !== "Juliana"),
  "halli overlay is not juliana",
);

const emptyHalli = createMixedCategoryPackCards({
  backendFan: { cards: [], byRole: {} },
  modelId: "wildhalli",
  girlName: "Halli",
});
assert(
  emptyHalli.length === 0,
  "empty halli pool must not pad with local juliana swipe clips",
);

console.log("pack fan model scope self-check: ok");
