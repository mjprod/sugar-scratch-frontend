import { useId, useRef, useState } from "react";
import { Play } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { PlayConfirm } from "@/components/static-card/PlayConfirm";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { packUnitCost } from "@/services/purchase";
import "@/components/motion-card/MotionCard.css";

export type StaticCardHolderState = "locked" | "unlocked";

type StaticCardHolderProps = {
  state?: StaticCardHolderState;
  backgroundUrl: string;
  topLayerUrl?: string;
  playCost?: number;
  freePlay?: boolean;
  onPlay?: () => void;
  className?: string;
};

const SQUIRCLE_CTA = ctaButtonPropsFromTemplate("squircleCTA");

function CenterLock() {
  const gradientId = `static-card-lock-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      width="15"
      height="20"
      viewBox="0 0 9 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block h-5 w-[15px]"
    >
      <path
        d="M1.05844 11.29C0.767367 11.29 0.518281 11.1848 0.31118 10.9744C0.10408 10.764 0.000352812 10.5108 0 10.2148V4.83857C0 4.54288 0.103727 4.28984 0.31118 4.07945C0.518634 3.86907 0.76772 3.76369 1.05844 3.76333H1.58766V2.6881C1.58766 1.94439 1.84574 1.31054 2.3619 0.786537C2.87807 0.262538 3.50202 0.00035878 4.23375 3.66975e-07C4.96548 -0.000358046 5.58961 0.261821 6.10612 0.786537C6.62264 1.31125 6.88055 1.94511 6.87984 2.6881V3.76333H7.40906C7.70013 3.76333 7.94939 3.86871 8.15685 4.07945C8.3643 4.2902 8.46785 4.54324 8.4675 4.83857V10.2148C8.4675 10.5105 8.36395 10.7637 8.15685 10.9744C7.94975 11.1852 7.70048 11.2904 7.40906 11.29H1.05844ZM1.05844 10.2148H7.40906V4.83857H1.05844V10.2148ZM4.98154 8.28578C5.18864 8.07575 5.29219 7.82272 5.29219 7.52667C5.29219 7.23062 5.18864 6.97758 4.98154 6.76755C4.77443 6.55752 4.52517 6.45215 4.23375 6.45143C3.94233 6.45071 3.69324 6.55609 3.48649 6.76755C3.27974 6.97901 3.17602 7.23205 3.17531 7.52667C3.17461 7.82128 3.27833 8.0745 3.48649 8.28632C3.69465 8.49814 3.94374 8.60334 4.23375 8.6019C4.52376 8.60047 4.77302 8.49474 4.98154 8.28578ZM2.64609 3.76333H5.82141V2.6881C5.82141 2.24008 5.66705 1.85927 5.35834 1.54566C5.04963 1.23204 4.67476 1.07524 4.23375 1.07524C3.79273 1.07524 3.41787 1.23204 3.10916 1.54566C2.80045 1.85927 2.64609 2.24008 2.64609 2.6881V3.76333Z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="4.23375"
          y1="0"
          x2="4.23375"
          y2="11.29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.38" />
          <stop offset="0.745205" stopColor="white" stopOpacity="0.16" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function StaticCardHolder({
  state = "locked",
  backgroundUrl,
  topLayerUrl,
  playCost = packUnitCost(),
  freePlay = false,
  onPlay,
  className,
}: StaticCardHolderProps) {
  const locked = state === "locked";
  const top = topLayerUrl?.trim() || "";
  const ctaRef = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);

  return (
    <div
      className={[
        "static-card-holder flex w-[51px] flex-col items-center gap-1",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-state={state}
    >
      <div className="static-card-holder__face relative h-[71px] w-[43px] overflow-hidden rounded">
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          style={{ filter: locked ? "saturate(0)" : "none" }}
          draggable={false}
        />
        {top ? (
          <img
            src={top}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{ filter: locked ? "saturate(0)" : "none" }}
            draggable={false}
          />
        ) : null}
        {locked ? (
          <>
            <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
            <div className="absolute inset-0 grid place-items-center">
              <CenterLock />
            </div>
          </>
        ) : null}
      </div>

      <div className="static-card-play-cta" ref={ctaRef}>
        <CtaButton
          {...SQUIRCLE_CTA}
          fillParent
          label=""
          leadingIcon={
            freePlay ? (
              <Play
                className="motion-card-play-cta__triangle"
                size={11}
                strokeWidth={2.4}
                fill="currentColor"
                aria-hidden
              />
            ) : (
              <>
                <DiamondLottie size={11} aria-hidden />
                <span className="motion-card-play-cta__price">{playCost}</span>
                <Play
                  className="motion-card-play-cta__triangle"
                  size={11}
                  strokeWidth={2.4}
                  fill="currentColor"
                  aria-hidden
                />
              </>
            )
          }
          costAmount={null}
          fontSize={10}
          cornerRadius={999}
          aria-label={freePlay ? "Free play" : `Play for ${playCost} diamonds`}
          aria-expanded={freePlay ? undefined : confirm}
          onClick={() => {
            if (freePlay) {
              onPlay?.();
              return;
            }
            setConfirm((open) => !open);
          }}
        />
        {!freePlay && confirm && ctaRef.current ? (
          <PlayConfirm
            anchor={ctaRef.current}
            playCost={playCost}
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              onPlay?.();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
