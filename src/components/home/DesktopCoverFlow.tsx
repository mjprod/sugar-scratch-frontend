import { useState } from "react";
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
  packsY: -1.0,
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
  /** Juliana A/B: legacy HUD confirm path. */
  confirmBuy?: boolean;
  /** When true, stage uses influencer API image backdrop (cover/swipe poster). */
  influencerBackdrop?: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onFocusChange: (item: Iteration | null) => void;
  onBuy: (item: Iteration, quantity?: number) => void;
  onAddToPocket?: (
    item: Iteration,
    quantity?: number,
    options?: { allowDuplicates?: boolean },
  ) => void;
};

function backdropUrlForItem(item: Iteration | null | undefined) {
  return (
    item?.backgroundImageUrl?.trim() ||
    item?.posterUrl?.trim() ||
    ""
  );
}

export function DesktopCoverFlow({
  items,
  selectedId,
  glow,
  buying,
  addedToPocket,
  cameraSettings,
  showCenterGuide = false,
  confirmBuy = true,
  influencerBackdrop = false,
  onSelect,
  onDeselect,
  onFocusChange,
  onBuy,
  onAddToPocket,
}: HomeCoverFlowViewProps) {
  const [focusedId, setFocusedId] = useState<string | null>(
    selectedId ?? items[0]?.id ?? null,
  );
  const focusKey = selectedId ?? focusedId;
  const focusedItem =
    items.find((item) => item.id === focusKey) ?? items[0] ?? null;
  const backdropUrl = influencerBackdrop
    ? backdropUrlForItem(focusedItem)
    : "";

  return (
    <div
      className={[
        "home-featured-coverflow",
        influencerBackdrop ? "has-influencer-backdrop" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-coverflow="desktop"
      style={{
        ["--overlay-gradient-color-end" as string]: glow,
        ...(backdropUrl
          ? { ["--influencer-backdrop-url" as string]: `url("${backdropUrl}")` }
          : null),
      }}
    >
      <div className="stage-packs">
        {influencerBackdrop ? (
          <div className="packs-influencer-backdrop" aria-hidden="true">
            {backdropUrl ? (
              <img
                className="packs-influencer-backdrop__img"
                src={backdropUrl}
                alt=""
                draggable={false}
              />
            ) : null}
            <div className="packs-influencer-backdrop__scrim" />
          </div>
        ) : (
          <div
            className="packs-glow-stack packs-glow-stack--base"
            aria-hidden="true"
          >
            <div className="packs-circle packs-circle--bloom" />
            <div className="packs-circle packs-circle--core" />
          </div>
        )}
        <CoverFlowCarousel
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onDeselect={onDeselect}
          cameraSettings={cameraSettings ?? HOME_COVERFLOW_CAMERA}
          onFocusChange={(item) => {
            setFocusedId(item?.id ?? null);
            onFocusChange(item);
          }}
          formatPrice={(price) => String(Math.round(price))}
          disableSwipeDownDeactivate
          disableWheelPaging
          buyLabel="Buy Pack"
          confirmBuy={confirmBuy}
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
