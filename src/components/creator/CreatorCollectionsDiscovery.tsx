import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import type { CardConfig } from "@/features/collection/lib/cards";
import type { ThemeCardData, ThemeDetailData } from "@/services/collection";
import { packUnitCost } from "@/services/purchase";
import "./creator-collections-discovery.css";

export type CollectionPreviewCard = {
  id: string;
  number: string;
  collected: boolean;
  /**
   * Artwork for this slot. Collected → full reveal.
   * Uncollected → same asset rendered as a blurred/dark teaser (unique per card).
   */
  thumbnailUrl?: string;
  motionCardId: string;
};

const PREVIEW_LIMIT = 10;

const THEME_GLYPH: Record<string, string> = {
  firegirl: "🔥",
  firefighter: "🔥",
  fire: "🔥",
  nurse: "✚",
  teacher: "📖",
  gym: "🏋",
  police: "🚓",
  cop: "🚓",
  bikini: "☀",
  summer: "☀",
  casual: "✦",
  office: "💼",
  cyber: "⚡",
  midnight: "🌙",
};

function themeGlyph(theme: Pick<ThemeCardData, "id" | "name">): string {
  const key = `${theme.id} ${theme.name}`.toLowerCase();
  for (const [id, glyph] of Object.entries(THEME_GLYPH)) {
    if (key.includes(id)) return glyph;
  }
  return "✦";
}

function themeDescription(creatorName: string, themeName: string): string {
  const name = creatorName.trim() || "This creator";
  const theme = themeName.trim() || "this collection";
  return `Hot looks and exclusive motion cards.\n${name} as ${theme}.`;
}

/** First N photo-slot cards across the theme's motion cards (preview only). */
export function buildCollectionPreviewCards(
  motionCards: readonly CardConfig[],
  limit = PREVIEW_LIMIT,
): CollectionPreviewCard[] {
  const out: CollectionPreviewCard[] = [];
  let sequence = 0;
  for (const card of motionCards) {
    const filled = Math.max(0, Math.min(10, card.photoFilledCount ?? 0));
    const motionTeaser =
      card.mediaType === "image" && card.mediaUrl?.trim()
        ? card.mediaUrl.trim()
        : "";
    for (let slot = 0; slot < 10; slot++) {
      sequence += 1;
      const collected = slot < filled;
      const slotUrl = card.photoUrls?.[slot]?.trim() || "";
      // Prefer per-slot art; fall back to motion poster so locked cards stay unique.
      const thumbnailUrl = slotUrl || motionTeaser || undefined;
      out.push({
        id: `${card.id}:slot:${slot}`,
        number: String(sequence).padStart(2, "0"),
        collected,
        thumbnailUrl,
        motionCardId: card.id,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function buildPreviewFromThemeDetail(
  detail: ThemeDetailData | undefined,
  limit = PREVIEW_LIMIT,
): CollectionPreviewCard[] {
  if (!detail) return [];
  return detail.photoCards.slice(0, limit).map((card) => ({
    id: `${detail.themeId}-photo-${card.index}`,
    number: String(card.index).padStart(2, "0"),
    collected: card.isUnlocked,
    // Keep teaser art for locked slots — CSS obscures it.
    thumbnailUrl: card.thumbnailUrl || undefined,
    motionCardId: detail.motionCards[0]
      ? `${detail.themeId}-m${detail.motionCards[0].index}`
      : detail.themeId,
  }));
}

export function CreatorCollectionsDiscovery({
  creatorName,
  themes,
  selectedThemeId,
  onSelectTheme,
  cardsByThemeId,
  themeDetails,
  loading,
  showPersonalProgress,
  onBuyPack,
  onOpenCollectedCard,
  onLockedCardHint,
}: {
  creatorName: string;
  themes: ThemeCardData[];
  selectedThemeId: string;
  onSelectTheme: (themeId: string) => void;
  cardsByThemeId: Record<string, CardConfig[]>;
  themeDetails?: Record<string, ThemeDetailData>;
  loading?: boolean;
  showPersonalProgress: boolean;
  onBuyPack: (themeId: string) => void;
  onOpenCollectedCard: (motionCardId: string) => void;
  onLockedCardHint: () => void;
}) {
  const selectedIndex = Math.max(
    0,
    themes.findIndex((theme) => theme.id === selectedThemeId),
  );
  const selected = themes[selectedIndex] ?? themes[0];
  const motionCards = cardsByThemeId[selected?.id ?? ""] ?? [];
  const previewCards = useMemo(() => {
    const fromLive = buildCollectionPreviewCards(motionCards, PREVIEW_LIMIT);
    if (fromLive.length > 0) return fromLive;
    return buildPreviewFromThemeDetail(
      selected ? themeDetails?.[selected.id] : undefined,
      PREVIEW_LIMIT,
    );
  }, [motionCards, selected, themeDetails]);
  const navRef = useRef<HTMLDivElement>(null);
  const [fadeKey, setFadeKey] = useState(selected?.id ?? "");
  const packCost = packUnitCost(
    selected ? `${selected.id}-buy` : "pack",
  );

  useEffect(() => {
    setFadeKey(selected?.id ?? "");
  }, [selected?.id]);

  useEffect(() => {
    const el = navRef.current;
    if (!el || !selected) return;
    const row = Array.from(el.children).find(
      (child) =>
        (child as HTMLElement).dataset.collectionId === selected.id,
    ) as HTMLElement | undefined;
    row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected?.id]);

  if (themes.length === 0 && !loading) {
    return null;
  }

  const glyph = selected ? themeGlyph(selected) : "✦";
  const cover = selected?.thumbnailUrl?.trim() || "";
  const total = selected?.total ?? 0;
  const collected = selected?.collected ?? 0;
  const description = selected
    ? themeDescription(creatorName, selected.name)
    : "";
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex < themes.length - 1;

  function stepTheme(delta: number) {
    const next = themes[selectedIndex + delta];
    if (next) onSelectTheme(next.id);
  }

  return (
    <section
      className="ccd"
      aria-label="Creator collections"
      id="creator-collections-discovery"
    >
      {/* Left — theme navigation */}
      <aside className="ccd-nav">
        <h3 className="ccd-nav-title">Collections</h3>
        <div
          ref={navRef}
          className="ccd-nav-list"
          role="listbox"
          aria-label="Collections"
        >
          {loading && themes.length === 0
            ? Array.from({ length: 5 }, (_, i) => (
                <div
                  key={`sk-${i}`}
                  className="ccd-nav-row is-skeleton"
                  aria-hidden="true"
                />
              ))
            : themes.map((theme) => {
                const active = theme.id === selected?.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-collection-id={theme.id}
                    className={["ccd-nav-row", active ? "is-active" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSelectTheme(theme.id)}
                  >
                    <span className="ccd-nav-thumb">
                      {theme.thumbnailUrl ? (
                        <img
                          src={theme.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          draggable={false}
                        />
                      ) : null}
                    </span>
                    <span className="ccd-nav-copy">
                      <span className="ccd-nav-name">
                        <span aria-hidden="true">{themeGlyph(theme)} </span>
                        {theme.name}
                      </span>
                      {showPersonalProgress ? (
                        <span className="ccd-nav-progress">
                          {theme.collected} / {theme.total}
                        </span>
                      ) : (
                        <span className="ccd-nav-progress">
                          {theme.total} Cards
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
        </div>
      </aside>

      {/* Center — selected theme hero */}
      <div className="ccd-hero" key={fadeKey}>
        {cover ? (
          <img
            src={cover}
            alt=""
            className="ccd-hero-art"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="ccd-hero-art ccd-hero-art--empty" aria-hidden="true" />
        )}
        <div className="ccd-hero-shade" aria-hidden="true" />

        <div className="ccd-hero-top">
          <button
            type="button"
            className="ccd-hero-step"
            aria-label="Previous theme"
            disabled={!canPrev}
            onClick={() => stepTheme(-1)}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ccd-hero-step"
            aria-label="Next theme"
            disabled={!canNext}
            onClick={() => stepTheme(1)}
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="ccd-hero-copy">
          <h3 className="ccd-hero-title">
            <span aria-hidden="true">{glyph} </span>
            {selected?.name ?? "Collection"}
          </h3>
          <p className="ccd-hero-meta">
            {total} Cards
            {showPersonalProgress ? (
              <>
                <span aria-hidden="true"> · </span>
                {collected} Collected
              </>
            ) : null}
          </p>
          {description ? (
            <p className="ccd-hero-desc">
              {description.split("\n").map((line, i) => (
                <span key={i}>
                  {i > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          ) : null}

          <button
            type="button"
            className="ccd-hero-cta"
            disabled={!selected}
            onClick={() => selected && onBuyPack(selected.id)}
          >
            <span>Buy Pack</span>
            <span className="ccd-hero-cta-cost">
              <DiamondLottie size={14} aria-hidden />
              {packCost}
            </span>
          </button>
        </div>
      </div>

      {/* Right — card preview */}
      <div className="ccd-preview" key={`preview-${fadeKey}`}>
        <div className="ccd-preview-head">
          <h4 className="ccd-preview-title">Card Preview</h4>
          {showPersonalProgress ? (
            <p className="ccd-preview-count">
              {collected} / {total}
            </p>
          ) : null}
        </div>

        <div className="ccd-preview-grid" aria-label="Card preview">
          {loading && previewCards.length === 0
            ? Array.from({ length: 8 }, (_, i) => (
                <div
                  key={`psk-${i}`}
                  className="ccd-preview-card is-skeleton"
                  aria-hidden="true"
                />
              ))
            : previewCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={[
                    "ccd-preview-card",
                    card.collected ? "is-collected" : "is-locked",
                    card.thumbnailUrl ? "has-art" : "no-art",
                  ].join(" ")}
                  aria-label={
                    card.collected
                      ? `Photo Card ${card.number} — Collected`
                      : `Photo Card ${card.number} — Not collected`
                  }
                  onClick={() => {
                    if (card.collected) onOpenCollectedCard(card.motionCardId);
                    else onLockedCardHint();
                  }}
                >
                  {card.thumbnailUrl ? (
                    <img
                      src={card.thumbnailUrl}
                      alt=""
                      className="ccd-preview-img"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <span className="ccd-preview-mark" aria-hidden="true">
                      S
                    </span>
                  )}
                  <span className="ccd-preview-shade" aria-hidden="true" />
                  {card.collected ? (
                    <span className="ccd-preview-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <>
                      <span className="ccd-preview-lock" aria-hidden="true">
                        <Lock size={11} strokeWidth={2.4} />
                      </span>
                      <span className="ccd-preview-hint" aria-hidden="true">
                        Not collected
                      </span>
                    </>
                  )}
                  <span className="ccd-preview-num">{card.number}</span>
                </button>
              ))}
        </div>
      </div>
    </section>
  );
}
