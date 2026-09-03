import type { HomeCoverFlowViewProps } from "@/components/home/DesktopCoverFlow";
import {
  CoverFlowCarousel,
  MOBILE_COVERFLOW_CAMERA,
} from "@/features/packs/CoverFlowCarousel";

export function MobileCoverFlow({
  items,
  selectedId,
  glow,
  buying,
  addedToPocket,
  cameraSettings,
  showCenterGuide = false,
  onSelect,
  onDeselect,
  onFocusChange,
  onBuy,
  onAddToPocket,
}: HomeCoverFlowViewProps) {
  return (
    <div
      className="home-featured-coverflow"
      data-coverflow="mobile"
      style={{
        ["--overlay-gradient-color-end" as string]: glow,
      }}
    >
      <div className="stage-packs">
        <div
          className="packs-glow-stack packs-glow-stack--base"
          aria-hidden="true"
        >
          <div className="packs-circle packs-circle--bloom" />
          <div className="packs-circle packs-circle--core" />
        </div>
        <CoverFlowCarousel
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onDeselect={onDeselect}
          cameraSettings={cameraSettings ?? MOBILE_COVERFLOW_CAMERA}
          onFocusChange={onFocusChange}
          formatPrice={(price) => String(price)}
          disableSwipeDownDeactivate
          disableWheelPaging
          evictOffCenterVideo
          buyLabel="Buy Pack"
          confirmBuy
          buyDisabled={buying}
          addToPocketDisabled={addedToPocket}
          onBuy={onBuy}
          onAddToPocket={onAddToPocket}
        />
        {showCenterGuide ? (
          <div className="coverflow-center-guide" aria-hidden="true">
            <span className="coverflow-center-guide__line" />
            <span className="coverflow-center-guide__label">center</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
