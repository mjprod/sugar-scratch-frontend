import {
  MotionCard,
  type MotionCardProps,
  type MotionCardState,
} from "@/components/motion-card/MotionCard";
import { StaticCardMeter } from "@/components/motion-card/StaticCardMeter";

type MotionCardStackProps = MotionCardProps & {
  staticTotal?: number;
  collectedIndexes?: number[];
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
  className,
  ...cardProps
}: MotionCardStackProps) {
  return (
    <div
      className={["flex w-[108px] flex-col items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <MotionCard {...cardProps} />
      <StaticCardMeter
        motionUnlocked={motionUnlocked(cardProps.state)}
        staticTotal={staticTotal}
        collectedIndexes={collectedIndexes}
      />
    </div>
  );
}
