import { useEffect, useMemo, useState } from "react";
import {
  fetchCards,
  fetchCollectionCatalogPaginated,
  type BackendCollectionCatalog,
} from "@/shared/backend/collection";
import { useCatalog } from "@/shared/catalog/CatalogContext";
import {
  createBackendDeck,
  type DeckGroup,
} from "@/features/collection/lib/cardGroups";
import { createCard, type CardConfig } from "@/features/collection/lib/cards";
import { cardFaceOverlayFromShared } from "@/shared/ui/CardFaceOverlay";
import {
  buildThemes,
  idleCreatorCollectionState,
  type CreatorCollectionState,
} from "./creatorCollectionState";

export {
  buildThemes,
  idleCreatorCollectionState,
  type CreatorCollectionState,
  type CreatorThemeChip,
} from "./creatorCollectionState";

/**
 * `enabled: false` holds off every fetch and hides any prior catalog — pass it
 * while the caller is still resolving `modelId`, so no unscoped catalog is
 * fetched or shown (a leftover catalog + `modelId: null` would unfilter every
 * group from the previous creator).
 */
export function useCreatorCollection(
  modelId: string | null,
  { enabled = true }: { enabled?: boolean } = {},
): CreatorCollectionState {
  const catalogCtx = useCatalog();
  const [catalog, setCatalog] = useState<BackendCollectionCatalog | null>(null);
  const [motionTemplateIds, setMotionTemplateIds] = useState<Set<string> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setCatalog(null);
      setMotionTemplateIds(null);
      setLoading(true);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
    }, 2500);

    void fetchCollectionCatalogPaginated({
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
    if (!enabled) return idleCreatorCollectionState(modelId);
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
  }, [catalog, catalogCtx, enabled, loading, modelId, motionTemplateIds]);
}

export type { CardConfig };
