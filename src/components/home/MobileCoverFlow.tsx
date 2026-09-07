import type { HomeCoverFlowViewProps } from "@/components/home/DesktopCoverFlow";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";

export function MobileCoverFlow({
  items,
  buying,
  onSelect,
  onDeselect,
  onFocusChange,
  onBuy,
  onAddToPocket,
  onReady,
}: HomeCoverFlowViewProps & { onReady?: () => void }) {
  return (
    <div className="home-featured-coverflow" data-coverflow="mobile-swiper">
      <MobileCssCarousel
        items={items}
        buyDisabled={buying}
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
