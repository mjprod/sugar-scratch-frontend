import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Gift, Lock } from "lucide-react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import type { CardConfig } from "@/features/collection/lib/cards";
import type { ThemeCardData, ThemeDetailData } from "@/services/collection";
import { packUnitCost } from "@/services/purchase";
import {
  claimThemeCompletionReward,
  getThemeCompletionReward,
  type ThemeRewardStatus,
} from "@/services/themeCompletionReward";
import {
  buildCollectionPreviewCards,
  buildPreviewFromThemeDetail,
  COLLECTION_PREVIEW_LIMIT,
} from "@/components/creator/collectionPreviewCards";
import "./creator-collections-discovery.css";

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

function rewardStatusForTheme(
  creatorId: string,
  theme: ThemeCardData,
  revision: number,
): ThemeRewardStatus {
  void revision;
  return getThemeCompletionReward({
    creatorId,
    themeId: theme.id,
    themeName: theme.name,
    collected: theme.collected,
    total: theme.total,
  }).status;
}

/**
 * DEV-only: force the first theme to 100% collected so claimable / claimed UI
 * can be reviewed without owning every card. Never runs in production.
 */
function withDemoCompleteTheme(themes: ThemeCardData[]): ThemeCardData[] {
  if (!import.meta.env.DEV || themes.length === 0) return themes;
  const demoId = themes[0]!.id;
  return themes.map((theme) =>
    theme.id === demoId
      ? {
          ...theme,
          collected: Math.max(theme.total, 1),
          total: Math.max(theme.total, 1),
        }
      : theme,
  );
}

export function CreatorCollectionsDiscovery({
  creatorId,
  themes: themesIn,
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
  creatorId: string;
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
  const { requireAuth } = useAuth();
  const { addDiamonds } = useWallet();
  const [rewardRevision, setRewardRevision] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [justComplete, setJustComplete] = useState(false);
  const prevPctRef = useRef(0);

  const themes = useMemo(() => withDemoCompleteTheme(themesIn), [themesIn]);
  const demoCompleteThemeId = import.meta.env.DEV
    ? (themes[0]?.id ?? null)
    : null;

  const selectedIndex = Math.max(
    0,
    themes.findIndex((theme) => theme.id === selectedThemeId),
  );
  const selected = themes[selectedIndex] ?? themes[0];
  const motionCards = cardsByThemeId[selected?.id ?? ""] ?? [];
  const previewCards = useMemo(() => {
    const fromLive = buildCollectionPreviewCards(
      motionCards,
      COLLECTION_PREVIEW_LIMIT,
    );
    const base =
      fromLive.length > 0
        ? fromLive
        : buildPreviewFromThemeDetail(
            selected ? themeDetails?.[selected.id] : undefined,
            COLLECTION_PREVIEW_LIMIT,
          );
    if (!selected || !demoCompleteThemeId || selected.id !== demoCompleteThemeId)
      return base;
    // DEV demo: match 100% progress — show every preview slot as collected.
    return base.map((card) => ({
      ...card,
      collected: true,
      thumbnailUrl: card.thumbnailUrl || "/img/SugarScratch.png",
    }));
  }, [motionCards, selected, themeDetails, demoCompleteThemeId]);
  const navRef = useRef<HTMLDivElement>(null);
  const [fadeKey, setFadeKey] = useState(selected?.id ?? "");
  const packCost = packUnitCost(
    selected ? `${creatorId}-${selected.id}-buy` : "pack",
  );

  const reward = useMemo(() => {
    if (!selected) return null;
    return getThemeCompletionReward({
      creatorId,
      themeId: selected.id,
      themeName: selected.name,
      collected: selected.collected,
      total: selected.total,
    });
  }, [creatorId, selected, rewardRevision]);

  const total = selected?.total ?? 0;
  const collected = Math.min(
    total,
    Math.max(0, selected?.collected ?? 0),
  );
  const pct =
    total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;

  const progressAria =
    !selected || total <= 0
      ? undefined
      : reward?.status === "claimed"
        ? `${selected.name} collection complete. Theme reward claimed.`
        : reward?.status === "claimable"
          ? `${selected.name} collection complete. Theme reward available.`
          : `${selected.name} collection progress: ${collected} of ${total} cards collected. Theme reward unlocks when all ${total} cards are collected.`;

  useEffect(() => {
    setFadeKey(selected?.id ?? "");
    setClaimError(null);
    setJustComplete(false);
    prevPctRef.current = pct;
  }, [selected?.id]);

  useEffect(() => {
    if (!showPersonalProgress || !selected) return;
    const was = prevPctRef.current;
    prevPctRef.current = pct;
    if (was < 100 && pct >= 100 && reward?.status === "claimable") {
      setJustComplete(true);
      const t = window.setTimeout(() => setJustComplete(false), 1100);
      return () => window.clearTimeout(t);
    }
  }, [pct, reward?.status, selected, showPersonalProgress]);

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
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex < themes.length - 1;

  function stepTheme(delta: number) {
    const next = themes[selectedIndex + delta];
    if (next) onSelectTheme(next.id);
  }

  async function handleClaim() {
    if (!selected || claiming) return;
    if (!requireAuth({ type: "claim" })) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      // Eligibility from un-faked API progress — presentation demo cannot grant.
      const real = themesIn.find((t) => t.id === selected.id) ?? selected;
      const result = claimThemeCompletionReward({
        creatorId,
        themeId: selected.id,
        themeName: selected.name,
        collected: real.collected,
        total: real.total,
      });
      if (!result.ok) {
        setClaimError(result.message || "Couldn't claim reward. Please try again.");
        return;
      }
      if (!result.alreadyClaimed && result.diamondAmount > 0) {
        addDiamonds(result.diamondAmount);
      }
      setRewardRevision((n) => n + 1);
    } catch {
      setClaimError("Couldn't claim reward. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <section
      className="ccd"
      aria-label="Creator collections"
      id="creator-collections-discovery"
    >
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
                const status = showPersonalProgress
                  ? rewardStatusForTheme(creatorId, theme, rewardRevision)
                  : "locked";
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
                    {status === "claimable" ? (
                      <span
                        className="ccd-nav-reward is-claimable"
                        title={`${theme.name} Completion Reward ready to claim`}
                        aria-label="Reward available"
                      >
                        <Gift size={14} strokeWidth={2} />
                      </span>
                    ) : null}
                    {status === "claimed" ? (
                      <span
                        className="ccd-nav-reward is-claimed"
                        title="Reward claimed"
                        aria-label="Reward claimed"
                      >
                        <Check size={14} strokeWidth={2.4} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
        </div>
      </aside>

      <div
        className={["ccd-hero", justComplete ? "is-just-complete" : ""]
          .filter(Boolean)
          .join(" ")}
        key={fadeKey}
      >
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
            className="ccd-hero-step glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
            aria-label="Previous theme"
            disabled={!canPrev}
            onClick={() => stepTheme(-1)}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ccd-hero-step glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
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

          <div className="ccd-hero-actions">
            {total > 0 ? (
              <div
                className={[
                  "ccd-progress",
                  reward?.status === "locked" ? "is-locked" : "",
                  reward?.status === "claimable" ? "is-claimable" : "",
                  reward?.status === "claimed" ? "is-claimed" : "",
                  justComplete ? "is-celebrating" : "",
                  pct >= 90 && reward?.status === "locked" ? "is-near" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className="ccd-progress-label">Collection Progress</p>
                <div className="ccd-progress-body">
                  <div className="ccd-progress-main">
                    <div
                      className="ccd-progress-track"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={progressAria}
                      aria-label={progressAria}
                    >
                      <span
                        className="ccd-progress-fill"
                        style={{ width: `${pct}%` }}
                      />
                      <span
                        className="ccd-progress-knob"
                        style={{ left: pct <= 0 ? "7px" : `${pct}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="ccd-progress-count">
                      {collected} / {total}
                    </p>
                  </div>
                  <div className="ccd-progress-reward" aria-hidden="true">
                    <span className="ccd-progress-reward-icon">
                      <span className="ccd-progress-sparkle s1" />
                      <span className="ccd-progress-sparkle s2" />
                      <span className="ccd-progress-sparkle s3" />
                      <span className="ccd-progress-sparkle s4" />
                      {reward?.status === "claimed" ? (
                        <Check size={13} strokeWidth={2.5} />
                      ) : (
                        <Gift size={13} strokeWidth={2.1} />
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="ccd-hero-cta"
              disabled={!selected}
              onClick={() => selected && onBuyPack(selected.id)}
            >
              <span className="ccd-hero-cta-cost">
                <DiamondLottie size={15} aria-hidden />
                {packCost}
              </span>
              <span>Buy Pack</span>
            </button>
          </div>
        </div>
      </div>

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

        {showPersonalProgress && reward && reward.status !== "locked" ? (
          <div
            className={[
              "ccd-reward",
              reward.status === "claimable" ? "is-claimable" : "is-claimed",
              justComplete ? "is-celebrating" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="ccd-reward-icon" aria-hidden="true">
              {reward.status === "claimed" ? (
                <Check size={18} strokeWidth={2.4} />
              ) : (
                <Gift size={18} strokeWidth={2} />
              )}
            </div>
            <div className="ccd-reward-copy">
              <p className="ccd-reward-title">
                {selected?.name ?? "Theme"} Collection Complete
                {reward.status === "claimable" ? "!" : ""}
              </p>
              <p className="ccd-reward-desc">
                {reward.status === "claimed"
                  ? "Reward Claimed ✓"
                  : reward.description}
              </p>
              {claimError ? (
                <p className="ccd-reward-error" role="alert">
                  {claimError}
                </p>
              ) : null}
            </div>
            {reward.status === "claimable" ? (
              <button
                type="button"
                className="ccd-reward-cta"
                disabled={claiming}
                onClick={() => void handleClaim()}
              >
                {claiming ? "Claiming…" : claimError ? "Try Again" : "Claim Reward"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
