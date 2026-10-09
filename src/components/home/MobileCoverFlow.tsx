import type { HomeCoverFlowViewProps } from "@/components/home/DesktopCoverFlow";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";

export function MobileCoverFlow({
  items,
  selectedId,
  buying,
  influencerBackdrop = false,
  onSelect,
  onDeselect,
  onFocusChange,
  onBuy,
  onAddToPocket,
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
        onReady={onReady}
        onBuy={onBuy}
        onAddToPocket={onAddToPocket}
        onFocusChange={(item) => {
          if (item) onSelect(item.id);
          else onDeselect();
          onFocusChange(item);
        }}
      />
    </div>
  );
}
