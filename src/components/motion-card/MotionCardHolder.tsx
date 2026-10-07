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

const ROW_W = 335;
const CARD_W = 108;
const OFFSCREEN = ROW_W;
const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
const SHIFT = { duration: 1.04, ease: APPLE_EASE };
const DETAILS_DELAY = 0.15;

function cardLeft(index: number, count: number) {
  if (count <= 1) return 0;
  return index * ((ROW_W - CARD_W) / (count - 1));
}

function exitX(index: number, activeIndex: number) {
  if (activeIndex === 1) return index === 0 ? -OFFSCREEN : OFFSCREEN;
  if (activeIndex === 2) return -OFFSCREEN;
  return OFFSCREEN;
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

  useEffect(() => {
    return () => {
      if (detailsTimer.current != null) window.clearTimeout(detailsTimer.current);
    };
  }, []);
  const cards = items.slice(0, 3);
  const activeIndex = cards.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0;
  const activeCard = active ? cards[activeIndex] : null;
  const instant = reduceMotion ? { duration: 0 } : SHIFT;

  return (
    <div
      className={["relative w-[335px]", className].filter(Boolean).join(" ")}
    >
      <div className="flex w-full items-start justify-between">
        {cards.map((item, index) => {
          const selected = item.id === activeId;
          const shift = !active
            ? 0
            : selected
              ? -cardLeft(index, cards.length)
              : exitX(index, activeIndex);
          if (active) lastActiveIndex.current = activeIndex;
          const delay = active
            ? selected
              ? 0
              : exitDelay(index, activeIndex)
            : enterDelay(index);

          return (
            <motion.div
              key={item.id}
              className="relative z-[1] w-[108px] shrink-0"
              style={{ zIndex: selected ? 2 : 1 }}
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
            className="absolute top-0 left-[120px] z-[3]"
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 16 }}
            transition={instant}
          >
            <StaticCarousel
              items={photos}
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
