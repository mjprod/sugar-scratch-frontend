import type { HomeCoverFlowViewProps } from "@/components/home/DesktopCoverFlow";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";

export function MobileCoverFlow({
  items,
  selectedId,
  buying,
  influencerBackdrop = false,
  slideCta = "buy",
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
      ]
        .filter(Boolean)
        .join(" ")}
      data-coverflow="mobile-swiper"
    >
      <MobileCssCarousel
        items={items}
        selectedId={selectedId}
        buyDisabled={buying}
        influencerBackdrop={influencerBackdrop}
        slideCta={slideCta}
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
