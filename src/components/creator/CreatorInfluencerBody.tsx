import { lazy, Suspense, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  type FeaturedCoverFlowPlayTarget,
} from "@/components/home/FeaturedCoverFlow";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import {
  createCard,
  type CardConfig,
} from "@/features/collection/lib/cards";
import type { ThemeCardData } from "@/services/collection";
import type { FeaturedPack } from "@/services/homepage";
import { Paths } from "@/routes/Paths";

const FeaturedCoverFlow = lazy(() =>
  import("@/components/home/FeaturedCoverFlow").then((m) => ({
    default: m.FeaturedCoverFlow,
  })),
);

const THEME_GLYPH: Record<string, string> = {
  firegirl: "🔥",
  firefighter: "🔥",
  fire: "🔥",
  nurse: "💉",
  teacher: "✏️",
  gym: "🎧",
  police: "🚨",
  cop: "🚨",
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

const EMPTY_FEATURED: FeaturedPack[] = [];

export function CreatorInfluencerBody({
  creatorName,
  creatorId,
  avatarUrl,
  themes,
  cardsByThemeId,
  showPersonalProgress,
  loading,
  onBuyPack,
  onAddPackToPocket,
  onOpenCard,
  onLockedHint,
  onPlayGame,
}: {
  creatorName: string;
  creatorId: string;
  avatarUrl: string;
  themes: ThemeCardData[];
  cardsByThemeId: Record<string, CardConfig[]>;
  showPersonalProgress: boolean;
  loading?: boolean;
  onBuyPack: (themeId?: string) => void;
  onAddPackToPocket: (pack: FeaturedCoverFlowPlayTarget) => void;
  onOpenCard: (cardId: string, themeId: string) => void;
  onLockedHint: () => void;
  onPlayGame: (modelId: string, cardId: string, cardName: string) => void;
}) {
  const navigate = useNavigate();
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const legalTitleId = useId();

  const totalCollected = themes.reduce((sum, t) => sum + t.collected, 0);
  const totalCards = themes.reduce((sum, t) => sum + t.total, 0);
  const totalPct =
    totalCards > 0
      ? Math.min(100, Math.round((totalCollected / totalCards) * 100))
      : 0;

  const premiumUnlocked = themes.reduce((count, theme) => {
    const cards = cardsByThemeId[theme.id] ?? [];
    return (
      count +
      cards.filter((card) => (card.photoFilledCount ?? 0) >= 10).length
    );
  }, 0);
  const premiumTarget = Math.max(themes.length, 4);
  const premiumRemaining = Math.max(0, premiumTarget - premiumUnlocked);

  // Figma 123:2309 — looped Ultra Card teaser uses Police motion card 01.
  const ultraPreview = useMemo(() => {
    const entries = Object.entries(cardsByThemeId);
    const policeEntry =
      entries.find(([themeId, cards]) => {
        const theme = themes.find((t) => t.id === themeId);
        const hay = `${themeId} ${theme?.name ?? ""} ${cards[0]?.groupTheme ?? ""}`.toLowerCase();
        return /police|cop/.test(hay);
      }) ?? entries[0];

    const cards = policeEntry?.[1] ?? [];
    const first =
      cards.find(
        (card) =>
          !card.id.includes("-placeholder-") &&
          card.mediaType === "video" &&
          Boolean(card.mediaUrl?.trim()),
      ) ?? cards[0];

    if (!first) {
      return { videoUrl: "", posterUrl: avatarUrl || "" };
    }

    const videoUrl =
      first.mediaType === "video" && first.mediaUrl?.trim()
        ? first.mediaUrl.trim()
        : "";
    const posterUrl =
      first.posterUrl?.trim() ||
      (first.mediaType === "image" ? first.mediaUrl?.trim() : "") ||
      avatarUrl ||
      "";

    return { videoUrl, posterUrl };
  }, [avatarUrl, cardsByThemeId, themes]);

  return (
    <div className="cpv2-influencer">
      <h2 className="cpv2-section-title">Buy {creatorName} Packs</h2>

      <section className="cpv2-pack-section" aria-label="Pack offers">
        <div className="cpv2-pack-coverflow">
          <Suspense
            fallback={
              <div
                className="home-featured-coverflow is-loading"
                aria-hidden="true"
              />
            }
          >
            <FeaturedCoverFlow
              featured={EMPTY_FEATURED}
              creatorId={creatorId}
              onPlay={onAddPackToPocket}
              influencerBackdrop
            />
          </Suspense>
        </div>
        <p className="cpv2-pack-disclaimer">
          *Motion Cards Themes are randomised in packs.
          <br />
          <button
            type="button"
            className="cpv2-pack-odds"
            onClick={() => setLegal("terms")}
          >
            Read Disclosure Odds
          </button>
        </p>
      </section>

      <section
        className="cpv2-progress-panel"
        aria-label="Collection progress"
      >
        <h3 className="cpv2-progress-title">Collection Progress</h3>
        <div
          className="cpv2-progress-overall"
          role="progressbar"
          aria-valuenow={totalPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall collection ${totalCollected} of ${totalCards}`}
        >
          <span
            className="cpv2-progress-overall-fill"
            style={{ width: `${totalPct}%` }}
          />
        </div>
        <ul className="cpv2-progress-list">
          {loading && themes.length === 0
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={`sk-${i}`} className="cpv2-progress-row is-skeleton" />
              ))
            : themes.map((theme) => {
                const pct =
                  theme.total > 0
                    ? Math.min(
                        100,
                        Math.round((theme.collected / theme.total) * 100),
                      )
                    : 0;
                return (
                  <li key={theme.id} className="cpv2-progress-row">
                    <span className="cpv2-progress-label">{theme.name}</span>
                    <div className="cpv2-progress-track">
                      <span
                        className="cpv2-progress-fill"
                        style={{ width: `${showPersonalProgress ? pct : 0}%` }}
                      />
                    </div>
                  </li>
                );
              })}
          <li className="cpv2-progress-row is-total">
            <span className="cpv2-progress-label">Total</span>
            <div className="cpv2-progress-track">
              <span
                className="cpv2-progress-fill"
                style={{
                  width: `${showPersonalProgress ? totalPct : 0}%`,
                }}
              />
            </div>
          </li>
        </ul>
      </section>

      <div className="cpv2-theme-stack">
        {themes.map((theme) => (
          <ThemeCollectionCard
            key={theme.id}
            theme={theme}
            glyph={themeGlyph(theme)}
            avatarUrl={theme.thumbnailUrl || avatarUrl}
            cards={cardsByThemeId[theme.id] ?? []}
            showPersonalProgress={showPersonalProgress}
            onBuyPack={() => onBuyPack(theme.id)}
            onOpenCard={(cardId) => onOpenCard(cardId, theme.id)}
            onLockedHint={onLockedHint}
            onPlayGame={onPlayGame}
          />
        ))}
      </div>

      <button
        type="button"
        className="cpv2-diamonds-cta"
        onClick={() => navigate(Paths.store)}
      >
        <span className="cpv2-diamonds-cta-title">
          Running low on Diamonds?
        </span>
        <span className="cpv2-diamonds-cta-btn">
          <DiamondLottie size={11} aria-hidden />
          Get Diamonds
        </span>
        <span className="cpv2-diamonds-orb is-a" aria-hidden="true">
          <DiamondLottie size={34} aria-hidden />
        </span>
        <span className="cpv2-diamonds-orb is-b" aria-hidden="true">
          <DiamondLottie size={24} aria-hidden />
        </span>
      </button>

      <section className="cpv2-ultra-panel" aria-label="Ultra Card">
        <div className="cpv2-ultra-glow" aria-hidden="true" />
        <p className="cpv2-ultra-reward">
          Complete {creatorName}&rsquo;s Collection for your chance to{" "}
          <span>win 1000 Diamonds</span>
        </p>
        <div className="cpv2-ultra-card-art" aria-hidden="true">
          {ultraPreview.videoUrl ? (
            <video
              className="cpv2-ultra-card-video"
              src={ultraPreview.videoUrl}
              poster={ultraPreview.posterUrl || undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={ultraPreview.posterUrl || avatarUrl || "/img/placeholder.png"}
              alt=""
              className="cpv2-ultra-card-img"
            />
          )}
          <span className="cpv2-ultra-lock">
            <Lock size={18} strokeWidth={2.2} />
          </span>
        </div>
        <p className="cpv2-ultra-title">{creatorName} Ultra Card</p>
        <p className="cpv2-ultra-copy">
          Collect{" "}
          <strong>
            {premiumRemaining > 0
              ? `${premiumRemaining} Premium motion card${premiumRemaining === 1 ? "" : "s"}`
              : "Premium motion cards"}
          </strong>{" "}
          to unlock the Ultra Card!
        </p>
        <button type="button" className="cpv2-ultra-locked" disabled>
          <span className="cpv2-ultra-locked-price" aria-hidden="true">
            <DiamondLottie size={11} aria-hidden />
            50
          </span>
          <span className="cpv2-ultra-locked-label">Locked</span>
        </button>
        <div className="cpv2-ultra-stars" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <svg
              key={i}
              width="17"
              height="17"
              viewBox="0 0 17 17"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.5 0L9.81998 3.57378L12.75 1.13878L12.1062 4.89376L15.8612 4.25L13.4262 7.18002L17 8.5L13.4262 9.81998L15.8612 12.75L12.1062 12.1062L12.75 15.8612L9.81998 13.4262L8.5 17L7.18002 13.4262L4.25 15.8612L4.89376 12.1062L1.13878 12.75L3.57378 9.81998L0 8.5L3.57378 7.18002L1.13878 4.25L4.89376 4.89376L4.25 1.13878L7.18002 3.57378L8.5 0Z"
                fill={i < 1 ? "#ffc640" : "rgba(255,255,255,0.2)"}
              />
            </svg>
          ))}
        </div>
      </section>

      <footer className="cpv2-site-footer">
        <p className="cpv2-site-footer-tagline">
          <span className="is-pink">Real Creators.</span> Real Moments.
        </p>
        <nav className="cpv2-site-footer-links" aria-label="Legal">
          <button type="button" onClick={() => setLegal("privacy")}>
            Privacy Policy
          </button>
          <a href="mailto:support@sugarscratch.com">Support</a>
          <button type="button" onClick={() => setLegal("terms")}>
            Terms &amp; Conditions
          </button>
          <a href="mailto:creators@sugarscratch.com">
            Sign up as a influencer
          </a>
        </nav>
      </footer>

      {legal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="home-legal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby={legalTitleId}
            >
              <AppPageShell
                aria-label={
                  legal === "privacy" ? "Privacy Policy" : "Terms & Conditions"
                }
              >
                <LegalDocPanel
                  kind={legal === "privacy" ? "privacy" : "terms"}
                  titleId={legalTitleId}
                  onBack={() => setLegal(null)}
                  variant="page"
                />
              </AppPageShell>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function ThemeCollectionCard({
  theme,
  glyph,
  avatarUrl,
  cards,
  showPersonalProgress,
  onBuyPack,
  onOpenCard,
  onLockedHint,
  onPlayGame,
}: {
  theme: ThemeCardData;
  glyph: string;
  avatarUrl: string;
  cards: CardConfig[];
  showPersonalProgress: boolean;
  onBuyPack: () => void;
  onOpenCard: (cardId: string) => void;
  onLockedHint: () => void;
  onPlayGame: (modelId: string, cardId: string, cardName: string) => void;
}) {
  const motionCards = cards.slice(0, 3);
  while (motionCards.length < 3) {
    const n = motionCards.length;
    motionCards.push(
      createCard({
        id: `${theme.id}-placeholder-${n}`,
        name: `Motion ${n + 1}`,
        mediaType: "image",
        mediaUrl: "/img/placeholder.png",
        groupId: theme.id,
        groupTheme: theme.name,
        photoFilledCount: 0,
      }),
    );
  }

  const photoDone = showPersonalProgress ? theme.collected : 0;
  const photoTotal = theme.total || 30;

  // Premium teaser: 3 locks — gold for fully unlocked motion cards (Figma 126:3395).
  const PREMIUM_LOCK_COUNT = 3;
  const motionUnlocked = motionCards.filter((c) => {
    if (c.id.includes("-placeholder-")) return false;
    const filled = c.photoFilledCount ?? 0;
    return showPersonalProgress && filled >= 10;
  }).length;
  const unlockedLocks = Math.min(PREMIUM_LOCK_COUNT, motionUnlocked);
  const motionNeeded = Math.max(0, PREMIUM_LOCK_COUNT - unlockedLocks);

  return (
    <section className="cpv2-theme-card" aria-label={theme.name}>
      {/* Figma 126:3345 — bottom-left blur glow group. */}
      <div className="cpv2-theme-card-glow" aria-hidden="true">
        <div className="cpv2-theme-card-glow-blob cpv2-theme-card-glow-blob--a" />
        <div className="cpv2-theme-card-glow-blob cpv2-theme-card-glow-blob--b" />
      </div>

      <header className="cpv2-theme-card-head">
        <div className="cpv2-theme-card-identity">
          <span className="cpv2-theme-card-avatar">
            <img src={avatarUrl || "/img/placeholder.png"} alt="" />
          </span>
          <h3 className="cpv2-theme-card-title">
            <span aria-hidden="true">{glyph} </span>
            {theme.name}
          </h3>
        </div>
        <p className="cpv2-theme-card-count">
          Photo Cards {photoDone}/{photoTotal}
        </p>
      </header>

      <div className="cpv2-theme-card-row">
        {motionCards.map((card, index) => {
          const isPlaceholder = card.id.includes("-placeholder-");
          const filled = Math.max(
            0,
            Math.min(10, Math.round(card.photoFilledCount ?? 0)),
          );
          const collected =
            showPersonalProgress && !isPlaceholder && filled >= 1;
          const fullyUnlocked =
            showPersonalProgress && !isPlaceholder && filled >= 10;
          const thumb =
            card.posterUrl ||
            (card.mediaType === "image" ? card.mediaUrl : "") ||
            card.photoUrls?.find(Boolean) ||
            "";
          const scratchesReady =
            showPersonalProgress &&
            !isPlaceholder &&
            filled > 0 &&
            filled < 10;

          const handleTileActivate = () => {
            if (isPlaceholder) {
              onBuyPack();
              return;
            }
            if (fullyUnlocked) {
              onOpenCard(card.id);
              return;
            }
            if (collected && card.modelId) {
              onPlayGame(card.modelId, card.id, card.name);
              return;
            }
            onLockedHint();
          };

          return (
            <div
              key={card.id}
              className={[
                "cpv2-motion-tile",
                fullyUnlocked
                  ? "is-unlocked"
                  : collected
                    ? "is-partial"
                    : "is-locked",
              ].join(" ")}
            >
              <button
                type="button"
                className="cpv2-motion-tile-hit"
                aria-label={
                  fullyUnlocked
                    ? `${card.name} — unlocked`
                    : `Locked motion card — buy packs to unlock`
                }
                onClick={handleTileActivate}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="cpv2-motion-tile-img" />
                ) : (
                  <span className="cpv2-motion-tile-img is-empty" />
                )}
                <span className="cpv2-motion-tile-shade" aria-hidden="true" />

                <span className="cpv2-motion-tile-progress">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 8 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M0.4 0H7.6C7.82092 0 8 0.17908 8 0.4V7.6C8 7.82092 7.82092 8 7.6 8H0.4C0.17908 8 0 7.82092 0 7.6V0.4C0 0.17908 0.17908 0 0.4 0ZM0.8 6L2.51716 4.28284C2.67336 4.12664 2.92664 4.12664 3.08284 4.28284L4.4 5.6L5.72248 4.60816C5.88172 4.48872 6.10456 4.50456 6.24532 4.64532L7.2 5.6V6.8C7.2 7.02092 7.02092 7.2 6.8 7.2H1.2C0.97908 7.2 0.8 7.02092 0.8 6.8V6ZM3 2.2C3 1.86864 2.73136 1.6 2.4 1.6C2.06864 1.6 1.8 1.86864 1.8 2.2C1.8 2.53136 2.06864 2.8 2.4 2.8C2.73136 2.8 3 2.53136 3 2.2Z"
                      fill="white"
                      fillOpacity="0.5"
                    />
                  </svg>
                  {showPersonalProgress ? Math.min(10, filled) : 0}/10
                  {!fullyUnlocked ? (
                    <span className="cpv2-motion-tile-dot" />
                  ) : null}
                </span>

                {fullyUnlocked ? (
                  <span className="cpv2-motion-tile-check" aria-hidden="true">
                    <svg
                      width="14"
                      height="15"
                      viewBox="0 0 14 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4.75293 0.375425C5.65417 0.00186077 6.64676 -0.0956503 7.60352 0.0951518C8.5601 0.286011 9.43906 0.756126 10.1279 1.44671C10.3782 1.69792 10.377 2.1044 10.126 2.35492C9.87487 2.6052 9.46837 2.60562 9.21777 2.35492C8.70853 1.8444 8.05873 1.49595 7.35156 1.35492C6.64467 1.21399 5.912 1.28606 5.24609 1.56195C4.58002 1.83804 4.01035 2.30582 3.61035 2.9057C3.33032 3.32573 3.14397 3.7979 3.05664 4.29046H10.9238C11.5485 4.29058 12.1471 4.53923 12.5889 4.98089C13.0307 5.42271 13.2793 6.02208 13.2793 6.64691V12.643C13.2793 13.2678 13.0307 13.8672 12.5889 14.309C12.1471 14.7507 11.5485 14.9993 10.9238 14.9994H2.35645C1.73162 14.9994 1.13226 14.7508 0.69043 14.309C0.24859 13.8672 0 13.2678 0 12.643V6.64691C0 6.02208 0.24859 5.42271 0.69043 4.98089C0.985477 4.68587 1.35094 4.47865 1.74707 4.3725C1.83493 3.59577 2.10446 2.84761 2.54102 2.19281C3.08208 1.38135 3.85199 0.74899 4.75293 0.375425ZM2.35645 5.57562C2.07242 5.57562 1.79947 5.68827 1.59863 5.8891C1.3978 6.08992 1.28516 6.3629 1.28516 6.64691V12.643C1.28516 12.927 1.3978 13.2 1.59863 13.4008C1.79946 13.6016 2.07245 13.7143 2.35645 13.7143H10.9238C11.2076 13.7142 11.4799 13.6015 11.6807 13.4008C11.8815 13.2 11.9941 12.927 11.9941 12.643V6.64691C11.9941 6.3629 11.8815 6.08993 11.6807 5.8891C11.4799 5.68841 11.2077 5.57574 10.9238 5.57562H2.35645ZM6.63965 8.14593C7.03728 8.14593 7.41902 8.30423 7.7002 8.58539C7.98108 8.8665 8.13867 9.24756 8.13867 9.64496C8.13866 10.0424 7.98109 10.4234 7.7002 10.7045C7.41902 10.9857 7.03728 11.144 6.63965 11.144C6.24204 11.144 5.86123 10.9857 5.58008 10.7045C5.29892 10.4234 5.14064 10.0426 5.14062 9.64496C5.14062 9.24735 5.29892 8.86654 5.58008 8.58539C5.86124 8.30424 6.24203 8.14595 6.63965 8.14593ZM6.63965 9.43109C6.58286 9.4311 6.52844 9.45344 6.48828 9.49359C6.44814 9.53375 6.42578 9.58818 6.42578 9.64496C6.42579 9.70174 6.44813 9.75617 6.48828 9.79632C6.52844 9.83648 6.58286 9.85881 6.63965 9.85882C6.69643 9.85882 6.75085 9.83646 6.79102 9.79632C6.83117 9.75617 6.8535 9.70174 6.85352 9.64496C6.85352 9.58815 6.83118 9.53376 6.79102 9.49359C6.75085 9.45343 6.69645 9.43109 6.63965 9.43109Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                ) : (
                  <>
                    <span className="cpv2-motion-tile-play" aria-hidden="true">
                      <svg
                        width="15"
                        height="20"
                        viewBox="0 0 15 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1.875 20C1.35937 20 0.918125 19.8136 0.55125 19.441C0.184375 19.0683 0.000625 18.6197 0 18.0952V8.57143C0 8.04762 0.18375 7.59937 0.55125 7.22667C0.91875 6.85397 1.36 6.6673 1.875 6.66667H2.8125V4.7619C2.8125 3.44444 3.26969 2.32159 4.18406 1.39333C5.09844 0.46508 6.20375 0.000635571 7.5 6.50089e-07C8.79625 -0.000634271 9.90187 0.46381 10.8169 1.39333C11.7319 2.32286 12.1887 3.44571 12.1875 4.7619V6.66667H13.125C13.6406 6.66667 14.0822 6.85333 14.4497 7.22667C14.8172 7.6 15.0006 8.04825 15 8.57143V18.0952C15 18.619 14.8166 19.0676 14.4497 19.441C14.0828 19.8143 13.6412 20.0006 13.125 20H1.875ZM1.875 18.0952H13.125V8.57143H1.875V18.0952ZM8.82469 14.6781C9.19156 14.306 9.375 13.8578 9.375 13.3333C9.375 12.8089 9.19156 12.3606 8.82469 11.9886C8.45781 11.6165 8.01625 11.4298 7.5 11.4286C6.98375 11.4273 6.5425 11.614 6.17625 11.9886C5.81 12.3632 5.62625 12.8114 5.625 13.3333C5.62375 13.8552 5.8075 14.3038 6.17625 14.679C6.545 15.0543 6.98625 15.2406 7.5 15.2381C8.01375 15.2356 8.45531 15.0483 8.82469 14.6781ZM4.6875 6.66667H10.3125V4.7619C10.3125 3.96825 10.0391 3.29365 9.49219 2.7381C8.94531 2.18254 8.28125 1.90476 7.5 1.90476C6.71875 1.90476 6.05469 2.18254 5.50781 2.7381C4.96094 3.29365 4.6875 3.96825 4.6875 4.7619V6.66667Z"
                          fill={`url(#cpv2-motion-lock-${card.id})`}
                        />
                        <defs>
                          <linearGradient
                            id={`cpv2-motion-lock-${card.id}`}
                            x1="7.5"
                            y1="0"
                            x2="7.5"
                            y2="20"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop stopColor="white" stopOpacity="0.38" />
                            <stop
                              offset="0.745205"
                              stopColor="white"
                              stopOpacity="0.16"
                            />
                          </linearGradient>
                        </defs>
                      </svg>
                    </span>
                    <span className="cpv2-motion-tile-lock-msg">
                      Buy Packs to unlock Motion Cards
                    </span>
                    {scratchesReady ? (
                      <span className="cpv2-motion-tile-scratch">
                        <span className="cpv2-motion-tile-scratch-icon" />
                        <span>
                          <em>New</em> Photo Scratches Available
                        </span>
                      </span>
                    ) : null}
                  </>
                )}
              </button>

              {index === 0 && fullyUnlocked ? (
                <div className="cpv2-motion-tile-play-cta">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    label=""
                    leadingIcon={
                      <Play
                        size={14}
                        strokeWidth={2.4}
                        fill="currentColor"
                        aria-hidden
                      />
                    }
                    costAmount={null}
                    fontSize={12}
                    cornerRadius={999}
                    aria-label={`Play ${card.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (card.modelId) {
                        onPlayGame(card.modelId, card.id, card.name);
                        return;
                      }
                      onOpenCard(card.id);
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="cpv2-premium-banner">
        {/* Figma 126:3378 — sparkle hangs slightly outside top-right border. */}
        <span className="cpv2-premium-sparkle" aria-hidden="true">
          <svg
            width="15"
            height="14"
            viewBox="0 0 15 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              opacity="0.7"
              d="M10.9794 -9.11452e-06L9.37675 5.32073L14.1504 8.16515L8.59487 8.2851L7.36482 13.7041L5.53397 8.45752L5.8372e-05 8.96225L4.42411 5.59972L2.23402 0.492629L6.79908 3.66107L10.9794 -9.11452e-06Z"
              fill="white"
            />
          </svg>
        </span>
        <div className="cpv2-premium-banner-top">
          <span className="cpv2-premium-banner-title">
            <svg
              width="17"
              height="17"
              viewBox="0 0 17 17"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8.5 0L9.81998 3.57378L12.75 1.13878L12.1062 4.89376L15.8612 4.25L13.4262 7.18002L17 8.5L13.4262 9.81998L15.8612 12.75L12.1062 12.1062L12.75 15.8612L9.81998 13.4262L8.5 17L7.18002 13.4262L4.25 15.8612L4.89376 12.1062L1.13878 12.75L3.57378 9.81998L0 8.5L3.57378 7.18002L1.13878 4.25L4.89376 4.89376L4.25 1.13878L7.18002 3.57378L8.5 0Z"
                fill="#E8CC9C"
              />
            </svg>
            Premium Motion Card
          </span>
          <ul className="cpv2-premium-locks" aria-hidden="true">
            {Array.from({ length: PREMIUM_LOCK_COUNT }, (_, index) => {
              const unlocked = index < unlockedLocks;
              return (
                <li
                  key={`lock-${index}`}
                  className={[
                    "cpv2-premium-lock",
                    unlocked ? "is-unlocked" : "is-locked",
                  ].join(" ")}
                >
                  <svg
                    width="15"
                    height="17"
                    viewBox="0 0 15 17"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.75293 0.375425C5.65417 0.00186077 6.64676 -0.0956503 7.60352 0.0951518C8.5601 0.286011 9.43906 0.756126 10.1279 1.44671C10.3782 1.69792 10.377 2.1044 10.126 2.35492C9.87487 2.6052 9.46837 2.60562 9.21777 2.35492C8.70853 1.8444 8.05873 1.49595 7.35156 1.35492C6.64467 1.21399 5.912 1.28606 5.24609 1.56195C4.58002 1.83804 4.01035 2.30582 3.61035 2.9057C3.33032 3.32573 3.14397 3.7979 3.05664 4.29046H10.9238C11.5485 4.29058 12.1471 4.53923 12.5889 4.98089C13.0307 5.42271 13.2793 6.02208 13.2793 6.64691V12.643C13.2793 13.2678 13.0307 13.8672 12.5889 14.309C12.1471 14.7507 11.5485 14.9993 10.9238 14.9994H2.35645C1.73162 14.9994 1.13226 14.7508 0.69043 14.309C0.24859 13.8672 0 13.2678 0 12.643V6.64691C0 6.02208 0.24859 5.42271 0.69043 4.98089C0.985477 4.68587 1.35094 4.47865 1.74707 4.3725C1.83493 3.59577 2.10446 2.84761 2.54102 2.19281C3.08208 1.38135 3.85199 0.74899 4.75293 0.375425ZM2.35645 5.57562C2.07242 5.57562 1.79947 5.68827 1.59863 5.8891C1.3978 6.08992 1.28516 6.3629 1.28516 6.64691V12.643C1.28516 12.927 1.3978 13.2 1.59863 13.4008C1.79946 13.6016 2.07245 13.7143 2.35645 13.7143H10.9238C11.2076 13.7142 11.4799 13.6015 11.6807 13.4008C11.8815 13.2 11.9941 12.927 11.9941 12.643V6.64691C11.9941 6.3629 11.8815 6.08993 11.6807 5.8891C11.4799 5.68841 11.2077 5.57574 10.9238 5.57562H2.35645ZM6.63965 8.14593C7.03728 8.14593 7.41902 8.30423 7.7002 8.58539C7.98108 8.8665 8.13867 9.24756 8.13867 9.64496C8.13866 10.0424 7.98109 10.4234 7.7002 10.7045C7.41902 10.9857 7.03728 11.144 6.63965 11.144C6.24204 11.144 5.86123 10.9857 5.58008 10.7045C5.29892 10.4234 5.14064 10.0426 5.14062 9.64496C5.14062 9.24735 5.29892 8.86654 5.58008 8.58539C5.86124 8.30424 6.24203 8.14595 6.63965 8.14593ZM6.63965 9.43109C6.58286 9.4311 6.52844 9.45344 6.48828 9.49359C6.44814 9.53375 6.42578 9.58818 6.42578 9.64496C6.42579 9.70174 6.44813 9.75617 6.48828 9.79632C6.52844 9.83648 6.58286 9.85881 6.63965 9.85882C6.69643 9.85882 6.75085 9.83646 6.79102 9.79632C6.83117 9.75617 6.8535 9.70174 6.85352 9.64496C6.85352 9.58815 6.83118 9.53376 6.79102 9.49359C6.75085 9.45343 6.69645 9.43109 6.63965 9.43109Z"
                      fill="currentColor"
                    />
                  </svg>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="cpv2-premium-banner-body">
          <div className="cpv2-premium-preview" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : null}
            <span className="cpv2-premium-preview-lock">
              <svg
                width="15"
                height="20"
                viewBox="0 0 15 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1.875 20C1.35937 20 0.918125 19.8136 0.55125 19.441C0.184375 19.0683 0.000625 18.6197 0 18.0952V8.57143C0 8.04762 0.18375 7.59937 0.55125 7.22667C0.91875 6.85397 1.36 6.6673 1.875 6.66667H2.8125V4.7619C2.8125 3.44444 3.26969 2.32159 4.18406 1.39333C5.09844 0.46508 6.20375 0.000635571 7.5 6.50089e-07C8.79625 -0.000634271 9.90187 0.46381 10.8169 1.39333C11.7319 2.32286 12.1887 3.44571 12.1875 4.7619V6.66667H13.125C13.6406 6.66667 14.0822 6.85333 14.4497 7.22667C14.8172 7.6 15.0006 8.04825 15 8.57143V18.0952C15 18.619 14.8166 19.0676 14.4497 19.441C14.0828 19.8143 13.6412 20.0006 13.125 20H1.875ZM1.875 18.0952H13.125V8.57143H1.875V18.0952ZM8.82469 14.6781C9.19156 14.306 9.375 13.8578 9.375 13.3333C9.375 12.8089 9.19156 12.3606 8.82469 11.9886C8.45781 11.6165 8.01625 11.4298 7.5 11.4286C6.98375 11.4273 6.5425 11.614 6.17625 11.9886C5.81 12.3632 5.62625 12.8114 5.625 13.3333C5.62375 13.8552 5.8075 14.3038 6.17625 14.679C6.545 15.0543 6.98625 15.2406 7.5 15.2381C8.01375 15.2356 8.45531 15.0483 8.82469 14.6781ZM4.6875 6.66667H10.3125V4.7619C10.3125 3.96825 10.0391 3.29365 9.49219 2.7381C8.94531 2.18254 8.28125 1.90476 7.5 1.90476C6.71875 1.90476 6.05469 2.18254 5.50781 2.7381C4.96094 3.29365 4.6875 3.96825 4.6875 4.7619V6.66667Z"
                  fill={`url(#cpv2-premium-preview-lock-${theme.id})`}
                />
                <defs>
                  <linearGradient
                    id={`cpv2-premium-preview-lock-${theme.id}`}
                    x1="7.5"
                    y1="0"
                    x2="7.5"
                    y2="20"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="white" stopOpacity="0.38" />
                    <stop
                      offset="0.745205"
                      stopColor="white"
                      stopOpacity="0.16"
                    />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </div>
          <div className="cpv2-premium-copy">
            <p>
              <strong className="is-gold">Collect</strong>{" "}
              <strong className="is-white">
                {motionNeeded > 0
                  ? `${motionNeeded} more motion`
                  : "motion"}
              </strong>{" "}
              <strong className="is-gold">cards…</strong>
            </p>
            <div className="cpv2-premium-actions">
              <button type="button" className="cpv2-premium-locked" disabled>
                <span className="cpv2-premium-locked-price" aria-hidden="true">
                  <DiamondLottie size={11} aria-hidden />
                  50
                </span>
                <span className="cpv2-premium-locked-label">Locked</span>
              </button>
              <span className="cpv2-premium-win">
                Win up to{" "}
                <span className="cpv2-premium-win-amt">
                  <DiamondLottie size={12} aria-hidden />
                  50
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
