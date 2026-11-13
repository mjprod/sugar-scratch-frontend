import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { EffectCoverflow } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper/types";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import {
  CtaButton,
  ctaButtonPropsFromTemplate,
} from "@/shared/ui/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import {
  addPackToCart,
  isPackInCart,
  subscribeCart,
} from "@/services/cart";
import { CoverflowBuyConfirm } from "@/features/packs/CoverflowBuyConfirm";
import { PlayConfirm } from "@/components/static-card/PlayConfirm";
import { type Iteration } from "@/features/packs/types";
import {
  claimMediaDecoder,
  releaseClaimedDecoder,
} from "@/lib/memory/exclusiveMedia";
import { useHoldRepeat } from "@/hooks/useHoldRepeat";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "@/features/packs/packs.css";
import "@/features/packs/packs-entry.css";
import "@/components/creator/mcp-photo-play-cta-css.css";
import { useMcpCtaGradMotion } from "@/components/creator/useMcpCtaGradMotion";
import "./MobileCssCarousel.css";

const MOBILE_CTA_QUERY = "(max-width: 980px)";

const BUY_PACK_CTA_SIZE_MOBILE = {
  width: 159,
  height: 60,
  strokeWidth: 2,
};

/** Match theme card shrink (~20%); keep CSS --play-cta-scale in sync. */
const PLAY_MOTION_CTA_SCALE = 0.8;

/** Matches MobileCssCarousel.css dual-stack opacity transition. */
const GLOW_FADE_MS = 640;
const DEFAULT_GLOW = "oklch(0.798 0.104 207.84)";

type GlowPhase = "idle" | "prep" | "fading";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function glowColorForItem(item: Iteration | undefined) {
  return (
    item?.backgroundColor ||
    item?.overlayColorEnd ||
    item?.overlayColorStart ||
    DEFAULT_GLOW
  );
}

function indexForSelectedId(
  list: Iteration[],
  selectedId: string | null | undefined,
) {
  if (!selectedId) return 0;
  const index = list.findIndex((item) => item.id === selectedId);
  return index >= 0 ? index : 0;
}

function PackGlowStacks({
  baseColor,
  nextColor,
}: {
  baseColor: string;
  nextColor: string;
}) {
  return (
    <>
      <div
        className="packs-glow-stack packs-glow-stack--base"
        aria-hidden="true"
        style={{ ["--overlay-gradient-color-end" as string]: baseColor }}
      >
        <div className="packs-circle packs-circle--bloom" />
        <div className="packs-circle packs-circle--core" />
      </div>
      <div
        className="packs-glow-stack packs-glow-stack--next"
        aria-hidden="true"
        style={{ ["--overlay-gradient-color-end" as string]: nextColor }}
      >
        <div className="packs-circle packs-circle--bloom" />
        <div className="packs-circle packs-circle--core" />
      </div>
    </>
  );
}

function PackSlideHud({
  item,
  active,
  pocketed,
  buyConfirmOpen,
  buyConfirmLeaving,
  buyQuantity,
  confirmingAdd,
  slideCta = "buy",
  freePlayMode = false,
  onToggleBuyConfirm,
  onCloseBuyConfirm,
  onConfirmBuy,
  onBuyQuantityChange,
  onAddToPocket,
  onBuyConfirmLeaveEnd,
  onConfirmingAddEnd,
  onView,
}: {
  item: Iteration;
  active: boolean;
  pocketed: boolean;
  buyConfirmOpen: boolean;
  buyConfirmLeaving: boolean;
  buyQuantity: number;
  confirmingAdd: boolean;
  slideCta?: "buy" | "view" | "play";
  /** Theme Free Play toggle on — CTA says Free Play (no ◆ price) for every motion. */
  freePlayMode?: boolean;
  onToggleBuyConfirm: () => void;
  onCloseBuyConfirm: () => void;
  onConfirmBuy: (quantity: number) => void;
  onBuyQuantityChange: (quantity: number) => void;
  onAddToPocket: () => void;
  onBuyConfirmLeaveEnd: () => void;
  onConfirmingAddEnd: () => void;
  onView?: (item: Iteration) => void;
}) {
  // Mount hidden, then flip is-visible after paint so CSS entrance transitions run.
  const [revealed, setRevealed] = useState(false);
  const [playCtaEl, setPlayCtaEl] = useState<HTMLDivElement | null>(null);
  const [playConfirm, setPlayConfirm] = useState(false);
  const [playConfirmLeaving, setPlayConfirmLeaving] = useState(false);
  const pendingPlayRef = useRef(false);
  const playOpenedAtRef = useRef(0);
  const playCost = Math.round(item.price ?? 0);
  const [cssPlayCta, setCssPlayCta] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_CTA_QUERY).matches
      : false,
  );
  const gradWrapRef = useMcpCtaGradMotion(cssPlayCta);
  const motionIcon = 14; /* match --text-body Play Motion type */

  useEffect(() => {
    const media = window.matchMedia(MOBILE_CTA_QUERY);
    const sync = () => setCssPlayCta(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active) {
      setRevealed(false);
      setPlayConfirm(false);
      setPlayConfirmLeaving(false);
      pendingPlayRef.current = false;
      return;
    }
    if (prefersReducedMotion()) {
      setRevealed(true);
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setRevealed(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [active, item.id]);

  return (
    <div
      className={`coverflow-active-stack coverflow-active-stack--html mobile-css-carousel__hud swiper-no-swiping${
        revealed ? " is-visible" : ""
      }`}
      aria-hidden={!revealed}
    >
      <div
        className={`coverflow-buy-pack-cta${
          confirmingAdd ? " is-confirming" : ""
        }${buyConfirmOpen || buyConfirmLeaving ? " is-buy-confirm-open" : ""}`}
        onAnimationEnd={(event) => {
          if (event.animationName !== "coverflow-buy-cta-confirm") return;
          onConfirmingAddEnd();
        }}
      >
        <div className="coverflow-buy-pack-cta__primary">
          {slideCta === "play" ? (
            <div
              ref={setPlayCtaEl}
              className={[
                "coverflow-compact-play-cta",
                freePlayMode ? "is-free-play-owned" : "",
                cssPlayCta ? "is-css" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {cssPlayCta ? (
                <div ref={gradWrapRef} className="mcp-photo-play-cta-css-wrap">
                  <button
                    type="button"
                    className="mcp-photo-play-cta-css mcp-photo-play-cta-css--motion coverflow-buy-pack-cta__button"
                    tabIndex={revealed ? 0 : -1}
                    aria-label={
                      freePlayMode
                        ? `Free Play ${item.packName || item.name}`
                        : `Play Motion ${item.packName || item.name} for ${playCost} diamonds`
                    }
                    aria-expanded={
                      freePlayMode
                        ? undefined
                        : playConfirm || playConfirmLeaving
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      if (freePlayMode) {
                        onView?.(item);
                        return;
                      }
                      if (playConfirmLeaving) return;
                      if (playConfirm) {
                        if (Date.now() - playOpenedAtRef.current < 450) return;
                        pendingPlayRef.current = false;
                        setPlayConfirmLeaving(true);
                        return;
                      }
                      playOpenedAtRef.current = Date.now();
                      setPlayConfirm(true);
                    }}
                  >
                    {freePlayMode ? (
                      <>
                        <span className="mcp-photo-play-cta-css__label">
                          Free Play
                        </span>
                        <Play
                          className="mcp-photo-play-cta-css__play"
                          size={motionIcon}
                          strokeWidth={2.4}
                          fill="currentColor"
                          aria-hidden
                        />
                      </>
                    ) : (
                      <>
                        <DiamondLottie
                          className="mcp-photo-play-cta-css__diamond"
                          size={motionIcon}
                          aria-hidden
                        />
                        <span className="mcp-photo-play-cta-css__price">
                          {playCost}
                        </span>
                        <span className="mcp-photo-play-cta-css__label">
                          Play Motion
                        </span>
                        <Play
                          className="mcp-photo-play-cta-css__play"
                          size={motionIcon}
                          strokeWidth={2.4}
                          fill="currentColor"
                          aria-hidden
                        />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <CtaButton
                  {...ctaButtonPropsFromTemplate("squircleCTA")}
                  width={Math.round(210 * PLAY_MOTION_CTA_SCALE)}
                  height={Math.round(56 * PLAY_MOTION_CTA_SCALE)}
                  strokeWidth={1}
                  label=""
                  leadingIcon={
                    freePlayMode ? (
                      <>
                        <span className="coverflow-compact-play-cta__label">
                          Free Play
                        </span>
                        <Play
                          className="coverflow-compact-play-cta__triangle"
                          size={motionIcon}
                          strokeWidth={2.4}
                          fill="currentColor"
                          aria-hidden
                        />
                      </>
                    ) : (
                      <>
                        <DiamondLottie
                          className="coverflow-compact-play-cta__diamond"
                          size={motionIcon}
                          aria-hidden
                        />
                        <span className="coverflow-compact-play-cta__price">
                          {playCost}
                        </span>
                        <span className="coverflow-compact-play-cta__label">
                          Play Motion
                        </span>
                        <Play
                          className="coverflow-compact-play-cta__triangle"
                          size={motionIcon}
                          strokeWidth={2.4}
                          fill="currentColor"
                          aria-hidden
                        />
                      </>
                    )
                  }
                  costAmount={null}
                  fontSize={14} /* body step — was 11 via 0.8 scale */
                  cornerRadius={999}
                  tabIndex={revealed ? 0 : -1}
                  aria-label={
                    freePlayMode
                      ? `Free Play ${item.packName || item.name}`
                      : `Play Motion ${item.packName || item.name} for ${playCost} diamonds`
                  }
                  aria-expanded={
                    freePlayMode
                      ? undefined
                      : playConfirm || playConfirmLeaving
                  }
                  className="coverflow-buy-pack-cta__button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (freePlayMode) {
                      onView?.(item);
                      return;
                    }
                    if (playConfirmLeaving) return;
                    if (playConfirm) {
                      if (Date.now() - playOpenedAtRef.current < 450) return;
                      pendingPlayRef.current = false;
                      setPlayConfirmLeaving(true);
                      return;
                    }
                    playOpenedAtRef.current = Date.now();
                    setPlayConfirm(true);
                  }}
                />
              )}
              {!freePlayMode &&
              (playConfirm || playConfirmLeaving) &&
              playCtaEl ? (
                <PlayConfirm
                  anchor={playCtaEl}
                  playCost={playCost}
                  label="Play Motion Card?"
                  leaving={playConfirmLeaving}
                  onCancel={() => {
                    pendingPlayRef.current = false;
                    setPlayConfirmLeaving(true);
                  }}
                  onConfirm={() => {
                    pendingPlayRef.current = true;
                    setPlayConfirmLeaving(true);
                  }}
                  onLeaveEnd={() => {
                    const play = pendingPlayRef.current;
                    pendingPlayRef.current = false;
                    setPlayConfirm(false);
                    setPlayConfirmLeaving(false);
                    if (play) onView?.(item);
                  }}
                />
              ) : null}
            </div>
          ) : cssPlayCta ? (
            <div
              ref={gradWrapRef}
              className="mcp-photo-play-cta-css-wrap mcp-photo-play-cta-css-wrap--slider"
            >
              <button
                type="button"
                className="mcp-photo-play-cta-css mcp-photo-play-cta-css--slider coverflow-buy-pack-cta__button"
                tabIndex={revealed ? 0 : -1}
                aria-label={
                  slideCta === "view"
                    ? `View Theme ${item.packName || item.name}`
                    : `Buy Pack ${item.packName || item.name} for ${Math.round(
                        (item.price ?? 0) *
                          (buyConfirmOpen || buyConfirmLeaving
                            ? buyQuantity
                            : 1),
                      )} diamonds`
                }
                aria-expanded={
                  slideCta === "buy"
                    ? buyConfirmOpen || buyConfirmLeaving
                    : undefined
                }
                aria-controls={
                  slideCta === "buy"
                    ? `coverflow-buy-confirm-${item.id}`
                    : undefined
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (slideCta === "view") {
                    onView?.(item);
                    return;
                  }
                  onToggleBuyConfirm();
                }}
              >
                <span className="mcp-photo-play-cta-css__label">
                  {slideCta === "view" ? "View Theme" : "Buy Pack"}
                </span>
                {slideCta === "buy" ? (
                  <span className="mcp-photo-play-cta-css__cost">
                    <span className="mcp-photo-play-cta-css__price">
                      {Math.round(
                        (item.price ?? 0) *
                          (buyConfirmOpen || buyConfirmLeaving
                            ? buyQuantity
                            : 1),
                      )}
                    </span>
                    <DiamondLottie
                      className="mcp-photo-play-cta-css__diamond"
                      size={16}
                      aria-hidden
                    />
                  </span>
                ) : null}
              </button>
            </div>
          ) : (
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              {...BUY_PACK_CTA_SIZE_MOBILE}
              cornerRadius={12} /* 0.75rem */
              // Force red squircle plate (coverflow used to pin gold hex chrome).
              auroraBaseColor="#42001b"
              auroraColorStops={["#aa3c6b", "#ea2e89", "#42001b", "#933e4c"]}
              auroraRotation={45}
              glowColors={["#aa085f", "#e00083", "#eb6a00"]}
              glowColor="326 90 30"
              strokeColor="rgba(170, 8, 95, 0.42)"
              labelColor="#ffe0e8"
              auroraPaused
              glowAlwaysOn={false}
              glowOuterBloom="off"
              costIconAnimated={false}
              label={slideCta === "view" ? "View Theme" : "Buy Pack"}
              costAmount={
                slideCta === "buy"
                  ? String(
                      Math.round(
                        (item.price ?? 0) *
                          (buyConfirmOpen || buyConfirmLeaving
                            ? buyQuantity
                            : 1),
                      ),
                    )
                  : null
              }
              style={{ ["--cta-aurora-angle" as string]: "45deg" }}
              className="coverflow-buy-pack-cta__button"
              tabIndex={revealed ? 0 : -1}
              aria-expanded={
                slideCta === "buy"
                  ? buyConfirmOpen || buyConfirmLeaving
                  : undefined
              }
              aria-controls={
                slideCta === "buy"
                  ? `coverflow-buy-confirm-${item.id}`
                  : undefined
              }
              onClick={(event) => {
                event.stopPropagation();
                if (slideCta === "view") {
                  onView?.(item);
                  return;
                }
                onToggleBuyConfirm();
              }}
            />
          )}
          {slideCta === "buy" && (buyConfirmOpen || buyConfirmLeaving) ? (
            <CoverflowBuyConfirm
              id={`coverflow-buy-confirm-${item.id}`}
              leaving={buyConfirmLeaving}
              quantity={buyQuantity}
              onQuantityChange={onBuyQuantityChange}
              onCancel={onCloseBuyConfirm}
              onConfirm={onConfirmBuy}
              onLeaveEnd={onBuyConfirmLeaveEnd}
              onAddToPocket={onAddToPocket}
              pocketDisabled={pocketed}
              pocketLabel={pocketed ? "In Pocket" : "Add to Pocket"}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompactPlayButton({
  item,
  onPlay,
}: {
  item: Iteration;
  onPlay: (item: Iteration) => void;
}) {
  const [cssCta, setCssCta] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_CTA_QUERY).matches
      : false,
  );
  const gradWrapRef = useMcpCtaGradMotion(cssCta);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_CTA_QUERY);
    const sync = () => setCssCta(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <div
      className={[
        "mobile-css-carousel__play",
        "coverflow-play-only-cta",
        cssCta ? "is-css" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {cssCta ? (
        <div ref={gradWrapRef} className="mcp-photo-play-cta-css-wrap">
          <button
            type="button"
            className="mcp-photo-play-cta-css mcp-photo-play-cta-css--play-only"
            aria-label={`Play ${item.packName || item.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onPlay(item);
            }}
          >
            <Play
              className="mcp-photo-play-cta-css__play"
              size={11}
              strokeWidth={2.4}
              fill="currentColor"
              aria-hidden
            />
            <span className="mcp-photo-play-cta-css__label">Play</span>
          </button>
        </div>
      ) : (
        <CtaButton
          {...ctaButtonPropsFromTemplate("squircleCTA")}
          fillParent
          strokeWidth={1}
          cornerRadius={999}
          auroraBaseColor="#42001b"
          auroraColorStops={["#aa3c6b", "#ea2e89", "#42001b", "#933e4c"]}
          glowColors={["#aa085f", "#e00083", "#eb6a00"]}
          glowColor="326 90 30"
          strokeColor="rgba(170, 8, 95, 0.42)"
          labelColor="#ffe0e8"
          glowOuterBloom="off"
          auroraPaused
          label="Play"
          leadingIcon={
            <Play
              className="motion-card-play-cta__triangle"
              size={11}
              strokeWidth={2.4}
              fill="currentColor"
              aria-hidden
            />
          }
          costAmount={null}
          aria-label={`Play ${item.packName || item.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onPlay(item);
          }}
        />
      )}
    </div>
  );
}

export function MobileCssCarousel({
  items,
  onReady,
  onBuy,
  onAddToPocket,
  onFocusChange,
  onSelect,
  onView,
  buyDisabled = false,
  influencerBackdrop = false,
  selectedId = null,
  compact = false,
  flat = false,
  stageBackdropBase,
  stageBackdropSrc,
  stageBackdropSrc2x,
  stageBackdropLabel,
  slideCta = "buy",
  freePlayMode = false,
  ownedFreePlayIds = null,
}: {
  items: Iteration[];
  onReady?: () => void;
  /** Home / purchase buy path. When omitted, confirm only closes (playground). */
  onBuy?: (item: Iteration, quantity?: number) => void;
  /** Home pocket path. When omitted, adds directly to the pack cart. */
  onAddToPocket?: (item: Iteration) => void;
  onFocusChange?: (item: Iteration | null) => void;
  /** Profile coverflow: View Now instead of Buy Pack. */
  onView?: (item: Iteration) => void;
  /** Compact resume strip: tap active pack (or play) instead of Buy Pack. */
  onSelect?: (item: Iteration) => void;
  buyDisabled?: boolean;
  /** Stage backdrop from influencer API cover/swipe poster. */
  influencerBackdrop?: boolean;
  /** Jump swiper to this pack id when set from outside (status pager). */
  selectedId?: string | null;
  /** Fit a parent panel: no buy HUD, no dim overlay, scaled coverflow. */
  compact?: boolean;
  /** Flat slide carousel (no coverflow 3D) — profile glass cards. */
  flat?: boolean;
  /** Profile charcoal art base (no extension) — fixed behind the slider, not in the track. */
  stageBackdropBase?: string;
  /** API charcoal bust URL (1x). Wins over stageBackdropBase when set. */
  stageBackdropSrc?: string;
  /** API charcoal bust URL (2x). */
  stageBackdropSrc2x?: string;
  /** Influencer name under the charcoal bust. */
  stageBackdropLabel?: string;
  /** Profile / theme: View Now or Play on the active slide instead of Buy Pack. */
  slideCta?: "buy" | "view" | "play";
  /**
   * Theme Free Play toggle — CTA says Free Play for every motion while on.
   * Pink owned ring still uses ownedFreePlayIds (unlocked only).
   */
  freePlayMode?: boolean;
  /** Unlocked motions — pink ring while Free Play is on. */
  ownedFreePlayIds?: ReadonlySet<string> | null;
}) {
  const useCoverflow = !compact && !flat;
  const swiperRef = useRef<SwiperClass | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const stageNameRef = useRef<HTMLParagraphElement | null>(null);
  const onReadyRef = useRef(onReady);
  const onBuyRef = useRef(onBuy);
  const onAddToPocketRef = useRef(onAddToPocket);
  const onFocusChangeRef = useRef(onFocusChange);
  const onSelectRef = useRef(onSelect);
  const onViewRef = useRef(onView);
  const buyDisabledRef = useRef(buyDisabled);
  const readySent = useRef(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    indexForSelectedId(items, selectedId),
  );
  const activeIndexRef = useRef(indexForSelectedId(items, selectedId));
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const parkedRef = useRef(true);
  const [hudActive, setHudActive] = useState(false);
  const pageVisibleRef = useRef(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const heroVisibleRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [pocketTick, setPocketTick] = useState(0);
  const [buyConfirmOpen, setBuyConfirmOpen] = useState(false);
  const [buyConfirmLeaving, setBuyConfirmLeaving] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [confirmingAdd, setConfirmingAdd] = useState(false);
  const buyConfirmOpenRef = useRef(false);
  const buyConfirmLeavingRef = useRef(false);
  const buyQuantityRef = useRef(1);
  const initialGlow = glowColorForItem(items[0]);
  const [baseGlow, setBaseGlow] = useState(initialGlow);
  const [nextGlow, setNextGlow] = useState(initialGlow);
  const [glowPhase, setGlowPhase] = useState<GlowPhase>("idle");
  const glowTargetRef = useRef(initialGlow);
  const glowPhaseRef = useRef<GlowPhase>("idle");
  const baseGlowRef = useRef(initialGlow);
  const nextGlowRef = useRef(initialGlow);
  const glowFadeTimerRef = useRef(0);
  const glowRafRef = useRef(0);
  onReadyRef.current = onReady;
  onBuyRef.current = onBuy;
  onAddToPocketRef.current = onAddToPocket;
  onFocusChangeRef.current = onFocusChange;
  onSelectRef.current = onSelect;
  onViewRef.current = onView;
  buyDisabledRef.current = buyDisabled;
  activeIndexRef.current = activeIndex;
  buyConfirmOpenRef.current = buyConfirmOpen;
  buyConfirmLeavingRef.current = buyConfirmLeaving;
  buyQuantityRef.current = buyQuantity;
  glowPhaseRef.current = glowPhase;
  baseGlowRef.current = baseGlow;
  nextGlowRef.current = nextGlow;

  useEffect(() => {
    onFocusChangeRef.current?.(items[activeIndex] ?? null);
  }, [activeIndex, items]);

  // External selection (status-pager) → jump carousel without long easing.
  // Duration 0 avoids stacking transitions that freeze the main thread while scrubbing.
  useEffect(() => {
    if (!selectedId) return;
    const index = items.findIndex((item) => item.id === selectedId);
    if (index < 0) return;
    if (index === activeIndexRef.current) return;
    const swiper = swiperRef.current;
    if (!swiper) return;
    swiper.slideTo(index, 0);
  }, [selectedId, items]);

  const clearGlowTimers = useCallback(() => {
    window.clearTimeout(glowFadeTimerRef.current);
    window.cancelAnimationFrame(glowRafRef.current);
    glowFadeTimerRef.current = 0;
    glowRafRef.current = 0;
  }, []);

  const snapGlow = useCallback(
    (color: string) => {
      clearGlowTimers();
      glowTargetRef.current = color;
      glowPhaseRef.current = "idle";
      baseGlowRef.current = color;
      nextGlowRef.current = color;
      setBaseGlow(color);
      setNextGlow(color);
      setGlowPhase("idle");
    },
    [clearGlowTimers],
  );

  const fadeGlowTo = useCallback(
    (color: string) => {
      if (compact) return;
      if (prefersReducedMotion()) {
        snapGlow(color);
        return;
      }

      const phase = glowPhaseRef.current;
      if (color === glowTargetRef.current && phase !== "idle") return;
      if (color === baseGlowRef.current && phase === "idle") return;

      clearGlowTimers();

      // Mid-crossfade: lock in the incoming color as the new base, then restart.
      if (phase === "fading") {
        const locked = nextGlowRef.current;
        baseGlowRef.current = locked;
        setBaseGlow(locked);
      }

      glowTargetRef.current = color;
      nextGlowRef.current = color;
      setNextGlow(color);
      glowPhaseRef.current = "prep";
      setGlowPhase("prep");

      // Double rAF so the next stack paints at opacity 0 before fading in.
      glowRafRef.current = window.requestAnimationFrame(() => {
        glowRafRef.current = window.requestAnimationFrame(() => {
          if (glowTargetRef.current !== color) return;
          glowPhaseRef.current = "fading";
          setGlowPhase("fading");
          glowFadeTimerRef.current = window.setTimeout(() => {
            if (glowTargetRef.current !== color) return;
            baseGlowRef.current = color;
            nextGlowRef.current = color;
            glowPhaseRef.current = "idle";
            setBaseGlow(color);
            setNextGlow(color);
            setGlowPhase("idle");
            glowFadeTimerRef.current = 0;
          }, GLOW_FADE_MS);
        });
      });
    },
    [clearGlowTimers, compact, snapGlow],
  );

  function closeBuyConfirm() {
    // Already closed or mid-leave — don't restart leave/enter.
    if (!buyConfirmOpenRef.current) return;
    buyConfirmOpenRef.current = false;
    setBuyConfirmOpen(false);
    const leaving = !prefersReducedMotion();
    buyConfirmLeavingRef.current = leaving;
    setBuyConfirmLeaving(leaving);
  }

  function openBuyConfirm() {
    if (buyDisabledRef.current) return;
    if (buyConfirmOpenRef.current || buyConfirmLeavingRef.current) return;
    buyConfirmLeavingRef.current = false;
    buyConfirmOpenRef.current = true;
    buyQuantityRef.current = 1;
    setBuyQuantity(1);
    setBuyConfirmLeaving(false);
    setBuyConfirmOpen(true);
  }

  function toggleBuyConfirm() {
    if (buyDisabledRef.current) return;
    if (buyConfirmOpenRef.current) closeBuyConfirm();
    else openBuyConfirm();
  }

  function confirmActiveBuy(quantity = buyQuantityRef.current) {
    if (buyDisabledRef.current) return;
    const item = items[activeIndexRef.current];
    closeBuyConfirm();
    if (item) onBuyRef.current?.(item, quantity);
  }

  function addActiveToPocket() {
    const item = items[activeIndexRef.current];
    if (!item) return;
    if (isPackInCart(item.id, item.characterId)) return;
    if (!prefersReducedMotion()) setConfirmingAdd(true);
    const external = onAddToPocketRef.current;
    if (external) {
      external(item);
      return;
    }
    addPackToCart({
      packId: item.id,
      packName: item.packName || item.name,
      creator: item.girlName,
      characterId: item.characterId,
      price: item.price,
      videoUrl: item.videoUrl,
      packNumber: item.packNumber,
      flagEmoji: item.flagEmoji,
      flagSvgUrl: item.flagSvgUrl,
      city: item.city,
      country: item.country,
      overlayColorStart: item.overlayColorStart,
      overlayColorEnd: item.overlayColorEnd,
      backgroundColor: item.backgroundColor,
    });
  }

  const activeSurfaceReady = useCallback(() => {
    const item = items[activeIndex];
    // Poster is enough for first paint — don't block the page on a decoder.
    if (item?.posterUrl) return true;
    if (!item?.videoUrl) return true;
    return false;
  }, [activeIndex, items]);

  const neighborOnScreen = useCallback((swiper: SwiperClass) => {
    const next = swiper.slides[swiper.activeIndex + 1] as HTMLElement | undefined;
    if (!next) return true;
    const rect = next.getBoundingClientRect();
    return rect.left < window.innerWidth - 8 && rect.right > 8;
  }, []);

  const markReady = useCallback(
    (swiper: SwiperClass) => {
      if (readySent.current) return;
      if (!neighborOnScreen(swiper) || !activeSurfaceReady()) return;
      readySent.current = true;
      onReadyRef.current?.();
    },
    [activeSurfaceReady, neighborOnScreen],
  );

  const applySlideDim = useCallback((swiper: SwiperClass) => {
    swiper.slides.forEach((slide) => {
      const t = Math.min(1, Math.abs(slide.progress ?? 0));
      const eased = t * t * (3 - 2 * t);
      // Compact fades pack art via opacity; coverflow uses a black overlay.
      // Play sits outside the pack so it stays fully opaque while sliding.
      slide.style.setProperty(
        "--slide-dim",
        String((compact ? 0.45 : 0.5) * eased),
      );
      // Flat profile: side peeks dim + scale; active centers at full.
      if (flat) {
        slide.style.setProperty(
          "--slide-scale",
          String(1 - 0.15 * eased),
        );
        slide.style.setProperty(
          "--slide-brightness",
          String(1 - 0.3 * eased),
        );
      }
    });
  }, [compact, flat]);

  /** Kill leftover coverflow rotate/scale if a prior effect left inline 3D styles. */
  const flattenSlideTransforms = useCallback(
    (swiper: SwiperClass) => {
      if (!flat) return;
      swiper.el.classList.remove("swiper-3d", "swiper-coverflow");
      swiper.wrapperEl?.classList.remove("swiper-3d");
      for (const slide of swiper.slides) {
        const el = slide as HTMLElement;
        const transform = el.style.transform || "";
        if (!transform || transform === "none") continue;
        if (!/rotate|scale\(|matrix3d/i.test(transform)) continue;
        el.style.transform = "none";
        el.style.zIndex = "";
      }
    },
    [flat],
  );

  const syncLiveClass = useCallback(() => {
    const live =
      !parkedRef.current &&
      Boolean(focusRef.current?.classList.contains("is-ready"));
    stageRef.current?.classList.toggle("is-live-video", live);
  }, []);

  const setParked = useCallback((next: boolean) => {
    parkedRef.current = next;
    focusRef.current?.classList.toggle("is-parked", next);
    if (!compact) setHudActive(!next);
    syncLiveClass();
  }, [compact, syncLiveClass]);

  const layoutFocus = useCallback(() => {
    const shell = shellRef.current;
    const focus = focusRef.current;
    const swiper = swiperRef.current;
    if (!shell || !focus || !swiper) return;
    const slide = swiper.slides[swiper.activeIndex] as HTMLElement | undefined;
    const pack = slide?.querySelector<HTMLElement>(".mobile-css-carousel__pack");
    if (!pack) return;
    const shellRect = shell.getBoundingClientRect();
    const packRect = pack.getBoundingClientRect();
    // Owned free-play ring is on the pack — inset so live video does not cover it.
    const inset = pack.classList.contains("is-owned-free-play") ? 2 : 0;
    focus.style.left = `${packRect.left - shellRect.left + inset}px`;
    focus.style.top = `${packRect.top - shellRect.top + inset}px`;
    focus.style.width = `${Math.max(0, packRect.width - inset * 2)}px`;
    focus.style.height = `${Math.max(0, packRect.height - inset * 2)}px`;
  }, []);

  const attachActiveVideo = useCallback(() => {
    const video = liveVideoRef.current;
    const focus = focusRef.current;
    if (!video) return;
    layoutFocus();
    if (!pageVisibleRef.current || !heroVisibleRef.current || parkedRef.current) {
      if (!pageVisibleRef.current || !heroVisibleRef.current) {
        releaseClaimedDecoder(video);
        focus?.classList.remove("is-ready");
        syncLiveClass();
      } else {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    const src = itemsRef.current[activeIndexRef.current]?.videoUrl?.trim() || "";
    if (!src) {
      releaseClaimedDecoder(video);
      focus?.classList.remove("is-ready");
      syncLiveClass();
      return;
    }
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    claimMediaDecoder(video, src);
    if (video.readyState >= 2 && video.videoWidth > 1) {
      focus?.classList.add("is-ready");
    } else {
      focus?.classList.remove("is-ready");
    }
    syncLiveClass();
    void video.play().catch(() => {});
  }, [layoutFocus, syncLiveClass]);

  const syncPlayback = useCallback(
    (next: number) => {
      activeIndexRef.current = next;
      setActiveIndex(next);
      buyConfirmOpenRef.current = false;
      buyConfirmLeavingRef.current = false;
      buyQuantityRef.current = 1;
      setBuyConfirmOpen(false);
      setBuyConfirmLeaving(false);
      setBuyQuantity(1);
      fadeGlowTo(glowColorForItem(items[next]));
    },
    [fadeGlowTo, items],
  );

  useEffect(() => {
    return () => clearGlowTimers();
  }, [clearGlowTimers]);

  // Catalog swap / first paint — keep selected (or current) slide, not always 0.
  useEffect(() => {
    readySent.current = false;
    const preferredId =
      selectedIdRef.current ||
      itemsRef.current[activeIndexRef.current]?.id ||
      null;
    const next = indexForSelectedId(items, preferredId);
    activeIndexRef.current = next;
    setActiveIndex(next);
    if (!compact) snapGlow(glowColorForItem(items[next]));
    releaseClaimedDecoder(liveVideoRef.current);
    focusRef.current?.classList.remove("is-ready");
    syncLiveClass();
    const swiper = swiperRef.current;
    if (swiper && swiper.activeIndex !== next) {
      swiper.slideTo(next, 0);
    }
    if (swiper && pageVisibleRef.current && heroVisibleRef.current) {
      setParked(false);
      attachActiveVideo();
    }
  }, [attachActiveVideo, compact, items, setParked, snapGlow, syncLiveClass]);

  // Tab hide / bfcache: drop the decoder so iOS can reclaim page memory.
  useEffect(() => {
    function releaseDecoders() {
      pageVisibleRef.current = false;
      releaseClaimedDecoder(liveVideoRef.current);
      focusRef.current?.classList.remove("is-ready");
      syncLiveClass();
    }

    function restoreDecoders() {
      pageVisibleRef.current = true;
      if (!parkedRef.current) attachActiveVideo();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") releaseDecoders();
      else restoreDecoders();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", releaseDecoders);
    window.addEventListener("pageshow", restoreDecoders);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", releaseDecoders);
      window.removeEventListener("pageshow", restoreDecoders);
      releaseClaimedDecoder(liveVideoRef.current);
    };
  }, [attachActiveVideo, syncLiveClass]);

  // Drop the pack decoder when the page scroller hides the hero.
  useEffect(() => {
    const shell = shellRef.current;
    const scroller = shell?.closest<HTMLElement>("[data-page-scroll]");
    if (!shell || !scroller) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      const rect = shell.getBoundingClientRect();
      const root = scroller.getBoundingClientRect();
      const visibleH =
        Math.min(rect.bottom, root.bottom) - Math.max(rect.top, root.top);
      const visible = rect.height > 0 && visibleH / rect.height >= 0.35;
      if (heroVisibleRef.current === visible) return;
      heroVisibleRef.current = visible;
      if (visible) {
        // Swiper parks on init translate; unpark so the first pack plays on
        // scroll-in, not only after a swipe.
        if (pageVisibleRef.current) {
          setParked(false);
          attachActiveVideo();
        }
        return;
      }
      releaseClaimedDecoder(liveVideoRef.current);
      focusRef.current?.classList.remove("is-ready");
      syncLiveClass();
    };
    const queue = () => {
      if (!raf) raf = window.requestAnimationFrame(sync);
    };
    scroller.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    sync();
    return () => {
      scroller.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [attachActiveVideo, setParked, syncLiveClass]);

  // Warm poster bitmaps before any pack video decoder starts.
  useEffect(() => {
    const warmers = items
      .map((item) => item.posterUrl)
      .filter((src): src is string => Boolean(src))
      .map((src) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
        return img;
      });
    return () => {
      for (const img of warmers) img.src = "";
    };
  }, [items]);

  function onSwiper(swiper: SwiperClass) {
    swiperRef.current = swiper;
    const preferred = indexForSelectedId(
      itemsRef.current,
      selectedIdRef.current,
    );
    if (swiper.activeIndex !== preferred) {
      swiper.slideTo(preferred, 0);
    }
    syncPlayback(preferred);
    applySlideDim(swiper);
    flattenSlideTransforms(swiper);
    swiper.update();
    applySlideDim(swiper);
    flattenSlideTransforms(swiper);
    setParked(false);
    attachActiveVideo();
    markReady(swiper);
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (readySent.current) return;
      readySent.current = true;
      onReadyRef.current?.();
    }, 2500);
    return () => window.clearTimeout(id);
  }, [items]);

  useEffect(() => {
    const swiper = swiperRef.current;
    if (swiper) markReady(swiper);
  }, [activeIndex, items, markReady]);

  /** Start at 26cqi, then shrink so long influencer names still fit one line. */
  const fitStageName = useCallback(() => {
    const el = stageNameRef.current;
    if (!el) return;
    el.style.fontSize = "";
    const maxPx = Number.parseFloat(getComputedStyle(el).fontSize) || 26;
    const minPx = Math.max(12, maxPx * 0.45);
    let size = maxPx;
    el.style.fontSize = `${size}px`;
    while (size > minPx && el.scrollWidth > el.clientWidth + 1) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, []);

  useLayoutEffect(() => {
    if (!flat || !stageBackdropLabel) return;
    fitStageName();
  }, [flat, stageBackdropLabel, fitStageName]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      layoutFocus();
      fitStageName();
    });
    observer.observe(shell);
    const onResize = () => {
      layoutFocus();
      fitStageName();
    };
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [layoutFocus, fitStageName]);

  // Free Play toggle adds/removes the pack ring without a slide change —
  // re-inset the live focus so video doesn't cover the stroke (or leave a gap).
  const activeOwnedFreePlay = Boolean(
    items[activeIndex] && ownedFreePlayIds?.has(items[activeIndex].id),
  );
  useLayoutEffect(() => {
    layoutFocus();
  }, [activeOwnedFreePlay, layoutFocus]);

  useEffect(() => {
    if (compact) return;
    return subscribeCart(() => setPocketTick((n) => n + 1));
  }, [compact]);

  useEffect(() => {
    if (!buyConfirmOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBuyConfirm();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [buyConfirmOpen]);

  useEffect(() => {
    if (!buyConfirmLeaving) return;
    const timeout = window.setTimeout(() => {
      buyConfirmLeavingRef.current = false;
      setBuyConfirmLeaving(false);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [buyConfirmLeaving]);

  useEffect(() => {
    if (!confirmingAdd) return;
    const timeout = window.setTimeout(() => setConfirmingAdd(false), 300);
    return () => window.clearTimeout(timeout);
  }, [confirmingAdd]);

  // Coverflow 3D transforms break hit-testing; keep CTAs inside slides visually
  // and resolve taps by screen rect on the shell. Skip when the event already
  // landed on a real control — otherwise pointerup + click both toggle and the
  // confirm dialog open animation loops (open then immediate leave).
  function handleShellPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (compact) return;
    const origin = event.target;
    if (
      origin instanceof Element &&
      origin.closest(
        ".cta-button, .coverflow-buy-pack-cta__button, .coverflow-buy-confirm, .coverflow-cart-remove-confirm, .coverflow-buy-confirm__pocket",
      )
    ) {
      return;
    }

    const swiper = swiperRef.current;
    if (!swiper) return;
    const active = swiper.slides[swiper.activeIndex] as HTMLElement | undefined;
    if (!active) return;
    const x = event.clientX;
    const y = event.clientY;
    const targets = active.querySelectorAll<HTMLElement>(
      ".coverflow-buy-confirm .is-confirm, .coverflow-buy-confirm .is-cancel, .coverflow-buy-pack-cta__button, .coverflow-buy-confirm__pocket",
    );
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      event.preventDefault();
      event.stopPropagation();
      if (el.classList.contains("is-confirm")) {
        confirmActiveBuy();
        return;
      }
      if (el.classList.contains("is-cancel")) {
        closeBuyConfirm();
        return;
      }
      if (el.classList.contains("coverflow-buy-pack-cta__button")) {
        toggleBuyConfirm();
        return;
      }
      if (el.classList.contains("coverflow-buy-confirm__pocket")) {
        addActiveToPocket();
        return;
      }
    }
  }

  const holdStartedAt = useRef(0);
  const holdTarget = useRef(0);
  const holdingRef = useRef(false);

  const holdSlideSpeed = () => {
    const t = Date.now() - holdStartedAt.current;
    if (t < 80) return 360;
    return Math.max(0, Math.round(300 - (t - 80) * 0.85));
  };

  const stepHold = (dir: -1 | 1) => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    const last = itemsRef.current.length - 1;
    const dest = Math.max(0, Math.min(last, holdTarget.current + dir));
    if (dest === holdTarget.current) return;
    holdTarget.current = dest;
    swiper.slideTo(dest, holdSlideSpeed());
  };

  const holdPrev = useHoldRepeat(() => stepHold(-1));
  const holdNext = useHoldRepeat(() => stepHold(1));

  const bindArrowHold = (hold: ReturnType<typeof useHoldRepeat>) => ({
    ...hold,
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      holdStartedAt.current = Date.now();
      holdTarget.current =
        swiperRef.current?.activeIndex ?? activeIndexRef.current;
      holdingRef.current = true;
      setParked(true);
      hold.onPointerDown(event);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      holdingRef.current = false;
      hold.onPointerUp(event);
      setParked(false);
      attachActiveVideo();
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
      holdingRef.current = false;
      hold.onPointerCancel(event);
      setParked(false);
      attachActiveVideo();
    },
  });

  const stageGlowClass = compact
    ? ""
    : glowPhase === "prep"
      ? " is-glow-prep"
      : glowPhase === "fading"
        ? " is-glow-fading"
        : "";

  const activeBackdropItem = items[activeIndex] ?? items[0];
  const activeBackdropUrl =
    activeBackdropItem?.backgroundImageUrl?.trim() ||
    activeBackdropItem?.posterUrl?.trim() ||
    "";

  return (
    <div
      ref={stageRef}
      className={`stage-packs mobile-css-carousel-stage${stageGlowClass}${
        influencerBackdrop ? " has-influencer-backdrop" : ""
      }${compact ? " is-compact" : ""}${flat ? " is-flat" : ""}${
        compact && items.length === 1 ? " is-single" : ""
      }`}
    >
      {compact || flat ? null : influencerBackdrop ? (
        <div className="packs-influencer-backdrop" aria-hidden="true">
          {activeBackdropUrl ? (
            <img
              key={activeBackdropUrl}
              className="packs-influencer-backdrop__img"
              src={activeBackdropUrl}
              alt=""
              draggable={false}
            />
          ) : null}
          <div className="packs-influencer-backdrop__scrim" />
        </div>
      ) : (
        <PackGlowStacks baseColor={baseGlow} nextColor={nextGlow} />
      )}
      <div
        ref={shellRef}
        className="mobile-css-carousel-shell"
        onPointerUp={handleShellPointerUp}
      >
        {compact && items.length > 1 ? (
          <>
            <button
              type="button"
              className="mc-popular-arrow is-prev"
              aria-label="Previous packs"
              disabled={activeIndex <= 0}
              {...bindArrowHold(holdPrev)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="mc-popular-arrow is-next"
              aria-label="Next packs"
              disabled={activeIndex >= items.length - 1}
              {...bindArrowHold(holdNext)}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </>
        ) : null}
        {/* Fixed behind the track — does not scroll with slides. */}
        {flat && stageBackdropSrc ? (
          <picture
            className="mobile-css-carousel__stage-charcoal"
            aria-hidden="true"
          >
            <img
              src={stageBackdropSrc}
              srcSet={
                stageBackdropSrc2x
                  ? `${stageBackdropSrc} 1x, ${stageBackdropSrc2x} 2x`
                  : undefined
              }
              alt=""
              width={347}
              height={626}
              decoding="async"
              draggable={false}
            />
          </picture>
        ) : flat && stageBackdropBase ? (
          <picture
            className="mobile-css-carousel__stage-charcoal"
            aria-hidden="true"
          >
            <source
              type="image/jxl"
              srcSet={`${stageBackdropBase}@1x.jxl 1x, ${stageBackdropBase}@2x.jxl 2x`}
            />
            <source
              type="image/webp"
              srcSet={`${stageBackdropBase}@1x.webp 1x, ${stageBackdropBase}@2x.webp 2x`}
            />
            <img
              src={`${stageBackdropBase}@1x.webp`}
              srcSet={`${stageBackdropBase}@1x.webp 1x, ${stageBackdropBase}@2x.webp 2x`}
              alt=""
              width={347}
              height={626}
              decoding="async"
              draggable={false}
            />
          </picture>
        ) : null}
        {flat && stageBackdropLabel ? (
          <p ref={stageNameRef} className="mobile-css-carousel__stage-name">
            {stageBackdropLabel}
          </p>
        ) : null}
        <Swiper
          key={flat ? "flat" : compact ? "compact" : "coverflow"}
          className="mobile-css-carousel"
          modules={useCoverflow ? [EffectCoverflow] : []}
          effect={useCoverflow ? "coverflow" : "slide"}
          grabCursor
          centeredSlides={!compact}
          slidesPerView="auto"
          spaceBetween={compact ? 18 : flat ? 16 : -72}
          slidesOffsetBefore={compact && items.length > 1 ? 80 : 0}
          slidesOffsetAfter={compact && items.length > 1 ? 80 : 0}
          speed={720}
          resistanceRatio={0.85}
          watchSlidesProgress={useCoverflow || flat}
          {...(useCoverflow
            ? {
                coverflowEffect: {
                  rotate: 38,
                  stretch: -88,
                  depth: 80,
                  scale: 0.9,
                  modifier: 1,
                  slideShadows: false,
                },
              }
            : {})}
          initialSlide={indexForSelectedId(items, selectedId)}
          onSwiper={onSwiper}
          onProgress={(swiper) => {
            applySlideDim(swiper);
            flattenSlideTransforms(swiper);
          }}
          onSetTranslate={(swiper) => {
            applySlideDim(swiper);
            flattenSlideTransforms(swiper);
            markReady(swiper);
          }}
          onSlideChange={(swiper) => {
            if (swiper.activeIndex === activeIndexRef.current) return;
            // Drop the outgoing decoder before the next clip attaches.
            releaseClaimedDecoder(liveVideoRef.current);
            focusRef.current?.classList.remove("is-ready");
            setParked(true);
            syncPlayback(swiper.activeIndex);
          }}
          onTransitionStart={() => {
            setParked(true);
            try {
              liveVideoRef.current?.pause();
            } catch {
              /* ignore */
            }
          }}
          onSliderFirstMove={() => {
            // Mouse + touch: park as soon as the track moves (touchStart alone
            // can miss desktop grab drags / late starts).
            setParked(true);
            try {
              liveVideoRef.current?.pause();
            } catch {
              /* ignore */
            }
          }}
          onTouchStart={() => {
            setParked(true);
            try {
              liveVideoRef.current?.pause();
            } catch {
              /* ignore */
            }
          }}
          onTransitionEnd={() => {
            if (holdingRef.current) return;
            setParked(false);
            attachActiveVideo();
          }}
          onTouchEnd={(swiper) => {
            if (holdingRef.current) return;
            // Snap/momentum often starts after touchEnd; unparking here left the
            // focus HUD frozen while slides finished moving. Wait one frame —
            // if a transition began, transitionEnd will reattach instead.
            window.requestAnimationFrame(() => {
              if (holdingRef.current || swiper.animating || swiper.destroyed) {
                return;
              }
              setParked(false);
              attachActiveVideo();
            });
          }}
          preventClicks={false}
          preventClicksPropagation={false}
          noSwipingSelector=".mobile-css-carousel__hud, .mobile-css-carousel__glass-plate, .mobile-css-carousel__glass-plate-btn, .mcp-photo-play-cta-css-wrap, .coverflow-buy-pack-cta, .coverflow-buy-confirm, .coverflow-cart-remove-confirm, .cta-button, .mc-popular-arrow"
        >
          {items.map((item, index) => {
            void pocketTick;
            const near = Math.abs(index - activeIndex) <= 2;
            const ownedFreePlay = Boolean(ownedFreePlayIds?.has(item.id));
            return (
              <SwiperSlide key={item.id}>
                <div
                  className={
                    ownedFreePlay
                      ? "mobile-css-carousel__pack is-owned-free-play"
                      : "mobile-css-carousel__pack"
                  }
                >
                  {item.posterArtBase ? (
                    <picture className="mobile-css-carousel__poster-art">
                      <source
                        type="image/jxl"
                        srcSet={`${item.posterArtBase}.jxl 1x, ${item.posterArtBase}@2x.jxl 2x`}
                      />
                      <source
                        type="image/webp"
                        srcSet={`${item.posterArtBase}.webp 1x, ${item.posterArtBase}@2x.webp 2x`}
                      />
                      <img
                        className="mobile-css-carousel__poster"
                        src={`${item.posterArtBase}.webp`}
                        srcSet={`${item.posterArtBase}.webp 1x, ${item.posterArtBase}@2x.webp 2x`}
                        alt=""
                        width={242}
                        height={300}
                        draggable={false}
                        decoding="async"
                        loading={near ? "eager" : "lazy"}
                        onLoad={() => {
                          const swiper = swiperRef.current;
                          if (swiper) markReady(swiper);
                        }}
                      />
                    </picture>
                  ) : item.posterUrl ? (
                    <img
                      className="mobile-css-carousel__poster"
                      src={item.posterUrl}
                      alt=""
                      draggable={false}
                      decoding="async"
                      loading={near ? "eager" : "lazy"}
                      onLoad={() => {
                        const swiper = swiperRef.current;
                        if (swiper) markReady(swiper);
                      }}
                    />
                  ) : null}
                  {flat && (slideCta === "view" || slideCta === "play") ? (
                    <div className="mobile-css-carousel__glass-plate">
                      <CtaButton
                        forceCss
                        cssTone="black"
                        fillParent
                        type="button"
                        label={slideCta === "play" ? "Play" : "View Theme"}
                        costAmount={null}
                        labelColor="#f0f0f0"
                        strokeWidth={1}
                        cornerRadius={16}
                        className="mobile-css-carousel__glass-plate-btn swiper-no-swiping"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (slideCta === "view") onViewRef.current?.(item);
                          else onSelect?.(item);
                        }}
                      />
                    </div>
                  ) : null}
                  {compact ? null : (
                    <div className="mobile-css-carousel__dim" aria-hidden="true" />
                  )}
                </div>
                {compact ? (
                  <CompactPlayButton
                    item={item}
                    onPlay={(pack) => onSelectRef.current?.(pack)}
                  />
                ) : null}
              </SwiperSlide>
            );
          })}
        </Swiper>
        <div ref={focusRef} className="mobile-css-carousel__focus is-parked">
          <video
            ref={liveVideoRef}
            className="mobile-css-carousel__video"
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
            onLoadedData={() => {
              if (parkedRef.current) return;
              focusRef.current?.classList.add("is-ready");
              syncLiveClass();
              const swiper = swiperRef.current;
              if (swiper) markReady(swiper);
            }}
          />
          {/* Flat profile: View Theme lives on each pack plate, not the focus HUD. */}
          {compact || flat ? null : items[activeIndex] ? (
            <PackSlideHud
              key={items[activeIndex].id}
              item={items[activeIndex]}
              active={hudActive}
              pocketed={isPackInCart(
                items[activeIndex].id,
                items[activeIndex].characterId,
              )}
              buyConfirmOpen={buyConfirmOpen}
              buyConfirmLeaving={buyConfirmLeaving}
              buyQuantity={buyQuantity}
              confirmingAdd={confirmingAdd}
              slideCta={slideCta}
              freePlayMode={freePlayMode}
              onToggleBuyConfirm={toggleBuyConfirm}
              onCloseBuyConfirm={closeBuyConfirm}
              onConfirmBuy={confirmActiveBuy}
              onBuyQuantityChange={setBuyQuantity}
              onAddToPocket={addActiveToPocket}
              onView={(pack) => onViewRef.current?.(pack)}
              onBuyConfirmLeaveEnd={() => {
                buyConfirmLeavingRef.current = false;
                setBuyConfirmLeaving(false);
              }}
              onConfirmingAddEnd={() => setConfirmingAdd(false)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
