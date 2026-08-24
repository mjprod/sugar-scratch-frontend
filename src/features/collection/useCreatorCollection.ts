import { useEffect, useMemo, useState } from "react";
import {
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

function buildThemes(
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

  const themes: CreatorThemeChip[] = groups.map((group) => {
    const id = themeIdOf(group);
    groupByThemeId[id] = group;
    const filled = group.cards.reduce(
      (sum, card) =>
        sum + Math.max(0, Math.min(10, Math.round(card.photoScratchDone ?? 0))),
      0,
    );
    const total = Math.max(group.cards.length * 10, 1);
    const cover =
      group.avatarUrl ||
      group.cards.find((card) => card.photoUrls?.some(Boolean))?.photoUrls.find(
        Boolean,
      ) ||
      group.cards.find((card) => card.trailerUrl || card.videoUrl)?.trailerUrl ||
      group.cards.find((card) => card.videoUrl)?.videoUrl ||
      "";
    const indexed = themeIndex.find(
      (theme) =>
        theme.id === group.themeId ||
        theme.id === group.id ||
        theme.label === group.themeName,
    );
    return {
      id,
      name:
        group.themeName?.trim() ||
        group.title?.trim() ||
        indexed?.label ||
        id,
      collected: Math.min(filled, total),
      total,
      coverUrl: cover || "/img/placeholder.png",
      avatarUrl: group.avatarUrl,
    };
  });

  return { themes, groupByThemeId };
}

export function useCreatorCollection(
  modelId: string | null,
): CreatorCollectionState {
  const catalogCtx = useCatalog();
  const [catalog, setCatalog] = useState<BackendCollectionCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
    }, 2500);

    void fetchCollectionCatalogPaginated({
      catalogGirlName: catalogCtx.productSharedMedia.girlName || undefined,
      modelId,
      onPage: (result) => {
        if (cancelled) return;
        setCatalog(result);
        setLoading(false);
        window.clearTimeout(timeout);
      },
    })
      .then((result) => {
        if (cancelled) return;
        setCatalog(result);
        setLoading(false);
        window.clearTimeout(timeout);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(null);
        setLoading(false);
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [catalogCtx.productSharedMedia.girlName, modelId]);

  return useMemo(() => {
    const { themes, groupByThemeId } = buildThemes(catalog, modelId);
    const backendGroups =
      catalog?.groups.filter(
        (group) => !modelId || group.modelId === modelId,
      ) ?? [];
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
      cardsByThemeId[theme.id] = deck.cards.filter(
        (card) => card.groupId === group.id,
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
  }, [catalog, catalogCtx, loading, modelId]);
}

export type { CardConfig };
