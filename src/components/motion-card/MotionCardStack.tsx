import { motion } from "framer-motion";
import {
  MotionCard,
  type MotionCardProps,
  type MotionCardState,
} from "@/components/motion-card/MotionCard";
import { StaticCardMeter } from "@/components/motion-card/StaticCardMeter";

type MotionCardStackProps = MotionCardProps & {
  staticTotal?: number;
  collectedIndexes?: number[];
  hideMeter?: boolean;
};

function motionUnlocked(state: MotionCardState | undefined) {
  return (state ?? "locked-unselected").startsWith("unlocked");
}

/**
 * Motion tile plus the Figma 229:3123 static-card meter underneath.
 */
export function MotionCardStack({
  staticTotal = 10,
  collectedIndexes = [],
  hideMeter = false,
  className,
  ...cardProps
}: MotionCardStackProps) {
  return (
    <div
      className={["flex h-full w-full flex-col items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <MotionCard {...cardProps} />
      <motion.div
        initial={false}
        animate={{
          opacity: hideMeter ? 0 : 1,
          y: hideMeter ? 8 : 0,
        }}
        transition={{
          duration: 0.72,
          delay: hideMeter ? 0.15 : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <StaticCardMeter
          motionUnlocked={motionUnlocked(cardProps.state)}
          staticTotal={staticTotal}
          collectedIndexes={collectedIndexes}
        />
      </motion.div>
    </div>
  );
}
