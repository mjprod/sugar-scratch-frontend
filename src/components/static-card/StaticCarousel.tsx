import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
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
  slotIndex?: number;
  onPlay?: () => void;
};

type StaticCarouselProps = {
  items: StaticCarouselItem[];
  theme?: MotionCardTheme;
  motionCardNumber?: number;
  motionCardTotal?: number;
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

function PhotoCardsContractIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      className="block size-[18px] shrink-0 text-white"
    >
      <path
        fill="currentColor"
        d="M13.69,2.25H4.31c-1.14,0-2.06.92-2.06,2.06v9.38c0,1.14.92,2.06,2.06,2.06h9.38c1.14,0,2.06-.92,2.06-2.06V4.31c0-1.14-.92-2.06-2.06-2.06M4.34,10.67v-1.12h3.19c.52,0,.94.42.94.94v3.19h-1.12v-2.21l-2.42,2.42-.8-.8,2.42-2.41h-2.2ZM9.54,4.34h1.12v2.2l2.42-2.42.8.79-2.42,2.42h2.2v1.12h-3.19c-.52,0-.94-.42-.94-.94v-3.19Z"
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
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      {cards.map((item, index) => (
        <motion.div
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
        </motion.div>
      ))}
    </div>
  );
}

export function StaticCarousel({
  items,
  theme = "police",
  motionCardNumber = 1,
  motionCardTotal = 3,
  className,
}: StaticCarouselProps) {
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cards = items.slice(0, STATIC_CARD_TOTAL);
  const unlocked = cards.filter((item) => item.state === "unlocked").length;
  const total = STATIC_CARD_TOTAL;

  function openOverlay() {
    setLeaving(false);
    setExpanded(true);
  }

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
      <div className="flex w-full flex-col">
        <p className="static-carousel__title font-medium text-white">
          {THEME_LABEL[theme]} Motion Card
        </p>
        <p className="static-carousel__title font-medium text-white">
          Nº {String(motionCardNumber).padStart(2, "0")}/
          {String(motionCardTotal).padStart(2, "0")}
        </p>
      </div>

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

      <PhotoCardStrip cards={cards} />

      <motion.div
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
      </motion.div>

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
              <button
                type="button"
                className="static-carousel-overlay__close"
                aria-label="Close photo cards"
                onClick={closeOverlay}
              >
                <X className="size-5" />
              </button>
              <div
                className="static-carousel-overlay__panel static-carousel static-carousel--expanded"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex w-full justify-end">
                  <button
                    type="button"
                    className="static-carousel__expand"
                    aria-label="Close photo cards"
                    onClick={closeOverlay}
                  >
                    <PhotoCardsContractIcon />
                  </button>
                </div>
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1">
                    <PhotoCardsIcon />
                    <p className="static-carousel__title font-medium text-white">
                      Photo Cards
                    </p>
                  </div>
                  <p className="static-carousel__title font-medium text-white">
                    {unlocked}/{total}
                  </p>
                </div>
                <PhotoCardStrip cards={cards} animate={false} />
                <StaticCardMeter
                  includeMotionTick={false}
                  staticTotal={total}
                  collectedIndexes={cards.flatMap((item, index) =>
                    item.state === "unlocked" ? [index] : [],
                  )}
                  className="h-[0.25rem] w-full"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
