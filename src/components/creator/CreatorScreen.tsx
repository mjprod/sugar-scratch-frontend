import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useCreatorCollection } from "@/features/collection/useCreatorCollection";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import {
  getCreatorPage,
  getStickyCtaMode,
  type ThemeCardData,
} from "@/services/collection";
import type { PurchaseFlowPack } from "@/services/purchase";
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
  const [preferredModelId, setPreferredModelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveModelIdForCreator(creatorId).then(({ modelId }) => {
      if (!cancelled) setPreferredModelId(modelId);
    });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  return (
    <CatalogProvider preferredModelId={preferredModelId}>
      <CreatorScreenInner
        creatorId={creatorId}
        diamonds={diamonds}
        modelId={preferredModelId}
        onBack={onBack}
        onOpenPack={onOpenPack}
        onBuyPack={onBuyPack}
      />
    </CatalogProvider>
  );
}

function CreatorScreenInner({
  creatorId,
  diamonds,
  modelId,
  onBack,
  onOpenPack,
  onBuyPack,
}: {
  creatorId: string;
  diamonds: number;
  modelId: string | null;
  onBack: () => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onBuyPack: (pack: PurchaseFlowPack) => void;
}) {
  const page = useMemo(() => getCreatorPage(creatorId), [creatorId]);
  const collection = useCreatorCollection(modelId);
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

  useEffect(() => {
    if (apiThemes.length === 0) return;
    if (!apiThemes.some((theme) => theme.id === selectedThemeId)) {
      setSelectedThemeId(apiThemes[0]!.id);
    }
  }, [apiThemes, selectedThemeId]);

  const theme =
    themes.find((entry) => entry.id === selectedThemeId) ?? themes[0];
  const detail = page.themeDetails[theme?.id ?? ""] ?? {
    themeId: theme?.id ?? "",
    themeName: theme?.name ?? "Theme",
    seriesLabel: "Series",
    packName: theme?.name ?? "Pack",
    unopenedPacks: 0,
    photoCards: [],
    motionCards: [],
  };
  const motionCards = collection.cardsByThemeId[theme?.id ?? ""] ?? [];
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
      packId: `${page.creator.id}-${theme?.id ?? "theme"}-owned`,
      packName: theme?.name ?? "Pack",
      price: "Free",
      creator: page.creator.name,
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
      packId: `${page.creator.id}-${theme?.id ?? "theme"}-buy`,
      packName: theme?.name ?? "Pack",
      price: "10 ◆",
      creator: page.creator.name,
      entry: "purchase",
    });
  }

  function handlePlayGame(modelId: string, cardId: string, cardName: string) {
    syncCardParam(cardId, selectedThemeId);
    onOpenPack({
      packId: `${modelId}:${cardId}`,
      packName: cardName,
      price: "",
      creator: page.creator.name,
      entry: "scratch",
    });
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
          name={page.creator.name}
          coverUrl={page.creator.coverUrl}
          onBack={onBack}
        />
        <StatsBar stats={page.creator.stats} />

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
