import {
  MotionCardStack,
} from "@/components/motion-card/MotionCardStack";
import type {
  MotionCardState,
  MotionCardTheme,
} from "@/components/motion-card/MotionCard";

export type ThreeMotionItem = {
  id: string;
  state?: MotionCardState;
  theme?: MotionCardTheme;
  posterUrl: string;
  videoUrl?: string;
  playCost?: number;
  freePlay?: boolean;
  staticTotal?: number;
  collectedIndexes?: number[];
  photos?: import("@/components/static-card/StaticCarousel").StaticCarouselItem[];
  onBuy?: () => void;
  onPlay?: () => void;
};

type ThreeMotionProps = {
  items: ThreeMotionItem[];
  selectedId?: string | null;
  onSelect?: (id: string, next: MotionCardState) => void;
  className?: string;
};

/**
 * Figma 229:2546 — three 108px motion stacks in a 335px row.
 */
export function ThreeMotion({
  items,
  selectedId,
  onSelect,
  className,
}: ThreeMotionProps) {
  return (
    <div
      className={[
        "flex w-[335px] items-start justify-between",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.slice(0, 3).map((item) => (
        <MotionCardStack
          key={item.id}
          state={item.state}
          theme={item.theme}
          posterUrl={item.posterUrl}
          videoUrl={item.videoUrl}
          playCost={item.playCost}
          freePlay={item.freePlay}
          staticTotal={item.staticTotal}
          collectedIndexes={item.collectedIndexes}
          onBuy={item.onBuy}
          onPlay={item.onPlay}
          onSelect={
            onSelect
              ? (next: MotionCardState) => onSelect(item.id, next)
              : undefined
          }
          className={
            selectedId && selectedId !== item.id ? "opacity-95" : undefined
          }
        />
      ))}
    </div>
  );
}
