import { useState } from "react";
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
const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
const SHIFT = { duration: 0.48, ease: APPLE_EASE };

function cardLeft(index: number, count: number) {
  if (count <= 1) return 0;
  return index * ((ROW_W - CARD_W) / (count - 1));
}

/**
 * Three-up motion row that expands into Active Motion on click.
 * Card 1 stays put; cards 2/3 slide to card 1's left edge.
 * Unselected cards fade to 10% opacity.
 */
export function MotionCardHolder({
  items,
  photos = [],
  onItemSelect,
  className,
}: MotionCardHolderProps) {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
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
          const shift = active && selected ? -cardLeft(index, cards.length) : 0;

          return (
            <motion.div
              key={item.id}
              className="relative z-[1] w-[108px] shrink-0"
              style={{ zIndex: selected ? 2 : 1 }}
              initial={false}
              animate={{
                x: shift,
                opacity: !active || selected ? 1 : 0.1,
              }}
              transition={instant}
            >
              <MotionCardStack
                state={item.state}
                theme={item.theme}
                posterUrl={item.posterUrl}
                videoUrl={item.videoUrl}
                playCost={item.playCost}
                staticTotal={item.staticTotal}
                collectedIndexes={item.collectedIndexes}
                hideMeter={selected}
                onBuy={item.onBuy}
                onPlay={item.onPlay}
                onSelect={() => {
                  if (activeId !== item.id) {
                    setActiveId(item.id);
                    onItemSelect?.(
                      item.id,
                      (item.state ?? "").startsWith("locked")
                        ? "locked-selected"
                        : "unlocked-selected",
                    );
                    return;
                  }
                  setActiveId(null);
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
