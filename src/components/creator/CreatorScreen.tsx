import { useEffect, useMemo, useState } from "react";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Paths } from "@/routes/Paths";
import { CreatorCollectionBrowse } from "@/components/creator/CreatorCollectionBrowse";
import { CreatorCollectionsDiscovery } from "@/components/creator/CreatorCollectionsDiscovery";
import { CreatorHeader } from "@/components/creator/CreatorHeader";
import { FeaturedCardOverlay } from "@/components/creator/FeaturedCardOverlay";
import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/creator/ViewModeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import {
  normalizeMediaUrl,
  type BackendModel,
} from "@/shared/backend/collection";
import { modelDisplayName } from "@/shared/backend/modelProfile";
import { formatSocialHandle } from "@/shared/catalog/characters";
import { useCreatorCollection } from "@/features/collection/useCreatorCollection";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import {
  matchLiveThemeId,
  type ThemeCardData,
} from "@/services/collection";
import {
  followCreator,
  followedCreatorFromModel,
  isFollowing,
  unfollowCreator,
} from "@/services/following";
import {
  loadPackCatalog,
  packUnitCost,
  type PurchaseFlowPack,
} from "@/services/purchase";
import "./creator-collection.css";

/**
 * Creator Page V2 — {Creator}'s Scratches with Grid / Collection browse modes.
 */
export function CreatorScreen({
  creatorId,
  onBack,
  onBuyPack,
}: {
  creatorId: string;
  onBack: () => void;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const [resolvedModel, setResolvedModel] = useState<BackendModel | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      resolveModelIdForCreator(creatorId),
      loadPackCatalog(),
    ]).then(([{ model }]) => {
      if (!cancelled) setResolvedModel(model);
    });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const preferredModelId = resolvedModel?.id ?? null;

  return (
    <CatalogProvider preferredModelId={preferredModelId}>
      <CreatorScreenInner
        creatorId={creatorId}
        model={resolvedModel}
        onBack={onBack}
        onBuyPack={onBuyPack}
      />
    </CatalogProvider>
  );
}

function titleCaseSlug(value: string): string {
  const slug = value.trim();
  if (!slug || !/^[a-z][a-z0-9_-]{0,63}$/i.test(slug)) return "";
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function CreatorScreenInner({
  creatorId,
  model,
  onBack,
  onBuyPack,
}: {
  creatorId: string;
  model: BackendModel | null;
  onBack: () => void;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const modelId = model?.id ?? null;
  const collection = useCreatorCollection(modelId);
  useMarkPageReady(
    !collection.loading ||
      collection.themes.length > 0 ||
      collection.cards.length > 0,
  );
  const navigate = useNavigate();
  const { authed, requireAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("carousel");
  const [selectedThemeId, setSelectedThemeId] = useState(
    () => searchParams.get("theme") || "",
  );
  const [featuredCardId, setFeaturedCardId] = useState<string | null>(
    () => searchParams.get("card"),
  );
  const [toast, setToast] = useState<string | null>(null);
  const followId = (model?.id ?? creatorId).trim();
  const [following, setFollowing] = useState(() => isFollowing(followId));

  useEffect(() => {
    setFollowing(isFollowing(followId));
  }, [followId, authed]);

  const themes: ThemeCardData[] = useMemo(
    () =>
      collection.themes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        thumbnailUrl: theme.coverUrl,
        // Guests browse catalog only — personal progress is API/session owned.
        collected: authed ? theme.collected : 0,
        total: theme.total,
        progressColor: "pink" as const,
      })),
    [collection.themes, authed],
  );

  const usingLiveThemes = themes.length > 0;
  const creatorName =
    (model ? modelDisplayName(model) : "") ||
    titleCaseSlug(creatorId) ||
    creatorId;
  const username =
    formatSocialHandle(model?.label) ||
    formatSocialHandle(creatorId) ||
    "";
  const creatorDescription = `${creatorName} brings confidence, charm, and energy to every moment. Explore her exclusive collections.`;
  const themeTags = themes.map((entry) => entry.name).slice(0, 6);
  const purchaseCreatorId = creatorId || model?.id || "";

  useEffect(() => {
    if (!usingLiveThemes) return;

    const urlTheme = searchParams.get("theme");
    const urlCard = searchParams.get("card");
    const wantedId = urlTheme || selectedThemeId;

    const themeFromCard = urlCard
      ? themes.find((entry) =>
          (collection.cardsByThemeId[entry.id] ?? []).some(
            (card) => card.id === urlCard,
          ),
        )
      : undefined;

    const nextThemeId =
      themeFromCard?.id ??
      matchLiveThemeId(wantedId, themes) ??
      themes[0]!.id;

    const nextCardId =
      urlCard &&
      (collection.cardsByThemeId[nextThemeId] ?? []).some(
        (card) => card.id === urlCard,
      )
        ? urlCard
        : null;

    if (nextThemeId !== selectedThemeId) {
      setSelectedThemeId(nextThemeId);
    }
    if (nextCardId !== featuredCardId) {
      setFeaturedCardId(nextCardId);
    }
    if (urlTheme !== nextThemeId || (urlCard ?? null) !== nextCardId) {
      const next = new URLSearchParams(searchParams);
      if (nextCardId) next.set("card", nextCardId);
      else next.delete("card");
      next.set("theme", nextThemeId);
      setSearchParams(next, { replace: true });
    }
  }, [
    themes,
    usingLiveThemes,
    selectedThemeId,
    featuredCardId,
    searchParams,
    setSearchParams,
    collection.cardsByThemeId,
  ]);

  const theme =
    themes.find((entry) => entry.id === selectedThemeId) ?? themes[0];
  const avatarUrl =
    (model?.avatar ? normalizeMediaUrl(model.avatar) : "") ||
    theme?.thumbnailUrl ||
    "";
  // Prefer uploaded landscape cover for the top hero; fall back to avatar.
  const coverUrl =
    (model?.coverUrl ? normalizeMediaUrl(model.coverUrl) : "") || avatarUrl;

  function notice(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function syncCardParam(cardId: string | null, themeId?: string) {
    const next = new URLSearchParams(searchParams);
    if (cardId) next.set("card", cardId);
    else next.delete("card");
    if (themeId) next.set("theme", themeId);
    setSearchParams(next, { replace: true });
  }

  function handlePlayGame(playModelId: string, cardId: string, _cardName: string) {
    const card = cardId.trim();
    const playModel = playModelId.trim();
    if (!card || !playModel) return;
    syncCardParam(card, selectedThemeId);
    navigate(
      Paths.gamePlay(playModel, card, {
        creatorId,
        themeId: selectedThemeId,
      }),
    );
  }

  function handleToggleFollow() {
    if (!authed) {
      requireAuth({
        type: "follow",
        creatorId: followId || creatorId,
        displayName: creatorName,
        avatarUrl: avatarUrl || "/img/placeholder.png",
      });
      return;
    }

    if (following) {
      unfollowCreator(followId);
      setFollowing(false);
      notice(`Unfollowed ${creatorName}`);
      return;
    }

    const fromModel = model ? followedCreatorFromModel(model) : null;
    const entry =
      fromModel ??
      ({
        id: followId || creatorId,
        displayName: creatorName,
        username: "",
        avatarUrl: avatarUrl || "/img/placeholder.png",
        followedAt: Date.now(),
        hasUnseenActivity: false,
      } as const);

    followCreator(entry);
    setFollowing(true);
    notice(`Following ${creatorName}`);
  }

  function switchMode(mode: ViewMode) {
    if (mode === viewMode) return;
    setFeaturedCardId(null);
    syncCardParam(null, selectedThemeId);
    setViewMode(mode);
  }

  function buyThemePack(themeId: string) {
    const packTheme =
      themes.find((entry) => entry.id === themeId) ?? themes[0];
    if (!packTheme) return;
    const packId = `${purchaseCreatorId}-${packTheme.id}-buy`;
    const cost = packUnitCost(packId);
    onBuyPack({
      packId,
      packName: packTheme.name,
      themeName: packTheme.name,
      price: `${cost} ◆`,
      creator: creatorName,
      entry: "purchase",
    });
  }

  return (
    <section data-page-scroll className="cpv2-page no-sticky-cta">
      <div className="cpv2-shell">
        <CreatorHeader
          name={creatorName}
          username={username}
          coverUrl={coverUrl}
          description={creatorDescription}
          tags={themeTags}
          onBack={onBack}
          following={following}
          onToggleFollow={handleToggleFollow}
        />

        <div className="cpv2-choose-row" id="cpv2-choose-theme">
          <h2 className="cpv2-choose-title">Choose a Theme</h2>
          <ViewModeToggle value={viewMode} onChange={switchMode} />
        </div>

        <div key={viewMode} className="cpv2-mode-panel">
          {viewMode === "grid" ? (
            <CreatorCollectionsDiscovery
              creatorId={purchaseCreatorId}
              themes={themes}
              selectedThemeId={theme?.id ?? selectedThemeId}
              onSelectTheme={(id) => {
                setSelectedThemeId(id);
                syncCardParam(null, id);
              }}
              cardsByThemeId={collection.cardsByThemeId}
              loading={collection.loading}
              showPersonalProgress={authed}
              onBuyPack={buyThemePack}
              onOpenCollectedCard={(cardId) => {
                setFeaturedCardId(cardId);
                syncCardParam(cardId, selectedThemeId);
              }}
              onLockedCardHint={() => notice("Not collected yet")}
            />
          ) : (
            <CreatorCollectionBrowse
              modelId={collection.modelId}
              focusCardId={searchParams.get("card")}
              onPlayGame={handlePlayGame}
              onViewCard={(name) => notice(`View ${name}`)}
            />
          )}
        </div>
      </div>

      {toast ? <div className="cpv2-toast">{toast}</div> : null}

      {viewMode === "grid" &&
      featuredCardId &&
      collection.modelId ? (
        <FeaturedCardOverlay
          modelId={collection.modelId}
          cardId={featuredCardId}
          onClose={() => {
            setFeaturedCardId(null);
            syncCardParam(null, selectedThemeId);
          }}
          onPlayGame={handlePlayGame}
          onViewCard={(name) => notice(`View ${name}`)}
        />
      ) : null}
    </section>
  );
}
