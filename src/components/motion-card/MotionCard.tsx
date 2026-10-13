import { useEffect, useLayoutEffect, useRef } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { m, useAnimate, useReducedMotion } from "framer-motion";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import "@/lib/lottie/setupWasm";
import { lottieRenderConfig } from "@/utils/lottieRender";
import {
  LockStatusBanner,
  type LockStatus,
} from "@/components/lock-status/LockStatusBanner";
import "./MotionCard.css";

export type MotionCardState =
  | "locked-unselected"
  | "locked-unselected-banner"
  | "locked-selected"
  | "unlocked-unselected"
  | "unlocked-selected";

export type MotionCardTheme =
  | "police"
  | "nurse"
  | "fire"
  | "gym"
  | "teacher";

export const MOTION_CARD_THEMES: MotionCardTheme[] = [
  "police",
  "nurse",
  "fire",
  "gym",
  "teacher",
];

const TEASE_TINT: Record<MotionCardTheme, string> = {
  police: "oklch(0.71 0.15 99.8 / 0.62)",
  nurse: "oklch(71.8% 0.2 349deg / 0.6)",
  fire: "oklch(72.2% 0.18 44.5deg / 0.6)",
  gym: "oklch(71.5% 0.158 245deg / 0.6)",
  teacher: "oklch(62% 0.2 147deg / 0.6)",
};

const TEASE_COPY: Record<MotionCardTheme, string> = {
  police: "CAUTION",
  nurse: "HANDLE WITH CARE",
  fire: "CONTENTS: HOT!",
  gym: "GET IT IN",
  teacher: "SCHOOL'S OUT",
};

export type MotionCardProps = {
  state?: MotionCardState;
  theme?: MotionCardTheme;
  posterUrl: string;
  videoUrl?: string;
  /** Copies owned. Shown bottom-left only when the card is unlocked and > 1. */
  duplicateCount?: number;
  onBuy?: () => void;
  onSelect?: (next: MotionCardState) => void;
  className?: string;
};

const CARD_COUNTDOWN_LOTTIE_SRC = "/lottie/lottieCardCountdown.lottie";

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
const CARD_MOTION = { duration: 0.42, ease: APPLE_EASE };
const TEASE_WIND = [0.4, 0, 1, 1] as const;
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
  theme = "police",
  posterUrl,
  videoUrl = "",
  duplicateCount,
  onBuy,
  onSelect,
  className,
}: MotionCardProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [teaseRef, animateTease] = useAnimate();
  const frostRef = useRef<HTMLImageElement>(null);
  const prevTease = useRef<boolean | null>(null);
  const locked = state.startsWith("locked");
  const selected = state.endsWith("-selected");
  const copies =
    !locked && typeof duplicateCount === "number" && duplicateCount > 1
      ? Math.round(duplicateCount)
      : 0;
  const playVideo = state === "unlocked-selected" && Boolean(videoUrl);
  const showTease = state === "locked-unselected-banner";
  const instant = reduceMotion ? { duration: 0 } : CARD_MOTION;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playVideo) {
      video.preload = "auto";
      if (!video.getAttribute("src")) video.src = videoUrl;
      video.currentTime = 0;
      void video.play().catch(() => {});
      return;
    }
    video.pause();
    // Drop the decoder while the tile is just a poster. iOS keeps a decoded
    // frame for every attached src, and this row mounts one per theme.
    video.removeAttribute("src");
    video.load();
  }, [playVideo, videoUrl]);

  useLayoutEffect(() => {
    const node = teaseRef.current;
    if (!node) return;

    const frost = frostRef.current;

    if (reduceMotion || prevTease.current === null) {
      node.style.transform = `translateY(${showTease ? 0 : 180}px)`;
      if (frost) frost.style.opacity = showTease ? "1" : "0";
      prevTease.current = showTease;
      return;
    }

    if (prevTease.current === showTease) return;
    prevTease.current = showTease;

    void (async () => {
      if (showTease) {
        if (frost) {
          void animateTease(frost, { opacity: 0 }, { duration: 0 });
        }
        await animateTease(node, { y: 190 }, { duration: 0.14, ease: TEASE_WIND });
        void animateTease(node, { filter: "blur(1.5px)" }, { duration: 0.08 });
        const inbound = animateTease(node, { y: 0 }, { duration: 0.64, ease: APPLE_EASE });
        void animateTease(
          node,
          { filter: "blur(0px)" },
          { duration: 0.18, delay: 0.12, ease: APPLE_EASE },
        );
        if (frost) {
          void animateTease(
            frost,
            { opacity: 1 },
            { duration: 0.32, delay: 0.28, ease: APPLE_EASE },
          );
        }
        await inbound;
        return;
      }
      if (frost) {
        void animateTease(frost, { opacity: 0 }, { duration: 0.12, ease: APPLE_EASE });
      }
      await animateTease(node, { y: -16 }, { duration: 0.14, ease: TEASE_WIND });
      void animateTease(node, { filter: "blur(3px)" }, { duration: 0.12 });
      await animateTease(node, { y: 180 }, { duration: 0.64, ease: APPLE_EASE });
      await animateTease(node, { filter: "blur(0px)" }, { duration: 0.12 });
    })();
  }, [showTease, reduceMotion, animateTease, teaseRef]);

  return (
    <div
      className={[
        "relative aspect-[108/210.5] h-full w-full overflow-hidden rounded-lg [container-type:inline-size]",
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
          className="pointer-events-none absolute inset-0 size-full object-cover"
          poster={posterUrl}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden={!playVideo}
          style={{
            opacity: playVideo ? 1 : 0,
            transition: reduceMotion ? "none" : "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      ) : null}

      <button
        type="button"
        className="absolute inset-0 z-[1]"
        aria-label={
          selected
            ? locked
              ? "Deselect locked card"
              : "Deselect unlocked card"
            : locked
              ? "Select locked card"
              : "Select unlocked card"
        }
        onClick={() =>
          onSelect?.(
            locked
              ? selected
                ? "locked-unselected"
                : "locked-selected"
              : selected
                ? "unlocked-unselected"
                : "unlocked-selected",
          )
        }
      />

      <m.div
        className="pointer-events-none absolute inset-0 z-[1] bg-black/40"
        initial={false}
        animate={{ opacity: locked ? 1 : 0 }}
        transition={instant}
        aria-hidden="true"
      />

      <div ref={teaseRef} className="tease-banner" aria-hidden="true">
        <div className="tease-banner__tape">
          <img
            ref={frostRef}
            className="tease-banner__frost"
            src={posterUrl}
            alt=""
            draggable={false}
          />
          <div
            className="tease-banner__tint"
            style={{ background: TEASE_TINT[theme] }}
          />
          <div className="tease-banner__copy">
            <div className="tease-banner__copy-row">
              <span>{TEASE_COPY[theme]}</span>
              <span>{TEASE_COPY[theme]}</span>
              <span>{TEASE_COPY[theme]}</span>
            </div>
            <div className="tease-banner__hint">Tap to Collect</div>
          </div>
        </div>
      </div>

      <div className="absolute top-[3.5px] left-1/2 z-10 -translate-x-1/2">
        <LockStatusBanner status={bannerStatus(state)} />
      </div>

      {copies > 1 ? (
        <span
          className="motion-dupe-badge"
          aria-label={`${copies} copies`}
        >
          <DotLottieReact
            src={
              typeof window !== "undefined"
                ? new URL(CARD_COUNTDOWN_LOTTIE_SRC, window.location.href).href
                : CARD_COUNTDOWN_LOTTIE_SRC
            }
            autoplay
            loop={false}
            className="motion-dupe-badge__lottie"
            renderConfig={lottieRenderConfig({ extraScale: 1.75, autoResize: false })}
          />
          <span className="motion-dupe-badge__count" aria-hidden="true">
            {copies}
          </span>
        </span>
      ) : null}

      {locked ? (
        <m.div
          className="absolute right-[3px] bottom-[3px] left-[3px] z-10 h-[34px]"
          initial={false}
          animate={{ y: selected ? 0 : 36 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { ...CARD_MOTION, delay: selected ? 0.2 : 0 }
          }
          style={{ pointerEvents: selected ? "auto" : "none" }}
        >
          <CtaButton
            {...SQUIRCLE_CTA}
            fillParent
            label="Unlock"
            costAmount={null}
            fontSize={14}
            onClick={onBuy}
            tabIndex={selected ? 0 : -1}
          />
        </m.div>
      ) : null}
    </div>
  );
}
