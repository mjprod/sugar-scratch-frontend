import {
  MotionCard,
  type MotionCardProps,
} from "@/components/motion-card/MotionCard";
import {
  StaticCarousel,
  type StaticCarouselItem,
} from "@/components/static-card/StaticCarousel";

type ActiveMotionProps = MotionCardProps & {
  photos?: StaticCarouselItem[];
  motionCardNumber?: number;
  motionCardTotal?: number;
};

/**
 * Two-column active motion layout: motion tile + static photo carousel.
 */
export function ActiveMotion({
  photos = [],
  motionCardNumber = 1,
  motionCardTotal = 3,
  className,
  ...cardProps
}: ActiveMotionProps) {
  return (
    <div
      className={["flex items-start gap-3", className]
        .filter(Boolean)
        .join(" ")}
    >
      <MotionCard {...cardProps} />
      <StaticCarousel
        items={photos}
        theme={cardProps.theme}
        motionCardNumber={motionCardNumber}
        motionCardTotal={motionCardTotal}
      />
    </div>
  );
}
