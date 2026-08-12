import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Paths } from "@/routes/Paths";
import { CollectionPlaceholder } from "@/components/collection/CollectionPlaceholder";
import { CreatorCollectionBrowse } from "@/components/creator/CreatorCollectionBrowse";
import { CreatorHeader } from "@/components/creator/CreatorHeader";
import { FeaturedCardOverlay } from "@/components/creator/FeaturedCardOverlay";
import { StatsBar } from "@/components/creator/StatsBar";
import { StickyFooterCTA } from "@/components/creator/StickyFooterCTA";
import { ThemeMotionDetail } from "@/components/creator/ThemeMotionDetail";
import { ThemeSelector } from "@/components/creator/ThemeSelector";
import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/creator/ViewModeToggle";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import {
  normalizeMediaUrl,
  type BackendModel,
} from "@/shared/backend/collection";
import { modelDisplayName } from "@/shared/backend/modelProfile";
import {
  useCreatorCollection,
  type CreatorCollectionState,
} from "@/features/collection/useCreatorCollection";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import {
  getCreatorPage,
  getStickyCtaMode,
  matchLiveThemeId,
  resolveThemeDetail,
  countMatchingUnopened,
  countMatchingScratchReady,
  type CreatorPageData,
  type MotionCardSlot,
  type ThemeCardData,
} from "@/services/collection";
import { listUnopenedInstances } from "@/services/packInventory";
import { listReadyToScratch } from "@/services/readyToScratch";
import type { PurchaseFlowPack } from "@/services/purchase";
import type { CardConfig } from "@/features/collection/lib/cards";
import "./creator-collection.css";

/**
 * Creator Page V2 — {Creator}'s Scratches with Grid / Collection browse modes.
 */
export function CreatorScreen({
  creatorId,
  diamonds,
  onBack,
  onOpenPack,
  onBuyPack,
}: {
  creatorId: string;
  diamonds: number;
  onBack: () => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const [resolvedModel, setResolvedModel] = useState<BackendModel | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void resolveModelIdForCreator(creatorId).then(({ model }) => {
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
        diamonds={diamonds}
        model={resolvedModel}
        onBack={onBack}
        onOpenPack={onOpenPack}
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

function liveCreatorStats(
  page: CreatorPageData,
  collection: CreatorCollectionState,
  usingLiveThemes: boolean,
): CreatorPageData["creator"]["stats"] {
  if (!usingLiveThemes) return page.creator.stats;

  const motionTotal = collection.cards.length;
  const motionUnlocked = collection.cards.filter(
    (card) => (card.videoCardCount ?? 0) > 0 || Boolean(card.mediaUrl),
  ).length;
  const photoUnlocked = collection.themes.reduce(
    (sum, theme) => sum + theme.collected,
    0,
  );
  const photoTotal = collection.themes.reduce(
    (sum, theme) => sum + theme.total,
    0,
  );
  const themesCompleted = collection.themes.filter(
    (theme) => theme.total > 0 && theme.collected >= theme.total,
  ).length;

  return {
    collected: photoUnlocked,
    totalCollectible: Math.max(photoTotal, 1),
    motionCardsUnlocked: motionUnlocked,
    motionCardsTotal: motionTotal,
    photoCardsUnlocked: photoUnlocked,
    photoCardsTotal: photoTotal,
    themesCompleted,
    themeCount: collection.themes.length,
  };
}

function motionSlotsFromCards(cards: CardConfig[]): MotionCardSlot[] {
  return cards.map((card, index) => ({
    index: index + 1,
    label: card.name,
    isUnlocked: Boolean(card.mediaUrl) || (card.videoCardCount ?? 0) > 0,
    thumbnailUrl: card.mediaUrl || undefined,
  }));
}

function CreatorScreenInner({
  creatorId,
  diamonds,
  model,
  onBack,
  onOpenPack,
  onBuyPack,
}: {
  creatorId: string;
  diamonds: number;
  model: BackendModel | null;
  onBack: () => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const page = useMemo(() => getCreatorPage(creatorId), [creatorId]);
  const modelId = model?.id ?? null;
  const collection = useCreatorCollection(modelId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedThemeId, setSelectedThemeId] = useState(
    () => searchParams.get("theme") || page.themes[0]?.id || "summer",
  );
  const [featuredCardId, setFeaturedCardId] = useState<string | null>(
    () => searchParams.get("card"),
  );
  const [toast, setToast] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);

  const apiThemes: ThemeCardData[] = useMemo(
    () =>
      collection.themes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        thumbnailUrl: theme.coverUrl,
        collected: theme.collected,
        total: theme.total,
        progressColor: "pink" as const,
      })),
    [collection.themes],
  );

  const themes = apiThemes.length > 0 ? apiThemes : page.themes;
  const usingLiveThemes = apiThemes.length > 0;
  const creatorName =
    (model ? modelDisplayName(model) : "") ||
    titleCaseSlug(creatorId) ||
    page.creator.name;
  const purchaseCreatorId = creatorId || page.creator.id;
  const stats = liveCreatorStats(page, collection, usingLiveThemes);

  useEffect(() => {
    if (!usingLiveThemes) return;

    const urlTheme = searchParams.get("theme");
    const urlCard = searchParams.get("card");
    const wantedId = urlTheme || selectedThemeId;

    const themeFromCard = urlCard
      ? apiThemes.find((entry) =>
          (collection.cardsByThemeId[entry.id] ?? []).some(
            (card) => card.id === urlCard,
          ),
        )
      : undefined;

    const nextThemeId =
      themeFromCard?.id ??
      matchLiveThemeId(wantedId, apiThemes, page.themes) ??
      apiThemes[0]!.id;

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
    apiThemes,
    usingLiveThemes,
    selectedThemeId,
    featuredCardId,
    searchParams,
    setSearchParams,
    collection.cardsByThemeId,
    page.themes,
  ]);

  const theme =
    themes.find((entry) => entry.id === selectedThemeId) ?? themes[0];
  const coverUrl =
    (model?.avatar ? normalizeMediaUrl(model.avatar) : "") ||
    (usingLiveThemes ? (theme?.thumbnailUrl ?? "") : "") ||
    page.creator.coverUrl;
  const motionCards = collection.cardsByThemeId[theme?.id ?? ""] ?? [];
  const liveInventory = usingLiveThemes
    ? {
        unopenedPacks: countMatchingUnopened(theme, listUnopenedInstances()),
        scratchReady: countMatchingScratchReady(theme, listReadyToScratch()),
        motionCards: motionSlotsFromCards(motionCards),
      }
    : null;
  const detail = resolveThemeDetail(
    theme,
    page.themeDetails,
    liveInventory,
  );
  const ctaMode = getStickyCtaMode({
    detail,
    theme: theme ?? page.themes[0]!,
    collected: theme?.collected ?? 0,
    total: theme?.total ?? 1,
  });

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

  function openOwnedPack() {
    onOpenPack({
      packId: `${purchaseCreatorId}-${theme?.id ?? "theme"}-owned`,
      packName: theme?.name ?? "Pack",
      price: "Free",
      creator: creatorName,
      entry: "open",
      unopenedPacks: detail.unopenedPacks,
    });
  }

  function buyThemePack() {
    if (diamonds < 10) {
      notice("Not enough diamonds");
      return;
    }
    onBuyPack({
      packId: `${purchaseCreatorId}-${theme?.id ?? "theme"}-buy`,
      packName: theme?.name ?? "Pack",
      price: "10 ◆",
      creator: creatorName,
      entry: "purchase",
    });
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

  function switchMode(mode: ViewMode) {
    if (mode === viewMode) return;
    setFeaturedCardId(null);
    syncCardParam(null, selectedThemeId);
    setViewMode(mode);
  }

  return (
    <section
      data-page-scroll
      className={[
        "cpv2-page",
        ctaMode ? "has-sticky-cta" : "no-sticky-cta",
      ].join(" ")}
    >
      <div className="cpv2-shell">
        <CreatorHeader
          name={creatorName}
          coverUrl={coverUrl}
          onBack={onBack}
        />
        <StatsBar stats={stats} />

        <div className="cpv2-choose-row" id="cpv2-choose-theme">
          <h2 className="cpv2-choose-title">Choose a Theme</h2>
          <ViewModeToggle value={viewMode} onChange={switchMode} />
        </div>

        <div key={viewMode} className="cpv2-mode-panel">
          {viewMode === "grid" ? (
            <>
              <ThemeSelector
                themes={themes}
                selectedThemeId={theme?.id ?? selectedThemeId}
                onSelect={(id) => {
                  setSelectedThemeId(id);
                  syncCardParam(null, id);
                }}
              />
              <ThemeMotionDetail
                themeName={theme?.name ?? "Theme"}
                cards={motionCards}
                loading={collection.loading}
                onSelectCard={(card) => {
                  setFeaturedCardId(card.id);
                  syncCardParam(card.id, theme?.id);
                }}
              />
            </>
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

      <StickyFooterCTA
        mode={ctaMode}
        theme={theme ?? page.themes[0]!}
        detail={detail}
        diamonds={diamonds}
        onScratch={() => setOverlay("Scratch Flow")}
        onOpenPack={openOwnedPack}
        onBuy={buyThemePack}
        onView={() => setOverlay("View Collection")}
        onClaim={() => setOverlay("Claim Reward")}
      />

      {toast ? <div className="cpv2-toast">{toast}</div> : null}

      {overlay ? (
        <CollectionPlaceholder
          title={overlay}
          detail={theme?.name}
          onClose={() => setOverlay(null)}
        />
      ) : null}

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
