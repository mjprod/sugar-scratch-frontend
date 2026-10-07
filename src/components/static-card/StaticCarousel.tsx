import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

const DRAG_THRESHOLD = 4;
const CARD_STEP = 59;
const STATIC_CARD_TOTAL = 10;
const GLASS_ARROW =
  "explore-creators-arrow glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface";

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
 * Horizontal drag carousel of static photo holders.
 * Viewport fits three 51px holders with 8px gaps (169px).
 */
export function StaticCarousel({
  items,
  theme = "police",
  motionCardNumber = 1,
  motionCardTotal = 3,
  className,
}: StaticCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    lastX: number;
    lastT: number;
    velocity: number;
  } | null>(null);
  const holdRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const cards = items.slice(0, STATIC_CARD_TOTAL);
  const unlocked = cards.filter((item) => item.state === "unlocked").length;
  const total = STATIC_CARD_TOTAL;

  const updateScrollButtons = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 2);
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollButtons();
  }, [items, updateScrollButtons]);

  function scrollByCard(direction: -1 | 1, smooth = true) {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * CARD_STEP,
      behavior: smooth ? "smooth" : "auto",
    });
    updateScrollButtons();
  }

  function stopHold() {
    if (holdRef.current != null) {
      window.clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }

  function startHold(direction: -1 | 1) {
    stopHold();
    scrollByCard(direction);
    holdRef.current = window.setInterval(() => {
      const node = scrollerRef.current;
      if (!node) {
        stopHold();
        return;
      }
      const atStart = node.scrollLeft <= 2;
      const atEnd =
        node.scrollLeft + node.clientWidth >= node.scrollWidth - 2;
      if ((direction < 0 && atStart) || (direction > 0 && atEnd)) {
        stopHold();
        updateScrollButtons();
        return;
      }
      const nodeNow = scrollerRef.current;
      if (!nodeNow) return;
      nodeNow.scrollBy({ left: direction * 12, behavior: "auto" });
      updateScrollButtons();
    }, 16);
  }

  useEffect(() => stopHold, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const node = scrollerRef.current;
    if (!node) return;
    drag.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastT: performance.now(),
      velocity: 0,
    };
    node.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = scrollerRef.current;
    const session = drag.current;
    if (!node || !session || session.pointerId !== event.pointerId) return;
    const now = performance.now();
    const delta = event.clientX - session.lastX;
    const dt = Math.max(1, now - session.lastT);
    node.scrollLeft -= delta;
    session.velocity = delta / dt;
    session.lastX = event.clientX;
    session.lastT = now;
    updateScrollButtons();
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const node = scrollerRef.current;
    const session = drag.current;
    if (!node || !session || session.pointerId !== event.pointerId) return;
    const leftover = -session.velocity * 180;
    if (Math.abs(leftover) > DRAG_THRESHOLD) {
      node.scrollBy({ left: leftover, behavior: "smooth" });
    }
    drag.current = null;
    updateScrollButtons();
  }

  return (
    <div
      className={["flex w-[169px] flex-col gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex w-full flex-col">
        <p className="font-medium text-[14px] tracking-[0.28px] text-white">
          {THEME_LABEL[theme]} Motion Card
        </p>
        <p className="font-medium text-[14px] tracking-[0.28px] text-white">
          Nº {String(motionCardNumber).padStart(2, "0")}/
          {String(motionCardTotal).padStart(2, "0")}
        </p>
      </div>

      <div className="flex h-2.5 w-full items-center justify-between">
          <div className="flex items-center gap-1">
          <PhotoCardsIcon />
          <p className="whitespace-nowrap font-medium text-[8px] tracking-[0.16px] text-white">
            {THEME_LABEL[theme]} Nº {String(motionCardNumber).padStart(2, "0")}{" "}
            Photo Cards
          </p>
        </div>
        <p className="whitespace-nowrap font-medium text-[8px] tracking-[0.16px] text-right text-white">
          {unlocked}/{total}
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="flex w-full cursor-grab touch-pan-y items-start gap-2 overflow-x-auto select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onScroll={updateScrollButtons}
      >
        {cards.map((item, index) => (
          <motion.div
            key={item.id}
            className="w-[51px] shrink-0"
            initial={{ opacity: 0, x: -16 }}
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
              onPlay={item.onPlay}
            />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.72, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
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

      <div className="static-carousel-arrows flex w-full items-center justify-between">
        <button
          type="button"
          className={`${GLASS_ARROW} is-prev !flex`}
          aria-label="Previous photo cards"
          disabled={!canScrollLeft}
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${GLASS_ARROW} is-next !flex`}
          aria-label="Next photo cards"
          disabled={!canScrollRight}
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
