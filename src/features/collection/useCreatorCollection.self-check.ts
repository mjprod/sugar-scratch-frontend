/**
 * Creator collection gate self-check.
 * Run: npx tsx src/features/collection/useCreatorCollection.self-check.ts
 */
import {
  buildThemes,
  idleCreatorCollectionState,
  type CreatorThemeChip,
} from "./creatorCollectionState.ts";
import type { BackendCollectionCatalog } from "../../shared/backend/collection.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function catalog(
  groups: BackendCollectionCatalog["groups"],
): BackendCollectionCatalog {
  return { groups, themes: [] };
}

function group(
  id: string,
  modelId: string,
): BackendCollectionCatalog["groups"][number] {
  return {
    id,
    modelId,
    title: id,
    themeName: id,
    themeId: id,
    cards: [
      {
        id: `${id}-card`,
        label: id,
        videoUrl: "",
        photoScratchDone: 0,
        photoUrls: [],
      },
    ],
  };
}

const stale = catalog([
  group("police", "creator-a"),
  group("nurse", "creator-a"),
  group("gym", "creator-b"),
]);

const leaked = buildThemes(stale, null);
assert(
  leaked.themes.some((theme: CreatorThemeChip) => theme.id === "police"),
  "null modelId unfilters the prior catalog — this is why disabled must idle",
);
assert(leaked.themes.length === 3, "unfiltered catalog keeps every group");

const scoped = buildThemes(stale, "creator-b");
assert(
  scoped.themes.length === 1 && scoped.themes[0]?.id === "gym",
  "known modelId keeps only that creator's groups",
);

const idle = idleCreatorCollectionState(null);
assert(idle.loading, "disabled state stays loading");
assert(idle.catalog === null, "disabled state drops the prior catalog");
assert(idle.themes.length === 0, "disabled state exposes no leftover themes");
assert(idle.cards.length === 0, "disabled state exposes no leftover cards");
assert(
  Object.keys(idle.groupByThemeId).length === 0,
  "disabled state exposes no leftover groups",
);

console.log("useCreatorCollection self-check ok");
