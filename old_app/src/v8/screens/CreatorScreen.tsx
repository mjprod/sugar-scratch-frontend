import { useMemo, useState } from "react";
import { CollectionPlaceholder } from "../components/collection/CollectionPlaceholder";
import { CreatorHeader } from "../components/creator/CreatorHeader";
import { SelectedThemeDetail } from "../components/creator/SelectedThemeDetail";
import { StatsBar } from "../components/creator/StatsBar";
import { StickyFooterCTA } from "../components/creator/StickyFooterCTA";
import { ThemeHeroCarousel } from "../components/creator/ThemeHeroCarousel";
import { ThemeSelector } from "../components/creator/ThemeSelector";
import { ViewModeToggle, type ViewMode } from "../components/creator/ViewModeToggle";
import { getCreatorPage, getStickyCtaMode } from "../flow/collection";
import type { PurchaseFlowPack } from "../flow/purchase";

/**
 * Creator Page V2 — {Creator}'s Scratches with Grid / Carousel theme modes.
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
  const page = useMemo(() => getCreatorPage(creatorId), [creatorId]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedThemeId, setSelectedThemeId] = useState(page.themes[0]?.id ?? "summer");
  const [activeThemeIndex, setActiveThemeIndex] = useState(0);
  const [isThemeDetailRevealed, setIsThemeDetailRevealed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);

  const focusedThemeId =
    viewMode === "grid"
      ? selectedThemeId
      : (page.themes[activeThemeIndex]?.id ?? selectedThemeId);

  const theme =
    page.themes.find((entry) => entry.id === focusedThemeId) ?? page.themes[0];
  const detail = page.themeDetails[theme.id];
  const ctaMode = getStickyCtaMode({
    detail,
    theme,
    collected: theme.collected,
    total: theme.total,
  });

  function notice(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function openOwnedPack() {
    onOpenPack({
      packId: `${page.creator.id}-${theme.id}-owned`,
      packName: theme.name,
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
      packId: `${page.creator.id}-${theme.id}-buy`,
      packName: theme.name,
      price: "10 ◆",
      creator: page.creator.name,
      entry: "purchase",
    });
  }

  function switchMode(mode: ViewMode) {
    if (mode === viewMode) return;
    if (mode === "carousel") {
      const index = Math.max(
        0,
        page.themes.findIndex((entry) => entry.id === selectedThemeId),
      );
      setActiveThemeIndex(index);
      setIsThemeDetailRevealed(false);
    } else {
      const id = page.themes[activeThemeIndex]?.id ?? selectedThemeId;
      setSelectedThemeId(id);
    }
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
                themes={page.themes}
                selectedThemeId={selectedThemeId}
                onSelect={setSelectedThemeId}
              />
              <SelectedThemeDetail
                detail={detail}
                collected={theme.collected}
                total={theme.total}
                onOpenPackShortcut={openOwnedPack}
                onToast={notice}
              />
            </>
          ) : (
            <>
              <ThemeHeroCarousel
                themes={page.themes}
                activeIndex={activeThemeIndex}
                onActiveIndexChange={setActiveThemeIndex}
                onActivateFocused={() => setIsThemeDetailRevealed(true)}
              />
              {isThemeDetailRevealed ? (
                <SelectedThemeDetail
                  detail={detail}
                  collected={theme.collected}
                  total={theme.total}
                  onOpenPackShortcut={openOwnedPack}
                  onToast={notice}
                />
              ) : (
                <p className="cpv2-reveal-hint">
                  Tap the theme above to see its cards
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <StickyFooterCTA
        mode={ctaMode}
        theme={theme}
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
          detail={theme.name}
          onClose={() => setOverlay(null)}
        />
      ) : null}
    </section>
  );
}
