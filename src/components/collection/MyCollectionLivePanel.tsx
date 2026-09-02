import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  buildCollectionPreviewCards,
  COLLECTION_PREVIEW_LIMIT,
} from "@/components/creator/collectionPreviewCards";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import {
  buildThemes,
  useCreatorCollection,
  type CreatorThemeChip,
} from "@/features/collection/useCreatorCollection";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import {
  fetchCollectionCatalogPaginated,
  type BackendModel,
} from "@/shared/backend/collection";
import {
  themesMatch,
  type CreatorProgress,
} from "@/services/collection";

export type LiveThemeOption = {
  id: string;
  name: string;
  creatorId: string;
  collected: number;
};

/** Load themes with collected > 0 for each creator (for filters). */
export function useCreatorsCollectedThemes(creatorIds: string[]) {
  const [themesByCreator, setThemesByCreator] = useState<
    Record<string, LiveThemeOption[]>
  >({});
  const [ready, setReady] = useState(false);
  const idsKey = creatorIds.slice().sort().join("|");

  useEffect(() => {
    let cancelled = false;
    if (creatorIds.length === 0) {
      setThemesByCreator({});
      setReady(true);
      return;
    }

    setReady(false);
    void Promise.all(
      creatorIds.map(async (creatorId) => {
        try {
          const { modelId } = await resolveModelIdForCreator(creatorId);
          if (!modelId) return [creatorId, [] as LiveThemeOption[]] as const;
          const catalog = await fetchCollectionCatalogPaginated({ modelId });
          const themes = buildThemes(catalog, modelId)
            .themes.filter((theme) => theme.collected > 0)
            .map((theme) => ({
              id: theme.id,
              name: theme.name,
              creatorId,
              collected: theme.collected,
            }));
          return [creatorId, themes] as const;
        } catch {
          return [creatorId, [] as LiveThemeOption[]] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, LiveThemeOption[]> = {};
      for (const [creatorId, themes] of entries) next[creatorId] = themes;
      setThemesByCreator(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
    // idsKey captures creatorIds membership without referential churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { themesByCreator, ready };
}

/**
 * Live selected-creator panel — /api/collection progress + card art.
 * CatalogProvider scoped like CreatorScreen so overlays resolve correctly.
 */
export function MyCollectionLivePanel({
  creator,
  themeFilter,
  selectedThemeId,
  onSelectThemeId,
  onOpenCollection,
}: {
  creator: CreatorProgress;
  themeFilter: string;
  selectedThemeId: string | null;
  onSelectThemeId: (themeId: string | null) => void;
  onOpenCollection: (themeId?: string | null) => void;
}) {
  const [model, setModel] = useState<BackendModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    void resolveModelIdForCreator(creator.id).then(({ model: next }) => {
      if (!cancelled) setModel(next);
    });
    return () => {
      cancelled = true;
    };
  }, [creator.id]);

  return (
    <CatalogProvider preferredModelId={model?.id ?? null}>
      <MyCollectionLiveInner
        creator={creator}
        model={model}
        themeFilter={themeFilter}
        selectedThemeId={selectedThemeId}
        onSelectThemeId={onSelectThemeId}
        onOpenCollection={onOpenCollection}
      />
    </CatalogProvider>
  );
}

function MyCollectionLiveInner({
  creator,
  model,
  themeFilter,
  selectedThemeId,
  onSelectThemeId,
  onOpenCollection,
}: {
  creator: CreatorProgress;
  model: BackendModel | null;
  themeFilter: string;
  selectedThemeId: string | null;
  onSelectThemeId: (themeId: string | null) => void;
  onOpenCollection: (themeId?: string | null) => void;
}) {
  const collection = useCreatorCollection(model?.id ?? null);

  const liveThemes = useMemo(
    () => collection.themes.filter((theme) => theme.collected > 0),
    [collection.themes],
  );

  const selectedTheme = useMemo(() => {
    if (liveThemes.length === 0) return null;
    if (themeFilter !== "all") {
      const filtered = liveThemes.find((theme) => theme.id === themeFilter);
      if (filtered) return filtered;
    }
    if (selectedThemeId) {
      const exact = liveThemes.find((theme) => theme.id === selectedThemeId);
      if (exact) return exact;
    }
    if (creator.themeName) {
      const preferred = liveThemes.find(
        (theme) =>
          themesMatch(theme.name, creator.themeName) ||
          themesMatch(theme.id, creator.themeName),
      );
      if (preferred) return preferred;
    }
    return liveThemes[0] ?? null;
  }, [liveThemes, themeFilter, selectedThemeId, creator.themeName]);

  useEffect(() => {
    const nextId = selectedTheme?.id ?? null;
    if (nextId !== selectedThemeId) onSelectThemeId(nextId);
  }, [selectedTheme?.id, selectedThemeId, onSelectThemeId]);

  const previewCards = useMemo(() => {
    if (!selectedTheme) return [];
    const motionCards = collection.cardsByThemeId[selectedTheme.id] ?? [];
    return buildCollectionPreviewCards(
      motionCards,
      COLLECTION_PREVIEW_LIMIT,
    );
  }, [collection.cardsByThemeId, selectedTheme]);

  const collectedCount = selectedTheme?.collected ?? 0;
  const loading = collection.loading && liveThemes.length === 0;

  if (loading) {
    return (
      <div className="my-collection-preview is-loading" aria-busy="true">
        <p className="my-collection-preview-count">Loading collection…</p>
      </div>
    );
  }

  if (!selectedTheme) {
    return (
      <div className="my-collection-preview">
        <p className="my-collection-preview-count">
          No collected themes yet for {creator.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="my-collection-preview">
      <div className="my-collection-preview-top">
        <div className="my-collection-preview-identity">
          <p className="my-collection-preview-title">
            <span className="my-collection-preview-creator">{creator.name}</span>
            <span className="my-collection-preview-slash" aria-hidden="true">
              /
            </span>
            <span className="my-collection-preview-theme">
              {selectedTheme.name}
            </span>
          </p>
          <p className="my-collection-preview-count">
            {collectedCount}{" "}
            {collectedCount === 1 ? "Card" : "Cards"} Collected
          </p>
        </div>
        <button
          type="button"
          className="my-collection-view-cta"
          onClick={() => onOpenCollection(selectedTheme.id)}
        >
          View Collection
        </button>
      </div>

      <div
        className="my-collection-card-strip"
        aria-label={`${selectedTheme.name} card preview`}
      >
        {previewCards.length === 0
          ? Array.from({ length: 4 }, (_, i) => (
              <div
                key={`sk-${i}`}
                className="my-collection-preview-card is-locked no-art"
                aria-hidden="true"
              />
            ))
          : previewCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={[
                  "my-collection-preview-card",
                  card.collected ? "is-collected" : "is-locked",
                  card.thumbnailUrl ? "has-art" : "no-art",
                ].join(" ")}
                aria-label={
                  card.collected
                    ? `Card ${card.number} — Collected`
                    : `Card ${card.number} — Not collected`
                }
                onClick={() => {
                  if (card.collected) onOpenCollection(selectedTheme.id);
                }}
              >
                {card.thumbnailUrl ? (
                  <img
                    src={card.thumbnailUrl}
                    alt=""
                    className="my-collection-preview-img"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <span className="my-collection-preview-mark" aria-hidden="true">
                    S
                  </span>
                )}
                <span className="my-collection-preview-shade" aria-hidden="true" />
                <span className="my-collection-preview-num">{card.number}</span>
                {!card.collected ? (
                  <span className="my-collection-preview-lock" aria-hidden="true">
                    <Lock size={11} strokeWidth={2.4} />
                  </span>
                ) : null}
              </button>
            ))}
      </div>
    </div>
  );
}

export function liveCollectedCount(
  themes: CreatorThemeChip[] | LiveThemeOption[] | undefined,
  fallback: number,
): number {
  if (!themes?.length) return fallback;
  return themes.reduce((sum, theme) => sum + theme.collected, 0) || fallback;
}
