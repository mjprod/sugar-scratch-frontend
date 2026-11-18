import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreatorProgressPanel } from "@/components/creator/CreatorProgressPanel";
import { LockStatusBanner } from "@/components/lock-status/LockStatusBanner";
import { McpPhotoPlayCta } from "@/components/creator/McpPhotoPlayCta";
import { CtaButton } from "@/components/cta";
import { useAuth } from "@/contexts/useAuth";
import "@/components/creator/mcp-photo-play-cta-css.css";
import { usePlayedCards } from "@/hooks/usePlayedCards";
import { useRegisterCardPlayOutcome } from "@/hooks/useRegisterCardPlay";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";
import { useCreatorCollection } from "@/features/collection/useCreatorCollection";
import {
  buildPhotoSlotFills,
  PHOTO_SLOTS,
  photoScratchIdForSlot,
} from "@/features/collection/lib/photoSlots";
import type { CardConfig } from "@/features/collection/lib/cards";
import { resolveModelIdForCreator } from "@/features/collection/lib/resolveCreatorModel";
import {
  fetchPhotoScratchSlots,
  photoScratchSlotPrices,
} from "@/shared/backend/collection";
import {
  matchLiveThemeId,
  type ThemeCardData,
} from "@/services/collection";
import {
  fetchCreatorBoard,
  themeCollectionProgressFromBoard,
  unlockedMotionFreePlayIds,
  type CreatorBoard,
} from "@/services/creatorBoard";
import {
  packItemToIteration,
  type Iteration,
} from "@/features/packs/types";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";
import { resolveMotionCardTheme } from "@/components/motion-card/MotionCard";
import { Paths } from "@/routes/Paths";
import { packUnitCost } from "@/services/purchase";
import { useMarkPageReady } from "@/shared/ui/usePageReady";
import "./creator-influencer.css";
import "./motion-card-page.css";

const EMPTY_PHOTOS = Array.from({ length: PHOTO_SLOTS }, () => "");

function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(src);
}

function motionTileStillUrl(card: CardConfig): string {
  const poster = card.posterUrl?.trim() || "";
  if (poster && !isVideoSrc(poster)) return poster;
  if (card.mediaType === "image") {
    const media = card.mediaUrl?.trim() || "";
    if (media && !isVideoSrc(media) && !media.includes("placeholder")) return media;
  }
  const photo = card.photoUrls?.find((url) => url?.trim())?.trim() || "";
  if (photo) return photo;
  const id = card.id.trim();
  if (id && !id.includes("-placeholder-")) {
    return `/cards/${encodeURIComponent(id)}/motion-poster.webp`;
  }
  return "";
}

function motionVideoUrl(card: CardConfig): string {
  const trailer = card.mediaUrl?.trim() || "";
  if (trailer && isVideoSrc(trailer)) return trailer;
  const motion = card.motionUrl?.trim() || "";
  return motion && isVideoSrc(motion) ? motion : "";
}

function cardToIteration(
  card: CardConfig,
  index: number,
  price: number,
): Iteration {
  const still = motionTileStillUrl(card);
  const video = motionVideoUrl(card);
  return packItemToIteration({
    id: card.id,
    characterId: card.modelId || card.id,
    name: card.name,
    modelUrl: "",
    modelName: card.name,
    videoUrl: video,
    posterUrl: still || undefined,
    price,
    girlName: card.name,
    packNumber: index + 1,
    packName: card.name,
    flagEmoji: "",
    backgroundColor: "oklch(0.798 0.104 207.84)",
    backgroundImageUrl: still || undefined,
  });
}

/** Slot-machine roll when the focused motion card’s label changes. */
function PhotoCardLabelRoll({ label }: { label: string }) {
  const shownRef = useRef(label);
  const targetRef = useRef(label);
  const rollingRef = useRef(false);
  const [shown, setShown] = useState(label);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [rollKey, setRollKey] = useState(0);

  targetRef.current = label;

  const settleAtRest = (landed: string) => {
    rollingRef.current = false;
    shownRef.current = landed;
    setShown(landed);
    setIncoming(null);
    // Remount at rest — avoids one frame of a single line stuck at translateY(-50%).
    setRollKey((key) => key + 1);
  };

  const finishRoll = () => {
    if (!rollingRef.current) return;
    // Always land on latest focus — never chain remounts (those looked like cancels).
    settleAtRest(targetRef.current || shownRef.current);
  };

  useEffect(() => {
    if (!label) {
      rollingRef.current = false;
      shownRef.current = "";
      setShown("");
      setIncoming(null);
      return;
    }
    if (!shownRef.current) {
      shownRef.current = label;
      setShown(label);
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      settleAtRest(label);
      return;
    }
    if (rollingRef.current) {
      // Keep the CSS animation running; only swap destination text.
      setIncoming(label);
      return;
    }
    if (label === shownRef.current) return;
    rollingRef.current = true;
    setIncoming(label);
    setRollKey((key) => key + 1);
  }, [label]);

  // Failsafe if animationend is skipped (must exceed CSS duration).
  useEffect(() => {
    if (!incoming) return;
    const timeout = window.setTimeout(() => finishRoll(), 1000);
    return () => window.clearTimeout(timeout);
  }, [incoming, rollKey]);

  if (!shown && !label) return null;

  const rolling = incoming != null;

  return (
    <span className="mcp-photos-title-card">
      <span className="mcp-photos-title-card-viewport">
        <span
          key={rollKey}
          className={
            rolling
              ? "mcp-photos-title-card-track is-rolling"
              : "mcp-photos-title-card-track"
          }
          onAnimationEnd={(event) => {
            if (event.animationName !== "mcp-photos-title-card-roll") return;
            finishRoll();
          }}
        >
          <span className="mcp-photos-title-card-line">{shown || label}</span>
          {incoming ? (
            <span className="mcp-photos-title-card-line">{incoming}</span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

export function CreatorThemeScreen({
  creatorId,
  themeId,
}: {
  creatorId: string;
  themeId: string;
}) {
  const [modelId, setModelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveModelIdForCreator(creatorId).then(({ model }) => {
      if (!cancelled) setModelId(model?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  return (
    <CatalogProvider preferredModelId={modelId}>
      <CreatorThemeScreenInner
        creatorId={creatorId}
        themeId={themeId}
        modelId={modelId}
      />
    </CatalogProvider>
  );
}

function CreatorThemeScreenInner({
  creatorId,
  themeId,
  modelId,
}: {
  creatorId: string;
  themeId: string;
  modelId: string | null;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnCardId = searchParams.get("card")?.trim() || "";
  const { authed, requireAuth } = useAuth();
  const registerPlay = useRegisterCardPlayOutcome();
  const { isPlayed } = usePlayedCards();
  const [buying, setBuying] = useState(false);
  const collection = useCreatorCollection(modelId);
  const [activeCardId, setActiveCardId] = useState<string | null>(
    () => returnCardId || null,
  );
  const appliedReturnCardRef = useRef("");
  const [slotPrices, setSlotPrices] = useState<Array<number | null>>(() =>
    Array.from({ length: PHOTO_SLOTS }, () => null),
  );
  const [board, setBoard] = useState<CreatorBoard | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [chevronAnimReady, setChevronAnimReady] = useState(false);
  const [progressPlayId, setProgressPlayId] = useState(0);
  /** Remount title mini-bar fill on close so grow runs after fade-in. */
  const [titleProgressPlayId, setTitleProgressPlayId] = useState(0);
  /** Remount chevron each toggle so open/close keyframes always restart. */
  const [chevronPlayId, setChevronPlayId] = useState(0);
  const [freePlay, setFreePlay] = useState(false);

  const themes = collection.themes;
  const resolvedThemeId = useMemo(
    () => matchLiveThemeId(themeId, themes) ?? themes[0]?.id ?? "",
    [themeId, themes],
  );

  const theme = useMemo(
    () => themes.find((entry) => entry.id === resolvedThemeId) ?? null,
    [themes, resolvedThemeId],
  );

  const themeProgressCard = useMemo((): ThemeCardData | null => {
    if (!theme) return null;
    return {
      id: theme.id,
      name: theme.name,
      thumbnailUrl: theme.coverUrl,
      collected: authed ? theme.collected : 0,
      total: theme.total,
      progressColor: "pink",
    };
  }, [authed, theme]);

  useEffect(() => {
    if (!authed) {
      setBoard(null);
      return;
    }
    let cancelled = false;
    void fetchCreatorBoard(creatorId).then((next) => {
      if (!cancelled) setBoard(next);
    });
    return () => {
      cancelled = true;
    };
  }, [authed, creatorId]);

  function setProgressExpanded(next: boolean) {
    setChevronAnimReady(true);
    setChevronPlayId((id) => id + 1);
    if (next && !progressOpen) setProgressPlayId((id) => id + 1);
    if (!next && progressOpen) setTitleProgressPlayId((id) => id + 1);
    setProgressOpen(next);
  }

  const motionCards = useMemo(() => {
    if (!resolvedThemeId) return [] as CardConfig[];
    return (collection.cardsByThemeId[resolvedThemeId] ?? []).filter(
      (card) => !card.id.includes("-placeholder-"),
    );
  }, [collection.cardsByThemeId, resolvedThemeId]);

  const boardTheme = useMemo(
    () => board?.themes.find((entry) => entry.id === resolvedThemeId) ?? null,
    [board, resolvedThemeId],
  );

  const items = useMemo(() => {
    const byId = new Map(
      (boardTheme?.motionCards ?? []).map((card) => [card.id, card]),
    );
    const fallback = packUnitCost();
    return motionCards.map((card, index) =>
      cardToIteration(card, index, byId.get(card.id)?.price ?? fallback),
    );
  }, [boardTheme, motionCards]);

  useEffect(() => {
    if (!items.length) return;
    if (
      returnCardId &&
      appliedReturnCardRef.current !== returnCardId &&
      items.some((item) => item.id === returnCardId)
    ) {
      appliedReturnCardRef.current = returnCardId;
      setActiveCardId(returnCardId);
      return;
    }
    if (activeCardId && items.some((item) => item.id === activeCardId)) return;
    setActiveCardId(items[0]!.id);
  }, [activeCardId, items, returnCardId]);

  const activeCard = useMemo(
    () => motionCards.find((card) => card.id === activeCardId) ?? null,
    [activeCardId, motionCards],
  );

  useEffect(() => {
    const motionId = (activeCard?.id ?? "").trim();
    if (!motionId || motionId.includes("-placeholder-")) {
      setSlotPrices(Array.from({ length: PHOTO_SLOTS }, () => null));
      return;
    }
    let cancelled = false;
    const themeKey = (activeCard?.groupId || activeCard?.groupTheme || "").trim();
    void fetchPhotoScratchSlots(motionId, themeKey).then((slots) => {
      if (cancelled) return;
      setSlotPrices(photoScratchSlotPrices(slots));
    });
    return () => {
      cancelled = true;
    };
  }, [activeCard?.groupId, activeCard?.groupTheme, activeCard?.id]);

  // Invalid theme after load → bounce to profile.
  useEffect(() => {
    if (collection.loading || !modelId) return;
    if (themes.length > 0 && !matchLiveThemeId(themeId, themes)) {
      navigate(Paths.creator(creatorId), { replace: true });
    }
  }, [collection.loading, creatorId, modelId, navigate, themeId, themes]);

  const pageLoading = !modelId || (collection.loading && !theme);
  useMarkPageReady(!pageLoading);

  const filled = Math.max(
    0,
    Math.min(PHOTO_SLOTS, Math.round(activeCard?.photoFilledCount ?? 0)),
  );
  const showPersonal = Boolean(authed);
  const slots = useMemo(
    () =>
      buildPhotoSlotFills(
        activeCard?.id ?? activeCardId ?? "theme",
        showPersonal ? filled : filled > 0 ? filled : null,
        activeCard?.photoUrls ?? EMPTY_PHOTOS,
      ),
    [activeCard?.id, activeCard?.photoUrls, activeCardId, filled, showPersonal],
  );

  const boardMotion = useMemo(
    () =>
      boardTheme?.motionCards.find((card) => card.id === activeCardId) ?? null,
    [activeCardId, boardTheme],
  );
  const photoPlayed = slots.map((_, index) => {
    const photoId =
      boardMotion?.staticCards[index]?.id ||
      photoScratchIdForSlot(activeCardId ?? "theme", index);
    return isPlayed("photo", photoId);
  });
  const collectedCount = photoPlayed.filter(Boolean).length;
  const photoCardLabel = useMemo(() => {
    const themeName = (theme?.name ?? "").trim();
    if (!themeName) return "";
    const motionIndex = items.findIndex((item) => item.id === activeCardId);
    const n = String((motionIndex >= 0 ? motionIndex : 0) + 1).padStart(3, "0");
    return `${themeName}${n}`;
  }, [activeCardId, items, theme?.name]);
  const photoTitle = photoCardLabel
    ? `Photo Cards ${photoCardLabel}`
    : "Photo Cards";

  const themeTotalPct = useMemo(() => {
    const fromBoard = themeCollectionProgressFromBoard(board, resolvedThemeId);
    const owned = authed
      ? fromBoard.total > 0
        ? fromBoard.owned
        : (themeProgressCard?.collected ?? 0)
      : 0;
    const total =
      fromBoard.total > 0
        ? fromBoard.total
        : (themeProgressCard?.total ?? 0);
    return total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;
  }, [authed, board, resolvedThemeId, themeProgressCard]);
  /** Every photo CTA shows a price — fill gaps from siblings / pack unit. */
  const defaultPhotoPrice = useMemo(() => {
    for (const price of slotPrices) {
      if (price != null) return price;
    }
    for (const card of boardMotion?.staticCards ?? []) {
      if (typeof card.price === "number" && Number.isFinite(card.price)) {
        return Math.round(card.price);
      }
    }
    return packUnitCost();
  }, [boardMotion, slotPrices]);
  /** Pink ring on unlocked motions while Free Play is on. */
  const ownedFreePlayIds = useMemo(
    () => unlockedMotionFreePlayIds(boardTheme?.motionCards ?? [], freePlay),
    [boardTheme, freePlay],
  );
  /**
   * Guests: no lock UI (auth sheet gates play).
   * Signed-in: lock every motion until the board loads, then use board status.
   */
  const lockedMotionIds = useMemo(() => {
    if (!authed) return null;
    if (board === null) {
      return new Set(motionCards.map((card) => card.id));
    }
    const ids = new Set<string>();
    for (const card of boardTheme?.motionCards ?? []) {
      if (card.status === "locked") ids.add(card.id);
    }
    return ids;
  }, [authed, board, boardTheme, motionCards]);
  const motionTheme = useMemo(
    () =>
      resolveMotionCardTheme(
        `${resolvedThemeId} ${theme?.name ?? themeId}`,
      ),
    [resolvedThemeId, theme?.name, themeId],
  );
  const themePath = Paths.creatorTheme(creatorId, resolvedThemeId || themeId);
  /** Free Play label only when this motion already has a free-playable row. */
  const activeMotionFreePlay =
    freePlay && Boolean(boardMotion?.freePlayable);

  function openBuyPacks() {
    navigate(Paths.creatorPacks(creatorId), {
      state: {
        from: themePath,
      },
    });
  }

  function goBack() {
    navigate(Paths.creator(creatorId));
  }

  async function openMotion(item: Iteration) {
    if (buying) return;
    if (lockedMotionIds?.has(item.id)) {
      openBuyPacks();
      return;
    }
    const card = motionCards.find((entry) => entry.id === item.id);
    if (!card) return;
    const playModelId = card.modelId?.trim() || modelId || "";
    if (!playModelId) return;
    if (!authed) {
      requireAuth({ type: "resume", path: themePath });
      return;
    }
    const boardCard = boardTheme?.motionCards.find(
      (entry) => entry.id === item.id,
    );
    const useFreePlay = freePlay && Boolean(boardCard?.freePlayable);
    setBuying(true);
    const outcome = await registerPlay(
      "motion",
      card.id,
      "offer",
      useFreePlay,
    );
    setBuying(false);
    if (outcome !== "ok") return;
    navigate(
      Paths.gamePlay(playModelId, card.id, {
        creatorId,
        // Route theme id (e.g. nurse) — not card.groupId (catalog group key).
        themeId: resolvedThemeId || undefined,
        freePlay: useFreePlay,
      }),
    );
  }

  async function openPhoto(slotIndex: number) {
    if (buying || !activeCardId) return;
    const boardSlot = boardMotion?.staticCards[slotIndex];
    if (!boardSlot) return;
    const playModelId = activeCard?.modelId?.trim() || modelId || "";
    if (!authed) {
      requireAuth({ type: "resume", path: themePath });
      return;
    }
    const useFreePlay = freePlay && Boolean(boardSlot.freePlayable);
    setBuying(true);
    const outcome = await registerPlay(
      "photo",
      boardSlot.id,
      "offer",
      useFreePlay,
    );
    setBuying(false);
    if (outcome !== "ok") return;
    navigate(
      Paths.photoScratchPlay(boardSlot.id, {
        modelId: playModelId || undefined,
        creatorId,
        themeId: resolvedThemeId || undefined,
        freePlay: useFreePlay,
      }),
    );
  }

  if (pageLoading) {
    return (
      <section data-page-scroll className="cpv2-page no-sticky-cta">
        <div className="cpv2-shell cpv2-page-skeleton" aria-busy="true">
          <button
            type="button"
            className="cpv2-skeleton-back"
            aria-label="Back"
            onClick={goBack}
          />
          <span className="cpv2-skeleton-block cpv2-skeleton-coverflow" />
        </div>
      </section>
    );
  }

  return (
    <section data-page-scroll className="cpv2-page no-sticky-cta">
      <div className="cpv2-shell cpv2-theme-page">
        <div
          className="cpv2-theme-page-head"
          data-open={progressOpen ? "true" : "false"}
          data-chevron-anim={chevronAnimReady ? "true" : "false"}
        >
          <header className="mcp-top cpv2-theme-page-top">
            <button
              type="button"
              className="mcp-back"
              aria-label="Back to profile"
              onClick={goBack}
            >
              <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
            </button>
            <div className="cpv2-theme-page-title-row">
              <h1 className="cpv2-theme-page-title">
                {theme?.name ?? "Theme"}
              </h1>
              <div
                className="cpv2-progress-track cpv2-theme-page-title-progress"
                role="progressbar"
                aria-valuenow={themeTotalPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${theme?.name ?? "Theme"} total progress, ${themeTotalPct}%`}
              >
                <span
                  key={titleProgressPlayId}
                  className="cpv2-progress-fill"
                  data-replay={titleProgressPlayId > 0 ? "true" : undefined}
                  style={
                    {
                      "--cpv2-progress": `${themeTotalPct}%`,
                      "--cpv2-i": 0,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className="cpv2-profile-expand"
              aria-expanded={progressOpen}
              aria-label={
                progressOpen ? "Hide theme progress" : "Show theme progress"
              }
              onClick={() => setProgressExpanded(!progressOpen)}
            >
              <span
                key={`${chevronPlayId}-${progressOpen ? "open" : "closed"}`}
                className="cpv2-profile-expand-chevron"
                data-open={progressOpen ? "true" : "false"}
                data-chevron-anim={chevronAnimReady ? "true" : "false"}
                aria-hidden="true"
              >
                <ChevronDown className="size-5" strokeWidth={2.2} />
              </span>
            </button>
          </header>

          {themeProgressCard ? (
            <div className="cpv2-theme-page-progress">
              <div className="cpv2-theme-page-progress-inner">
                <div key={progressPlayId}>
                  <CreatorProgressPanel
                    themes={[themeProgressCard]}
                    board={board}
                    showPersonalProgress={authed}
                    loading={collection.loading || (authed && board === null)}
                    variant="theme"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Sticky dock is a direct child of this scope (not the short toolbar). */}
        <div className="cpv2-theme-sticky-scope">
          <div className="cpv2-theme-free-play-dock">
            <div
              className={
                freePlay
                  ? "cpv2-theme-free-play-glass is-free-play"
                  : "cpv2-theme-free-play-glass"
              }
            >
              <button
                type="button"
                className={freePlay ? "cpv2-free-play is-on" : "cpv2-free-play"}
                role="switch"
                aria-checked={freePlay}
                aria-label={`Free play for ${theme?.name ?? "theme"}`}
                onClick={() => setFreePlay((on) => !on)}
              >
                <span className="cpv2-free-play-clip" aria-hidden="true">
                  <span
                    className={
                      freePlay
                        ? "cpv2-free-play-track is-on"
                        : "cpv2-free-play-track"
                    }
                  >
                    <span className="cpv2-free-play-label">Free Play?</span>
                    <span className="cpv2-free-play-label">
                      Free: <span className="cpv2-free-play-on">ON</span>
                    </span>
                  </span>
                </span>
                <span
                  className={
                    freePlay
                      ? "cpv2-free-play-switch is-on"
                      : "cpv2-free-play-switch"
                  }
                  aria-hidden="true"
                >
                  <span className="cpv2-free-play-knob" />
                </span>
              </button>
            </div>
          </div>

          <section
            className="cpv2-theme-page-section"
            aria-label="Motion cards"
          >
            <div className="cpv2-theme-motion-toolbar">
              <div
                className="cpv2-theme-free-play-spacer"
                aria-hidden="true"
              />
              <div className="cpv2-theme-motion-buy">
                <CtaButton
                  forceCss
                  type="button"
                  label="Buy Packs?"
                  costAmount={null}
                  strokeWidth={1}
                  cornerRadius={999}
                  width={152}
                  height={40}
                  className="cpv2-theme-motion-buy__btn"
                  onClick={openBuyPacks}
                />
              </div>
            </div>
            {items.length > 0 ? (
              <MobileCssCarousel
                items={items}
                selectedId={activeCardId}
                slideCta="play"
                freePlayMode={activeMotionFreePlay}
                ownedFreePlayIds={ownedFreePlayIds}
                lockedMotionIds={lockedMotionIds}
                motionTheme={motionTheme}
                onUnlock={() => openBuyPacks()}
                onView={(item) => void openMotion(item)}
                onFocusChange={(item) => setActiveCardId(item?.id ?? null)}
              />
            ) : (
              <p className="cpv2-theme-page-empty">No motion cards yet.</p>
            )}
          </section>

          <section
            className="mcp-photos cpv2-theme-page-section"
            aria-label={photoTitle}
          >
          <div
            className={[
              "mcp-photos-panel",
              freePlay ? "is-free-play" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <header className="mcp-photos-head">
              <div className="mcp-photos-title-count">
                <h2 className="mcp-photos-title">
                  <span className="mcp-photos-title-lead">Photo Cards</span>
                  {photoCardLabel ? (
                    <PhotoCardLabelRoll label={photoCardLabel} />
                  ) : null}
                </h2>
                <p className="mcp-photos-count">
                  {collectedCount}/{PHOTO_SLOTS}
                </p>
              </div>
            </header>

            <div className="mcp-photo-grid">
            {slots.map((slot, index) => {
              const owned = photoPlayed[index];
              const boardSlot = boardMotion?.staticCards[index];
              const photoUnlocked = Boolean(
                boardSlot?.owned || boardSlot?.unlocked || owned,
              );
              const src =
                slot.src ||
                (activeCard ? motionTileStillUrl(activeCard) : "") ||
                "/img/placeholder.webp";
              const scratchPrice = slotPrices[index];
              const boardPrice = boardSlot?.price;
              const playPrice =
                scratchPrice ??
                (typeof boardPrice === "number" && Number.isFinite(boardPrice)
                  ? Math.round(boardPrice)
                  : null) ??
                defaultPhotoPrice;
              const useFreePlay =
                freePlay && Boolean(boardSlot?.freePlayable);
              // Free Play on + locked → tuck CTA down (still mounted for exit anim).
              const tuckedAway = freePlay && !photoUnlocked;
              return (
                <div
                  key={`${activeCardId ?? "theme"}-photo-${index}`}
                  className={[
                    "mcp-photo-cell",
                    // Purchased once → full color (not grayscale unplayed).
                    photoUnlocked
                      ? "is-unlocked"
                      : slot.src
                        ? "is-unplayed"
                        : "is-locked",
                    // Clip while tucking; glow room when CTA is interactive.
                    boardSlot
                      ? tuckedAway
                        ? "is-tucking-cta"
                        : "has-price-cta"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    {
                      // Column index — stagger left → right on motion change.
                      ["--mcp-photo-i" as string]: index % 3,
                    } as CSSProperties
                  }
                >
                  <img
                    src={src || "/img/placeholder.webp"}
                    alt=""
                    className="mcp-photo-img"
                  />
                  <div className="mcp-photo-lock-banner">
                    <LockStatusBanner
                      status={photoUnlocked ? "unlocked" : "locked"}
                    />
                  </div>
                  {boardSlot ? (
                    <McpPhotoPlayCta
                      playPrice={playPrice}
                      freePlay={useFreePlay}
                      tuckedAway={tuckedAway}
                      ariaLabel={
                        useFreePlay
                          ? `Free Play ${photoTitle} ${index + 1}`
                          : `Play ${photoTitle} ${index + 1} for ${playPrice} diamonds`
                      }
                      onPlay={() => void openPhoto(index)}
                    />
                  ) : null}
                </div>
              );
            })}
            </div>
          </div>
          </section>
        </div>
      </div>
    </section>
  );
}
