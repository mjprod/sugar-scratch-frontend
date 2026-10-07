import { motion } from "framer-motion";
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
export function StaticCarousel({
  items,
  theme = "police",
  motionCardNumber = 1,
  motionCardTotal = 3,
  className,
}: StaticCarouselProps) {
  const cards = items.slice(0, STATIC_CARD_TOTAL);
  const unlocked = cards.filter((item) => item.state === "unlocked").length;
  const total = STATIC_CARD_TOTAL;

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

      <div className="flex h-3.5 w-full items-center justify-between">
          <div className="flex items-center gap-1">
          <PhotoCardsIcon />
          <p className="static-carousel__meta whitespace-nowrap font-medium text-white">
            Photo Cards
          </p>
        </div>
        <p className="static-carousel__meta whitespace-nowrap font-medium text-right text-white">
          {unlocked}/{total}
        </p>
      </div>

      <div className="static-carousel__scroller flex w-full items-start gap-2 overflow-x-auto">
        {cards.map((item, index) => (
          <motion.div
            key={item.id}
            className="w-[62px] shrink-0"
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
              freePlay={item.freePlay}
              onPlay={item.onPlay}
            />
          </motion.div>
        ))}
      </div>

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
    </div>
  );
}
