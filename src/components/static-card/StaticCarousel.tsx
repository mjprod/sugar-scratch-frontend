import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { m } from "framer-motion";
import { X } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { PHOTO_SCRATCH_TEXT_SRC, PhotoCountBadge } from "@/components/photo-gateway/PhotoGateway";
import { lottieRenderConfig } from "@/utils/lottieRender";
import {
  StaticCardHolder,
  type StaticCardHolderState,
} from "@/components/static-card/StaticCardHolder";
import type { MotionCardTheme } from "@/components/motion-card/MotionCard";
import { StaticCardMeter } from "@/components/motion-card/StaticCardMeter";

export type StaticCarouselItem = {
  id: string;
  state?: StaticCardHolderState;
  backgroundUrl: string;
  topLayerUrl?: string;
  playCost?: number;
  freePlay?: boolean;
  freePlayable?: boolean;
  slotIndex?: number;
  onPlay?: () => void;
};

type StaticCarouselProps = {
  items: StaticCarouselItem[];
  theme?: MotionCardTheme;
  motionCardNumber?: number;
  motionCardTotal?: number;
  /** Increment to open the photo-card overlay from outside the carousel. */
  openSignal?: number;
  onExpandedChange?: (open: boolean) => void;
  /** Overlay-only mount: skip the inline strip. */
  overlayOnly?: boolean;
  className?: string;
};

const THEME_LABEL: Record<MotionCardTheme, string> = {
  police: "Police",
  nurse: "Nurse",
  fire: "Fire",
  gym: "Gym",
  teacher: "Teacher",
};

const STATIC_CARD_TOTAL = 10;
const REVEAL_STAGGER_MS = 80;

function PhotoCardsExpandIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="block size-[18px] shrink-0 text-white"
    >
      <path
        fill="currentColor"
        d="M18.25 3H5.75A2.755 2.755 0 0 0 3 5.75v12.5A2.755 2.755 0 0 0 5.75 21h12.5A2.755 2.755 0 0 0 21 18.25V5.75A2.755 2.755 0 0 0 18.25 3M11 17v1.5H6.75c-.69 0-1.25-.56-1.25-1.25V13H7v2.94l3.22-3.22l1.06 1.06L8.06 17zm7.5-6H17V8.06l-3.22 3.22l-1.06-1.06L15.94 7H13V5.5h4.25c.69 0 1.25.56 1.25 1.25z"
      />
    </svg>
  );
}

function PhotoCardsIcon() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="8"
      viewBox="0 0 11 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block h-2 w-[11px] shrink-0"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.55 0H10.45C10.7538 0 11 0.17908 11 0.4V7.6C11 7.82092 10.7538 8 10.45 8H0.55C0.246235 8 0 7.82092 0 7.6V0.4C0 0.17908 0.246235 0 0.55 0ZM1.1 6L3.4611 4.28284C3.67587 4.12664 4.02413 4.12664 4.23891 4.28284L6.05 5.6L7.86841 4.60816C8.08737 4.48872 8.39377 4.50456 8.58732 4.64532L9.9 5.6V6.8C9.9 7.02092 9.65377 7.2 9.35 7.2H1.65C1.34624 7.2 1.1 7.02092 1.1 6.8V6ZM4.125 2.2C4.125 1.86864 3.75562 1.6 3.3 1.6C2.84438 1.6 2.475 1.86864 2.475 2.2C2.475 2.53136 2.84438 2.8 3.3 2.8C3.75562 2.8 4.125 2.53136 4.125 2.2Z"
        fill="white"
        fillOpacity="0.5"
      />
    </svg>
  );
}

/**
 * Native overflow strip of static photo holders.
 * Viewport fits three 51px holders with 8px gaps (169px).
 */
function PhotoCardStrip({
  cards,
  animate = true,
}: {
  cards: StaticCarouselItem[];
  animate?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType !== "mouse") return;
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) <= 4) return;
    drag.moved = true;
    suppressClickRef.current = true;
    el.classList.add("is-dragging");
    el.scrollLeft = drag.startScroll - dx;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    el?.classList.remove("is-dragging");
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
  }

  function onClickCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      ref={scrollerRef}
      className="static-carousel__scroller flex w-full items-start gap-2 overflow-x-auto"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={(event) => {
        suppressClickRef.current = false;
        endDrag(event);
      }}
      onClickCapture={onClickCapture}
    >
      {cards.map((item, index) => (
        <m.div
          key={item.id}
          className="static-carousel__item shrink-0"
          initial={animate ? { opacity: 0, x: -16 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.72,
            delay: 0.12 + Math.min(index, 2) * 0.12,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <StaticCardHolder
            state={item.state}
            backgroundUrl={item.backgroundUrl}
            topLayerUrl={item.topLayerUrl}
            playCost={item.playCost}
            freePlay={item.freePlay}
            onPlay={item.onPlay}
          />
        </m.div>
      ))}
    </div>
  );
}

export function StaticCarousel({
  items,
  theme = "police",
  motionCardNumber = 1,
  motionCardTotal = 3,
  openSignal = 0,
  onExpandedChange,
  overlayOnly = false,
  className,
}: StaticCarouselProps) {
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const cards = items.slice(0, STATIC_CARD_TOTAL);
  const unlocked = cards.filter((item) => item.state === "unlocked").length;
  const total = cards.length;

  function openOverlay() {
    setLeaving(false);
    setRevealed(false);
    setExpanded(true);
  }

  useEffect(() => {
    if (!expanded) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRevealed(true);
      return;
    }
    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => setRevealed(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!expanded || !grid) return;
    const update = () => {
      setCanScrollDown(grid.scrollHeight - grid.scrollTop - grid.clientHeight > 8);
    };
    update();
    grid.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => {
      grid.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [expanded, cards.length]);

  const lastOpenSignal = useRef(0);
  useEffect(() => {
    if (openSignal === lastOpenSignal.current) return;
    lastOpenSignal.current = openSignal;
    if (openSignal > 0) openOverlay();
  }, [openSignal]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  function closeOverlay() {
    if (!expanded || leaving) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setExpanded(false);
      setLeaving(false);
      return;
    }
    setLeaving(true);
  }

  function finishClose() {
    setExpanded(false);
    setLeaving(false);
  }

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      closeOverlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, leaving]);

  return (
    <div
      className={[
        "static-carousel flex w-full flex-col gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {overlayOnly ? null : (
      <div className="flex w-full flex-col">
        <p className="static-carousel__title font-medium text-white">
          {THEME_LABEL[theme]} Motion Card
        </p>
        <p className="static-carousel__title font-medium text-white">
          Nº {String(motionCardNumber).padStart(2, "0")}/
          {String(motionCardTotal).padStart(2, "0")}
        </p>
      </div>
      )}

      {overlayOnly ? null : (
      <div className="flex h-4 w-full items-center justify-between">
          <div className="flex items-center gap-1">
          <PhotoCardsIcon />
          <p className="static-carousel__meta whitespace-nowrap font-medium text-white">
            Photo Cards
          </p>
        </div>
        <div className="flex items-center gap-1">
          <p className="static-carousel__meta whitespace-nowrap font-medium text-right text-white">
            {unlocked}/{total}
          </p>
          <button
            type="button"
            className="static-carousel__expand"
            aria-label="Open photo cards"
            onClick={openOverlay}
          >
            <PhotoCardsExpandIcon />
          </button>
        </div>
      </div>
      )}

      {overlayOnly || expanded ? null : <PhotoCardStrip cards={cards} />}

      {overlayOnly ? null : (
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.72, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <StaticCardMeter
          includeMotionTick={false}
          staticTotal={total}
          collectedIndexes={cards.flatMap((item, index) =>
            item.state === "unlocked" ? [index] : [],
          )}
          className="h-[0.25rem] w-full"
        />
      </m.div>
      )}

      {expanded && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`static-carousel-overlay${leaving ? " is-leaving" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label="Photo Cards"
              onClick={closeOverlay}
              onAnimationEnd={(event) => {
                if (!leaving) return;
                if (event.target !== event.currentTarget) return;
                if (event.animationName !== "static-carousel-overlay-fade-out") {
                  return;
                }
                finishClose();
              }}
            >
              <div
                className="static-carousel-overlay__panel static-carousel static-carousel--expanded"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="static-carousel__head">
                  <div className="static-carousel__logo" aria-hidden="true">
                    <DotLottieReact
                      src={PHOTO_SCRATCH_TEXT_SRC}
                      autoplay
                      loop={false}
                      renderConfig={lottieRenderConfig()}
                    />
                  </div>
                  <div className="static-carousel__meta-row flex min-w-0 flex-1 items-center gap-1">
                    <PhotoCardsIcon />
                    <p className="static-carousel__title min-w-0 font-medium text-white">
                      {THEME_LABEL[theme]}{" "}
                      {String(motionCardNumber).padStart(2, "0")} // Photo Cards
                    </p>
                  </div>
                  <div className="static-carousel__actions flex min-w-0 flex-1 items-center justify-end gap-2">
                    <PhotoCountBadge collected={unlocked} total={total} />
                    <button
                      type="button"
                      className="static-carousel__close"
                      aria-label="Close photo cards"
                      onClick={closeOverlay}
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>
                <StaticCardMeter
                  includeMotionTick={false}
                  staticTotal={total}
                  collectedIndexes={cards.flatMap((item, index) =>
                    item.state === "unlocked" ? [index] : [],
                  )}
                  className="h-[0.25rem] w-full shrink-0"
                />
                <div
                  ref={gridRef}
                  className={`static-carousel__grid${canScrollDown ? " can-scroll-down" : ""}`}
                >
                  {cards.map((item, index) => (
                    <div
                      key={item.id}
                      className={`static-carousel__cell${revealed ? " is-ready" : ""}`}
                      style={{
                        ["--static-reveal-delay" as string]: `${index * REVEAL_STAGGER_MS}ms`,
                      }}
                    >
                      <div className="static-carousel__bone" aria-hidden="true">
                        <div className="static-carousel__bone-face" />
                        <div className="static-carousel__bone-cta" />
                      </div>
                      <div className="static-carousel__cell-real">
                        <StaticCardHolder
                          state={item.state}
                          backgroundUrl={item.backgroundUrl}
                          topLayerUrl={item.topLayerUrl}
                          playCost={item.playCost}
                          freePlay={item.freePlay}
                          onPlay={item.onPlay}
                          plainCta
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
