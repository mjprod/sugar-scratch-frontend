import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronLeft, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CreatorProgressPanel } from "@/components/creator/CreatorProgressPanel";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useAuth } from "@/contexts/useAuth";
import { usePlayedCards } from "@/hooks/usePlayedCards";
import { useRegisterCardPlay } from "@/hooks/useRegisterCardPlay";
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
  type CreatorBoard,
} from "@/services/creatorBoard";
import {
  packItemToIteration,
  type Iteration,
} from "@/features/packs/types";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";
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
  const { authed } = useAuth();
  const registerPlay = useRegisterCardPlay();
  const { isPlayed } = usePlayedCards();
  const [buying, setBuying] = useState(false);
  const collection = useCreatorCollection(modelId);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
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
    if (!items.length) {
      setActiveCardId(null);
      return;
    }
    if (!activeCardId || !items.some((item) => item.id === activeCardId)) {
      setActiveCardId(items[0]!.id);
    }
  }, [activeCardId, items]);

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

  const photoPlayed = slots.map((_, index) =>
    isPlayed(
      "photo",
      photoScratchIdForSlot(activeCardId ?? "theme", index),
    ),
  );
  const collectedCount = photoPlayed.filter(Boolean).length;
  const photoTitle = "Photo Card";

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
  const boardMotion = useMemo(
    () =>
      boardTheme?.motionCards.find((card) => card.id === activeCardId) ?? null,
    [activeCardId, boardTheme],
  );
  const freePlayAllowed = Boolean(
    boardTheme?.motionCards.some(
      (card) =>
        card.freePlayable ||
        card.staticCards.some((slot) => slot.freePlayable),
    ),
  );

  function goBack() {
    navigate(Paths.creator(creatorId));
  }

  async function openMotion(item: Iteration) {
    if (buying) return;
    const card = motionCards.find((entry) => entry.id === item.id);
    if (!card) return;
    const playModelId = card.modelId?.trim() || modelId || "";
    if (!playModelId) return;
    const boardCard =
      boardTheme?.motionCards.find((entry) => entry.id === card.id) ?? null;
    const useFreePlay = freePlay && Boolean(boardCard?.freePlayable);
    setBuying(true);
    const ok = await registerPlay("motion", card.id, useFreePlay);
    setBuying(false);
    if (!ok) return;
    navigate(
      Paths.gamePlay(playModelId, card.id, {
        creatorId,
        themeId: card.groupId || resolvedThemeId || undefined,
        freePlay: useFreePlay,
      }),
    );
  }

  async function openPhoto(slotIndex: number) {
    if (buying || !activeCardId) return;
    const playModelId = activeCard?.modelId?.trim() || modelId || "";
    const photoId =
      boardMotion?.staticCards[slotIndex]?.id ||
      photoScratchIdForSlot(activeCardId, slotIndex);
    const useFreePlay =
      freePlay && Boolean(boardMotion?.staticCards[slotIndex]?.freePlayable);
    setBuying(true);
    const ok = await registerPlay("photo", photoId, useFreePlay);
    setBuying(false);
    if (!ok) return;
    navigate(
      Paths.photoScratchPlay(photoId, {
        modelId: playModelId || undefined,
        creatorId,
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

        <section
          className="cpv2-theme-page-section"
          aria-label="Motion cards"
        >
          {items.length > 0 ? (
            <MobileCssCarousel
              items={items}
              selectedId={activeCardId}
              slideCta="play"
              onView={(item) => void openMotion(item)}
              onFocusChange={(item) => setActiveCardId(item?.id ?? null)}
            />
          ) : (
            <p className="cpv2-theme-page-empty">No motion cards yet.</p>
          )}
        </section>

        <section className="mcp-photos cpv2-theme-page-section" aria-label={photoTitle}>
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
                <h2 className="mcp-photos-title">{photoTitle}</h2>
                <p className="mcp-photos-count">
                  {collectedCount}/{PHOTO_SLOTS}
                </p>
              </div>
              {freePlayAllowed ? (
                <button
                  type="button"
                  className={
                    freePlay ? "cpv2-free-play is-on" : "cpv2-free-play"
                  }
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
              ) : null}
            </header>

            <div className="mcp-photo-grid">
            {slots.map((slot, index) => {
              const owned = photoPlayed[index];
              const src =
                slot.src ||
                (activeCard ? motionTileStillUrl(activeCard) : "") ||
                "/img/placeholder.webp";
              const playPrice = slotPrices[index];
              const slotFree =
                freePlay &&
                Boolean(boardMotion?.staticCards[index]?.freePlayable);
              const showPrice = !owned && playPrice != null && !slotFree;
              return (
                <div
                  key={`${activeCardId ?? "theme"}-photo-${index}`}
                  className={[
                    "mcp-photo-cell",
                    owned
                      ? "is-unlocked"
                      : slot.src
                        ? "is-unplayed"
                        : "is-locked",
                    showPrice ? "has-price-cta" : "has-play-cta",
                  ].join(" ")}
                >
                  <img
                    src={src || "/img/placeholder.webp"}
                    alt=""
                    className="mcp-photo-img"
                  />
                  {owned ? (
                    <span className="mcp-photo-dot" aria-hidden="true" />
                  ) : null}
                  <div
                    className={[
                      "mcp-photo-play-cta",
                      showPrice ? "is-priced" : "is-owned",
                    ].join(" ")}
                  >
                    <CtaButton
                      {...ctaButtonPropsFromTemplate("squircleCTA")}
                      fillParent
                      label=""
                      leadingIcon={
                        <>
                          {showPrice ? (
                            <DiamondLottie
                              className="mcp-photo-play-diamond"
                              size={11}
                              aria-hidden
                            />
                          ) : null}
                          {showPrice ? (
                            <span className="mcp-photo-play-price">
                              {playPrice}
                            </span>
                          ) : null}
                          <Play
                            className="mcp-photo-play-triangle"
                            size={11}
                            strokeWidth={2.4}
                            fill="currentColor"
                            aria-hidden
                          />
                        </>
                      }
                      costAmount={null}
                      fontSize={11}
                      cornerRadius={999}
                      aria-label={
                        showPrice
                          ? `Play ${photoTitle} ${index + 1} for ${playPrice} diamonds`
                          : owned
                            ? `Replay ${photoTitle} ${index + 1}`
                            : `Play ${photoTitle} ${index + 1}`
                      }
                      onClick={() => void openPhoto(index)}
                    />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
