import { useEffect, useMemo, useState } from "react";
import {
  fetchCards,
  fetchCollectionCatalogPaginated,
  type BackendCollectionCatalog,
  type BackendCollectionGroup,
  type BackendCollectionTheme,
} from "@/shared/backend/collection";
import { useCatalog } from "@/shared/catalog/CatalogContext";
import {
  createBackendDeck,
  type DeckGroup,
} from "@/features/collection/lib/cardGroups";
import { createCard, type CardConfig } from "@/features/collection/lib/cards";
import { cardFaceOverlayFromShared } from "@/shared/ui/CardFaceOverlay";

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

type CatalogFetchState = {
  modelId: string | null;
  catalog: BackendCollectionCatalog | null;
  loading: boolean;
};

/**
 * `enabled: false` holds off every fetch (and keeps `loading`) — pass it while
 * the caller is still resolving `modelId`, so no unscoped catalog is fetched.
 *
 * The fetched catalog is keyed by the `modelId` it was requested for and only
 * surfaced while it still matches, so a caller that stays mounted across
 * creator switches never sees the previous creator's collection.
 */
export function useCreatorCollection(
  modelId: string | null,
  { enabled = true }: { enabled?: boolean } = {},
): CreatorCollectionState {
  const catalogCtx = useCatalog();
  const [fetchState, setFetchState] = useState<CatalogFetchState | null>(null);
  const [motionTemplateIds, setMotionTemplateIds] = useState<Set<string> | null>(
    null,
  );
  const current =
    enabled && fetchState?.modelId === modelId ? fetchState : null;
  const catalog = current?.catalog ?? null;
  const loading = current?.loading ?? true;

  useEffect(() => {
    if (!enabled) {
      setFetchState(null);
      return;
    }
    let cancelled = false;
    setFetchState({ modelId, catalog: null, loading: true });
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setFetchState((prev) =>
        prev?.modelId === modelId
          ? { ...prev, loading: false }
          : { modelId, catalog: null, loading: false },
      );
    }, 2500);
    const settle = (result: BackendCollectionCatalog | null) => {
      if (cancelled) return;
      setFetchState({ modelId, catalog: result, loading: false });
      window.clearTimeout(timeout);
    };

    void fetchCollectionCatalogPaginated({ modelId, onPage: settle })
      .then(settle)
      .catch(() => settle(null));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [enabled, modelId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchCards().then((cards) => {
      if (cancelled || !cards) return;
      const ids = new Set<string>();
      for (const card of cards) {
        const motion =
          card.foreground?.trim() || card.background?.trim() || "";
        if (card.id && motion) ids.add(card.id);
      }
      setMotionTemplateIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return useMemo(() => {
    const { themes, groupByThemeId } = buildThemes(catalog, modelId);
    const backendGroups = (
      catalog?.groups.filter(
        (group) => !modelId || group.modelId === modelId,
      ) ?? []
    ).map((group) => ({
      ...group,
      cards: group.cards.map((card) => ({
        ...card,
        motionUrl:
          card.motionUrl?.trim() ||
          (motionTemplateIds?.has(card.id) ? card.id : "") ||
          null,
      })),
    }));
    const overlay = cardFaceOverlayFromShared(
      catalogCtx.resolveProductSharedMedia(modelId),
    );
    const deck =
      backendGroups.length > 0
        ? createBackendDeck(createCard, backendGroups, {
            overlay,
            overlayForGroup: (group) =>
              cardFaceOverlayFromShared(
                catalogCtx.resolveProductSharedMedia(
                  group.modelId,
                  group.themeId,
                ),
              ),
          })
        : { cards: [] as CardConfig[], groups: [] as DeckGroup[] };

    const cardsByThemeId: Record<string, CardConfig[]> = {};
    for (const theme of themes) {
      const group = groupByThemeId[theme.id];
      if (!group) {
        cardsByThemeId[theme.id] = [];
        continue;
      }
      const memberIds = new Set(group.cards.map((card) => card.id));
      cardsByThemeId[theme.id] = deck.cards.filter(
        (card) =>
          memberIds.has(card.id) ||
          card.groupId === group.id ||
          card.groupId === theme.id,
      );
    }

    return {
      loading,
      modelId,
      catalog,
      themes,
      groups: deck.groups,
      cards: deck.cards,
      cardsByThemeId,
      groupByThemeId,
    };
  }, [catalog, catalogCtx, loading, modelId, motionTemplateIds]);
}

export type { CardConfig };
