import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MotionCardStack,
} from "@/components/motion-card/MotionCardStack";
import type {
  MotionCardState,
} from "@/components/motion-card/MotionCard";
import type { ThreeMotionItem } from "@/components/motion-card/ThreeMotion";
import {
  StaticCarousel,
  type StaticCarouselItem,
} from "@/components/static-card/StaticCarousel";

type MotionCardHolderProps = {
  items: ThreeMotionItem[];
  photos?: StaticCarouselItem[];
  onItemSelect?: (id: string, next: MotionCardState) => void;
  className?: string;
};

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
const SHIFT = { duration: 1.04, ease: APPLE_EASE };
const DETAILS_DELAY = 0.15;
const GAP = 12;
const PANEL_GAP = 16;

function cardLeft(index: number, cardW: number) {
  return -index * (cardW + GAP);
}

function exitX(index: number, activeIndex: number, cardW: number) {
  const off = cardW + GAP;
  if (activeIndex === 1) return index === 0 ? -off * 2 : off * 2;
  if (activeIndex === 2) return -off * 2;
  return off * 2;
}

function exitDelay(index: number, activeIndex: number) {
  if (activeIndex === 2) return index * 0.08;
  const order = [0, 1, 2]
    .filter((i) => i !== activeIndex)
    .sort((a, b) => b - a);
  const place = order.indexOf(index);
  return place < 0 ? 0 : place * 0.16;
}

function enterDelay(index: number) {
  return (2 - index) * 0.16;
}

function exitDuration() {
  return SHIFT.duration;
}

/**
 * Three-up motion row that expands into Active Motion on click.
 * Unused cards slide right off-screen, staggered.
 */
export function MotionCardHolder({
  items,
  photos = [],
  onItemSelect,
  className,
}: MotionCardHolderProps) {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailsReady, setDetailsReady] = useState(false);
  const lastActiveIndex = useRef(0);
  const detailsTimer = useRef<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(108);
  const cards = items.slice(0, 3);
  const activeIndex = cards.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0;
  const activeCard = active ? cards[activeIndex] : null;
  const instant = reduceMotion ? { duration: 0 } : SHIFT;

  const openRef = useRef(false);
  openRef.current = active;

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const measure = () => {
      if (openRef.current) return;
      const el = node.children[0] as HTMLElement | undefined;
      if (el) setCardW(el.getBoundingClientRect().width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (detailsTimer.current != null) window.clearTimeout(detailsTimer.current);
    };
  }, []);

  return (
    <div
      className={[
        "motion-card-holder relative w-full",
        active ? "is-open" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        ref={rowRef}
        className="grid w-full grid-cols-3 items-start gap-3"
      >
        {cards.map((item, index) => {
          const selected = item.id === activeId;
          const shift = !active
            ? 0
            : selected
              ? cardLeft(index, cardW)
              : exitX(index, activeIndex, cardW);
          if (active) lastActiveIndex.current = activeIndex;
          const delay = active
            ? selected
              ? 0
              : exitDelay(index, activeIndex)
            : enterDelay(index);

          return (
            <motion.div
              key={item.id}
              className={[
                "motion-card-holder__slot relative z-[1] min-w-0",
                selected && active ? "motion-card-holder__selected" : "",
              ].join(" ")}
              style={{
                zIndex: selected ? 2 : 1,
                ...(selected && active ? { width: cardW } : {}),
              }}
              initial={false}
              animate={{
                x: shift,
                opacity: !active || selected ? 1 : 0,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: exitDuration(),
                      ease: APPLE_EASE,
                      delay,
                    }
              }
            >
              <MotionCardStack
                state={item.state}
                theme={item.theme}
                posterUrl={item.posterUrl}
                videoUrl={item.videoUrl}
                playCost={item.playCost}
                staticTotal={item.staticTotal}
                collectedIndexes={item.collectedIndexes}
                hideMeter={selected && detailsReady}
                onBuy={item.onBuy}
                onPlay={item.onPlay}
                onSelect={() => {
                  if (detailsTimer.current != null) {
                    window.clearTimeout(detailsTimer.current);
                    detailsTimer.current = null;
                  }
                  if (activeId !== item.id) {
                    setActiveId(item.id);
                    setDetailsReady(false);
                    const locked = (item.state ?? "").startsWith("locked");
                    if (locked) {
                      onItemSelect?.(item.id, "locked-selected");
                    }
                    detailsTimer.current = window.setTimeout(() => {
                      setDetailsReady(true);
                      if (!locked) {
                        onItemSelect?.(item.id, "unlocked-selected");
                      }
                    }, DETAILS_DELAY * 1000);
                    return;
                  }
                  setActiveId(null);
                  setDetailsReady(false);
                  onItemSelect?.(
                    item.id,
                    (item.state ?? "").startsWith("locked")
                      ? "locked-unselected-banner"
                      : "unlocked-unselected",
                  );
                }}
              />
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {active && activeCard ? (
          <motion.div
            className="motion-card-holder__panel absolute top-0 right-0 z-[3]"
            style={{
              left: cardW + PANEL_GAP,
            }}
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 16 }}
            transition={instant}
          >
            <StaticCarousel
              items={activeCard.photos?.length ? activeCard.photos : photos}
              theme={activeCard.theme}
              motionCardNumber={activeIndex + 1}
              motionCardTotal={cards.length}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
