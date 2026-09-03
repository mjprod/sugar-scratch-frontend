import {
  CoverFlowCarousel,
  DEFAULT_COVERFLOW_CAMERA,
  type CoverFlowCameraSettings,
} from "@/features/packs/CoverFlowCarousel";
import type { Iteration } from "@/features/packs/types";

/** Desktop homepage hero — locked from center debug. */
export const HOME_COVERFLOW_CAMERA: CoverFlowCameraSettings = {
  ...DEFAULT_COVERFLOW_CAMERA,
  packsX: 0.015,
  packsY: -1.25,
  modelY: -0.02,
  cameraX: 0.11,
  cameraY: 0.27,
  cameraZ: 5.9,
  lookAtY: 0.1,
  fov: 36,
};

export type HomeCoverFlowViewProps = {
  items: Iteration[];
  selectedId: string | null;
  glow: string;
  buying: boolean;
  addedToPocket: boolean;
  cameraSettings?: CoverFlowCameraSettings;
  showCenterGuide?: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onFocusChange: (item: Iteration | null) => void;
  onBuy: (item: Iteration) => void;
  onAddToPocket: (item: Iteration) => void;
};

export function DesktopCoverFlow({
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
      data-coverflow="desktop"
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
          cameraSettings={cameraSettings ?? HOME_COVERFLOW_CAMERA}
          onFocusChange={onFocusChange}
          formatPrice={(price) => String(price)}
          disableSwipeDownDeactivate
          disableWheelPaging
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
