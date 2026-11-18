import type { HomeCoverFlowViewProps } from "@/components/home/DesktopCoverFlow";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";

export function MobileCoverFlow({
  items,
  selectedId,
  buying,
  influencerBackdrop = false,
  slideCta = "buy",
  flat = false,
  stageBackdropBase,
  stageBackdropSrc,
  stageBackdropSrc2x,
  stageBackdropLabel,
  onSelect,
  onDeselect,
  onFocusChange,
  onBuy,
  onAddToPocket,
  onView,
  onReady,
}: HomeCoverFlowViewProps & { onReady?: () => void }) {
  return (
    <div
      className={[
        "home-featured-coverflow",
        influencerBackdrop ? "has-influencer-backdrop" : "",
        flat ? "is-flat" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-coverflow={flat ? "mobile-flat" : "mobile-swiper"}
    >
      <MobileCssCarousel
        items={items}
        selectedId={selectedId}
        buyDisabled={buying}
        influencerBackdrop={influencerBackdrop}
        slideCta={slideCta}
        flat={flat}
        stageBackdropBase={stageBackdropBase}
        stageBackdropSrc={stageBackdropSrc}
        stageBackdropSrc2x={stageBackdropSrc2x}
        stageBackdropLabel={stageBackdropLabel}
        onReady={onReady}
        onBuy={onBuy}
        onAddToPocket={onAddToPocket}
        onView={onView}
        onFocusChange={(item) => {
          if (item) onSelect(item.id);
          else onDeselect();
          onFocusChange(item);
        }}
      />
    </div>
  );
}
