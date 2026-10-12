import type {
  BackendCollectionCatalog,
  BackendCollectionGroup,
  BackendCollectionTheme,
} from "../../shared/backend/collection";
import type { DeckGroup } from "./lib/cardGroups";
import type { CardConfig } from "./lib/cards";

export type CreatorThemeChip = {
  id: string;
  name: string;
  collected: number;
  total: number;
  coverUrl: string;
  avatarUrl?: string | null;
};

export type CreatorCollectionState = {
  loading: boolean;
  modelId: string | null;
  catalog: BackendCollectionCatalog | null;
  themes: CreatorThemeChip[];
  groups: DeckGroup[];
  cards: CardConfig[];
  cardsByThemeId: Record<string, CardConfig[]>;
  groupByThemeId: Record<string, BackendCollectionGroup>;
};

function themeIdOf(group: BackendCollectionGroup): string {
  return (
    group.themeId?.trim() ||
    group.id?.trim() ||
    group.themeName?.trim() ||
    group.title?.trim() ||
    "theme"
  );
}

function mergeThemeGroups(
  current: BackendCollectionGroup,
  incoming: BackendCollectionGroup,
): BackendCollectionGroup {
  const cards = [...current.cards];
  for (const card of incoming.cards ?? []) {
    if (!cards.some((entry) => entry.id === card.id)) cards.push(card);
  }
  return {
    ...current,
    avatarUrl: current.avatarUrl || incoming.avatarUrl,
    cards,
  };
}

function themeCoverUrl(group: BackendCollectionGroup): string {
  return (
    group.avatarUrl ||
    group.cards.find((card) => card.photoUrls?.some(Boolean))?.photoUrls.find(
      Boolean,
    ) ||
    group.cards.find((card) => card.trailerUrl || card.videoUrl)?.trailerUrl ||
    group.cards.find((card) => card.videoUrl)?.videoUrl ||
    ""
  );
}

function themeChipFromGroup(
  group: BackendCollectionGroup,
  themeIndex: BackendCollectionTheme[],
): CreatorThemeChip {
  const filled = group.cards.reduce(
    (sum, card) =>
      sum + Math.max(0, Math.min(10, Math.round(card.photoScratchDone ?? 0))),
    0,
  );
  const total = Math.max(group.cards.length * 10, 1);
  const indexed = themeIndex.find(
    (theme) =>
      theme.id === group.themeId ||
      theme.id === group.id ||
      theme.label === group.themeName,
  );
  return {
    id: themeIdOf(group),
    name:
      group.themeName?.trim() ||
      group.title?.trim() ||
      indexed?.label ||
      themeIdOf(group),
    collected: Math.min(filled, total),
    total,
    coverUrl: themeCoverUrl(group) || "/img/placeholder.webp",
    avatarUrl: group.avatarUrl,
  };
}

export function buildThemes(
  catalog: BackendCollectionCatalog | null,
  modelId: string | null,
): {
  themes: CreatorThemeChip[];
  groupByThemeId: Record<string, BackendCollectionGroup>;
} {
  const groups =
    catalog?.groups.filter(
      (group) => !modelId || group.modelId === modelId,
    ) ?? [];
  const themeIndex: BackendCollectionTheme[] = catalog?.themes ?? [];
  const groupByThemeId: Record<string, BackendCollectionGroup> = {};
  const themes: CreatorThemeChip[] = [];

  for (const group of groups) {
    const id = themeIdOf(group);
    const existing = groupByThemeId[id];
    const merged = existing ? mergeThemeGroups(existing, group) : group;
    groupByThemeId[id] = merged;
    const chip = themeChipFromGroup(merged, themeIndex);
    const index = themes.findIndex((theme) => theme.id === id);
    if (index >= 0) themes[index] = chip;
    else themes.push(chip);
  }

  return { themes, groupByThemeId };
}

/** Rendered while `enabled` is false — never leak a prior creator's catalog. */
export function idleCreatorCollectionState(
  modelId: string | null,
): CreatorCollectionState {
  return {
    loading: true,
    modelId,
    catalog: null,
    themes: [],
    groups: [],
    cards: [],
    cardsByThemeId: {},
    groupByThemeId: {},
  };
}
