import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, X } from "lucide-react";
import { EffectCoverflow } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper/types";
import {
  CtaButton,
  ctaButtonPropsFromTemplate,
} from "@/shared/ui/cta";
import {
  addPackToCart,
  isPackInCart,
  subscribeCart,
} from "@/services/cart";
import { formatPackPrice, type Iteration } from "@/features/packs/types";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "@/features/packs/packs.css";
import "./MobileCssCarousel.css";

const BUY_PACK_CTA_SIZE_MOBILE = {
  width: 176,
  height: 42,
  fontSize: 13,
  strokeWidth: 2,
};

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
  confirmingAdd,
  onToggleBuyConfirm,
  onCloseBuyConfirm,
  onConfirmBuy,
  onAddToPocket,
  onBuyConfirmLeaveEnd,
  onConfirmingAddEnd,
}: {
  item: Iteration;
  active: boolean;
  pocketed: boolean;
  buyConfirmOpen: boolean;
  buyConfirmLeaving: boolean;
  confirmingAdd: boolean;
  onToggleBuyConfirm: () => void;
  onCloseBuyConfirm: () => void;
  onConfirmBuy: () => void;
  onAddToPocket: () => void;
  onBuyConfirmLeaveEnd: () => void;
  onConfirmingAddEnd: () => void;
}) {
  // Mount hidden, then flip is-visible after paint so CSS entrance transitions run.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!active) {
      setRevealed(false);
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
          <CtaButton
            {...ctaButtonPropsFromTemplate("hexGoldCTA")}
            {...BUY_PACK_CTA_SIZE_MOBILE}
            auroraPaused
            glowAlwaysOn={false}
            glowOrbitSpeed={0}
            glowOuterBloom="off"
            costIconAnimated={false}
            label="Buy Pack"
            costAmount={formatPackPrice(item.price ?? 4.99)}
            className="coverflow-buy-pack-cta__button"
            tabIndex={revealed ? 0 : -1}
            aria-expanded={buyConfirmOpen || buyConfirmLeaving}
            aria-controls={`coverflow-buy-confirm-${item.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleBuyConfirm();
            }}
          />
          {buyConfirmOpen || buyConfirmLeaving ? (
            <div
              id={`coverflow-buy-confirm-${item.id}`}
              className={`coverflow-cart-remove-confirm coverflow-buy-confirm${
                buyConfirmLeaving ? " is-leaving" : ""
              }`}
              role="dialog"
              aria-label="Buy pack?"
              aria-modal="false"
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.animationName !== "coverflow-confirm-leave") return;
                onBuyConfirmLeaveEnd();
              }}
            >
              <p className="coverflow-cart-remove-confirm__label">Buy</p>
              <div className="coverflow-cart-remove-confirm__actions">
                <button
                  type="button"
                  className="coverflow-cart-remove-confirm__btn is-cancel"
                  aria-label="Cancel buy"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseBuyConfirm();
                  }}
                >
                  <X aria-hidden="true" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="coverflow-cart-remove-confirm__btn is-confirm"
                  aria-label="Confirm buy"
                  onClick={(event) => {
                    event.stopPropagation();
                    onConfirmBuy();
                  }}
                >
                  <Check aria-hidden="true" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="coverflow-add-to-pocket"
          tabIndex={revealed ? 0 : -1}
          disabled={pocketed}
          aria-disabled={pocketed || undefined}
          aria-label={pocketed ? "Already in Pack Pocket" : "Add to Pocket"}
          onClick={(event) => {
            event.stopPropagation();
            onAddToPocket();
          }}
        >
          <PackPocketIcon className="coverflow-add-to-pocket__icon" />
          <span className="coverflow-add-to-pocket__label">
            {pocketed ? "In Pocket" : "Add to Pocket"}
          </span>
        </button>
      </div>
    </div>
  );
}

function PackPocketIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <path d="M4.8 3h14.4c.477 0 .935.199 1.273.553S21 4.388 21 4.89v6.667c0 2.504-.948 4.907-2.636 6.678S14.387 21 12 21a8.6 8.6 0 0 1-3.444-.719a9 9 0 0 1-2.92-2.047C3.948 16.463 3 14.06 3 11.556V4.889c0-.501.19-.982.527-1.336A1.76 1.76 0 0 1 4.8 3" />
        <path d="M12 7.75v6.5" />
        <path d="M8.75 11h6.5" />
      </g>
    </svg>
  );
}

/**
 * One live decoder only: the focused slide.
 * Neighbors stay on posters — strongest iOS page-memory win.
 * (Keep helper takes prev for call-site symmetry if we raise the limit later.)
 */
function nextVideoKeep(_prevKeep: number[], nextActive: number): number[] {
  return Number.isFinite(nextActive) ? [nextActive] : [];
}

/**
 * Active-slide pack video. Mounted only while this index is the sole keep slot.
 *
 * src discard rules (iOS + React Strict Mode):
 * - Never blank src while the node may remount with the same props (Strict Mode
 *   cleanup→remount): React will not re-apply an unchanged src prop.
 * - On real leave-keep-set unmount, pause immediately, then blank src only after
 *   a macrotask if the element is still disconnected (definitely discarded).
 */
function PackFaceVideo({
  src,
  poster,
  onReady,
}: {
  src: string;
  poster?: string;
  onReady?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    // Re-attach if a deferred discard won a race (should be rare).
    if (video.getAttribute("src") !== src) {
      video.src = src;
    }

    let cancelled = false;
    const play = () => {
      if (cancelled || videoRef.current !== video) return;
      video.muted = true;
      void video.play().catch(() => {});
    };

    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);
    play();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
      video.pause();

      // Hard discard only once the node is truly gone (not Strict Mode bounce).
      const el = video;
      window.setTimeout(() => {
        if (el.isConnected) return;
        if (!el.getAttribute("src") && !el.currentSrc) return;
        el.removeAttribute("src");
        try {
          el.load();
        } catch {
          /* ignore */
        }
      }, 0);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="mobile-css-carousel__video is-active"
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      onLoadedData={() => {
        onReady?.();
        const video = videoRef.current;
        if (!video) return;
        video.muted = true;
        void video.play().catch(() => {});
      }}
    />
  );
}

export function MobileCssCarousel({
  items,
  onReady,
}: {
  items: Iteration[];
  onReady?: () => void;
}) {
  const swiperRef = useRef<SwiperClass | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  const readySent = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  /** Live decoder slots. Active-only while visible; emptied on background. */
  const [videoKeep, setVideoKeep] = useState<number[]>(() => [0]);
  const videoKeepRef = useRef<number[]>([0]);
  const pageVisibleRef = useRef(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [pocketTick, setPocketTick] = useState(0);
  const [buyConfirmOpen, setBuyConfirmOpen] = useState(false);
  const [buyConfirmLeaving, setBuyConfirmLeaving] = useState(false);
  const [confirmingAdd, setConfirmingAdd] = useState(false);
  const buyConfirmOpenRef = useRef(false);
  const buyConfirmLeavingRef = useRef(false);
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
  const activeItem = items[activeIndex];
  activeIndexRef.current = activeIndex;
  buyConfirmOpenRef.current = buyConfirmOpen;
  buyConfirmLeavingRef.current = buyConfirmLeaving;
  glowPhaseRef.current = glowPhase;
  baseGlowRef.current = baseGlow;
  nextGlowRef.current = nextGlow;

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
    [clearGlowTimers, snapGlow],
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
    if (buyConfirmOpenRef.current || buyConfirmLeavingRef.current) return;
    buyConfirmLeavingRef.current = false;
    buyConfirmOpenRef.current = true;
    setBuyConfirmLeaving(false);
    setBuyConfirmOpen(true);
  }

  function toggleBuyConfirm() {
    if (buyConfirmOpenRef.current) closeBuyConfirm();
    else openBuyConfirm();
  }

  function addActiveToPocket() {
    if (!activeItem) return;
    if (isPackInCart(activeItem.id, activeItem.characterId)) return;
    if (!prefersReducedMotion()) setConfirmingAdd(true);
    addPackToCart({
      packId: activeItem.id,
      packName: activeItem.packName || activeItem.name,
      creator: activeItem.girlName,
      characterId: activeItem.characterId,
      price: activeItem.price,
      videoUrl: activeItem.videoUrl,
      packNumber: activeItem.packNumber,
      flagEmoji: activeItem.flagEmoji,
      flagSvgUrl: activeItem.flagSvgUrl,
      city: activeItem.city,
      country: activeItem.country,
      overlayColorStart: activeItem.overlayColorStart,
      overlayColorEnd: activeItem.overlayColorEnd,
      backgroundColor: activeItem.backgroundColor,
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
      // Matches prior brightness(1 - 0.5 * eased) via a black dim overlay.
      slide.style.setProperty("--slide-dim", String(0.5 * eased));
    });
  }, []);

  const applyKeep = useCallback((keep: number[]) => {
    videoKeepRef.current = keep;
    setVideoKeep(keep);
  }, []);

  const syncPlayback = useCallback(
    (next: number) => {
      activeIndexRef.current = next;
      setActiveIndex(next);
      // Background: no decoder at all. Foreground: active slide only.
      applyKeep(
        pageVisibleRef.current ? nextVideoKeep(videoKeepRef.current, next) : [],
      );
      buyConfirmOpenRef.current = false;
      buyConfirmLeavingRef.current = false;
      setBuyConfirmOpen(false);
      setBuyConfirmLeaving(false);
      fadeGlowTo(glowColorForItem(items[next]));
    },
    [applyKeep, fadeGlowTo, items],
  );

  useEffect(() => {
    return () => clearGlowTimers();
  }, [clearGlowTimers]);

  // Catalog swap / first paint — snap to the focused pack color + reset decoder set.
  useEffect(() => {
    readySent.current = false;
    setActiveIndex(0);
    applyKeep(pageVisibleRef.current ? [0] : []);
    snapGlow(glowColorForItem(items[0]));
  }, [applyKeep, items, snapGlow]);

  // Tab hide / bfcache: drop the only decoder so iOS can reclaim page memory.
  useEffect(() => {
    function releaseDecoders() {
      pageVisibleRef.current = false;
      applyKeep([]);
    }

    function restoreDecoders() {
      pageVisibleRef.current = true;
      applyKeep(nextVideoKeep([], activeIndexRef.current));
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
    };
  }, [applyKeep]);

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
    syncPlayback(swiper.activeIndex);
    applySlideDim(swiper);
    swiper.update();
    applySlideDim(swiper);
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
  }, [activeIndex, items, markReady, videoKeep]);

  useEffect(() => subscribeCart(() => setPocketTick((n) => n + 1)), []);

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
    const timeout = window.setTimeout(() => setConfirmingAdd(false), 580);
    return () => window.clearTimeout(timeout);
  }, [confirmingAdd]);

  // Coverflow 3D transforms break hit-testing; keep CTAs inside slides visually
  // and resolve taps by screen rect on the shell. Skip when the event already
  // landed on a real control — otherwise pointerup + click both toggle and the
  // confirm dialog open animation loops (open then immediate leave).
  function handleShellPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const origin = event.target;
    if (
      origin instanceof Element &&
      origin.closest(
        ".cta-button, .coverflow-buy-pack-cta__button, .coverflow-add-to-pocket, .coverflow-buy-confirm, .coverflow-cart-remove-confirm",
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
      ".coverflow-buy-confirm .is-confirm, .coverflow-buy-confirm .is-cancel, .coverflow-buy-pack-cta__button, .coverflow-add-to-pocket",
    );
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      event.preventDefault();
      event.stopPropagation();
      if (el.classList.contains("is-confirm") || el.classList.contains("is-cancel")) {
        closeBuyConfirm();
        return;
      }
      if (el.classList.contains("coverflow-buy-pack-cta__button")) {
        toggleBuyConfirm();
        return;
      }
      if (el.classList.contains("coverflow-add-to-pocket")) {
        addActiveToPocket();
        return;
      }
    }
  }

  const stageGlowClass =
    glowPhase === "prep"
      ? " is-glow-prep"
      : glowPhase === "fading"
        ? " is-glow-fading"
        : "";

  return (
    <div className={`stage-packs mobile-css-carousel-stage${stageGlowClass}`}>
      <PackGlowStacks baseColor={baseGlow} nextColor={nextGlow} />
      <div
        ref={shellRef}
        className="mobile-css-carousel-shell"
        onPointerUp={handleShellPointerUp}
      >
        <Swiper
          className="mobile-css-carousel"
          modules={[EffectCoverflow]}
          effect="coverflow"
          grabCursor
          centeredSlides
          slidesPerView="auto"
          spaceBetween={-72}
          speed={720}
          resistanceRatio={0.85}
          watchSlidesProgress
          coverflowEffect={{
            rotate: 38,
            stretch: -88,
            depth: 80,
            scale: 0.9,
            modifier: 1,
            slideShadows: false,
          }}
          onSwiper={onSwiper}
          onProgress={applySlideDim}
          onSetTranslate={(swiper) => {
            applySlideDim(swiper);
            markReady(swiper);
          }}
          onSlideChange={(swiper) => syncPlayback(swiper.activeIndex)}
          preventClicks={false}
          preventClicksPropagation={false}
          noSwipingSelector=".mobile-css-carousel__hud, .coverflow-buy-pack-cta, .coverflow-add-to-pocket, .coverflow-cart-remove-confirm, .cta-button"
        >
          {items.map((item, index) => {
            const pocketed = isPackInCart(item.id, item.characterId);
            void pocketTick;
            const isActive = index === activeIndex;
            // Mount video only for the active keep slot — poster everywhere else.
            const keepVideo =
              Boolean(item.videoUrl) && videoKeep.includes(index);
            const near = Math.abs(index - activeIndex) <= 2;
            return (
              <SwiperSlide key={item.id}>
                <div className="mobile-css-carousel__pack">
                  {item.posterUrl ? (
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
                  {keepVideo ? (
                    // key=pack id: stable for this slide's lifetime in keep-set.
                    // Unmount happens only when index leaves keep-set (or background).
                    <PackFaceVideo
                      key={item.id}
                      src={item.videoUrl}
                      poster={item.posterUrl || undefined}
                      onReady={() => {
                        const swiper = swiperRef.current;
                        if (swiper) markReady(swiper);
                      }}
                    />
                  ) : null}
                  <div className="mobile-css-carousel__dim" aria-hidden="true" />
                </div>
                {isActive ? (
                  <PackSlideHud
                    item={item}
                    active
                    pocketed={pocketed}
                    buyConfirmOpen={buyConfirmOpen}
                    buyConfirmLeaving={buyConfirmLeaving}
                    confirmingAdd={confirmingAdd}
                    onToggleBuyConfirm={toggleBuyConfirm}
                    onCloseBuyConfirm={closeBuyConfirm}
                    onConfirmBuy={closeBuyConfirm}
                    onAddToPocket={addActiveToPocket}
                    onBuyConfirmLeaveEnd={() => {
                      buyConfirmLeavingRef.current = false;
                      setBuyConfirmLeaving(false);
                    }}
                    onConfirmingAddEnd={() => setConfirmingAdd(false)}
                  />
                ) : null}
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
}
