import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  LockStatusBanner,
  type LockStatus,
} from "@/components/lock-status/LockStatusBanner";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { packUnitCost } from "@/services/purchase";
import "./MotionCard.css";

export type MotionCardState =
  | "locked-unselected"
  | "locked-selected"
  | "unlocked-unselected"
  | "unlocked-selected";

type MotionCardProps = {
  state?: MotionCardState;
  posterUrl: string;
  videoUrl?: string;
  playCost?: number;
  onBuy?: () => void;
  onPlay?: () => void;
  className?: string;
};

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
const CARD_MOTION = { duration: 0.42, ease: APPLE_EASE };
const SQUIRCLE_CTA = ctaButtonPropsFromTemplate("squircleCTA");

function bannerStatus(state: MotionCardState): LockStatus {
  if (state.startsWith("locked")) return "locked";
  if (state === "unlocked-unselected") return "min-unlocked";
  return "unlocked";
}

/**
 * Figma 229:3873 — 108×211 motion tile.
 * Overflow is clipped so the Buy CTA can sit off-canvas when unselected.
 */
export function MotionCard({
  state = "locked-unselected",
  posterUrl,
  videoUrl = "",
  playCost = packUnitCost(),
  onBuy,
  onPlay,
  className,
}: MotionCardProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const locked = state.startsWith("locked");
  const selected = state.endsWith("-selected");
  const playVideo = state === "unlocked-selected" && Boolean(videoUrl);
  const ctaInFrame = selected;
  const instant = reduceMotion ? { duration: 0 } : CARD_MOTION;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playVideo) {
      video.currentTime = 0;
      void video.play().catch(() => {});
      return;
    }
    video.pause();
  }, [playVideo]);

  return (
    <div
      className={[
        "relative h-[210.5px] w-[108px] overflow-hidden rounded-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-state={state}
    >
      <img
        src={posterUrl}
        alt=""
        className="absolute inset-0 size-full object-cover"
        style={{
          filter: locked ? "saturate(0)" : "none",
          transition: reduceMotion ? "none" : "filter 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        draggable={false}
      />

      {videoUrl ? (
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          src={videoUrl}
          poster={posterUrl}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden={!playVideo}
          style={{
            opacity: playVideo ? 1 : 0,
            transition: reduceMotion ? "none" : "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      ) : null}

      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={false}
        animate={{ opacity: locked ? 1 : 0 }}
        transition={instant}
        aria-hidden="true"
      />

      <div className="absolute top-[3.5px] left-1/2 z-10 -translate-x-1/2">
        <LockStatusBanner status={bannerStatus(state)} />
      </div>

      <motion.div
        className="absolute right-[3px] bottom-[3px] left-[3px] z-10 h-7"
        initial={false}
        animate={{ y: ctaInFrame ? 0 : 36 }}
        transition={instant}
        style={{ pointerEvents: ctaInFrame ? "auto" : "none" }}
      >
        {locked ? (
          <CtaButton
            {...SQUIRCLE_CTA}
            fillParent
            label="Buy a Pack"
            costAmount={null}
            fontSize={10}
            onClick={onBuy}
            tabIndex={ctaInFrame ? 0 : -1}
          />
        ) : (
          <div className="motion-card-play-cta">
            <CtaButton
              {...SQUIRCLE_CTA}
              fillParent
              label=""
              leadingIcon={
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
              }
              costAmount={null}
              fontSize={10}
              cornerRadius={999}
              aria-label={`Play for ${playCost} diamonds`}
              onClick={onPlay}
              tabIndex={ctaInFrame ? 0 : -1}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
