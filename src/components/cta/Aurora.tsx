import { useEffect, useRef } from "react";

import "./Aurora.css";
import {
  subscribeAurora,
  type AuroraColorStops,
  type AuroraSubscription,
  type AuroraVisualConfig,
} from "./auroraShared";

export type { AuroraColorStops };

export type AuroraProps = {
  /** Four hex stops: A, B, mid (between B & C), C — spaced at 0 / ⅓ / ⅔ / 1. */
  colorStops?: AuroraColorStops;
  amplitude?: number;
  blend?: number;
  speed?: number;
  time?: number;
  /**
   * Vertical coverage of the aurora curtain.
   * 1 = stock look; higher values stretch the bands so they fill more of the button.
   */
  bandHeight?: number;
  /** Rotate the whole aurora field (degrees). 0 = stock, 45 = diagonal. */
  rotation?: number;
  /** Soft circle particles drawn in the same fragment pass. */
  particleCount?: number;
  /** Base particle radius in UV-ish units (~0.01–0.08 looks good on a CTA). */
  particleSize?: number;
  particleSpeed?: number;
  particleOpacity?: number;
  particleColor?: string;
  /** 0 = steady, 1 = strong twinkle. */
  particleTwinkle?: number;
  /** Freeze the shader clock (and particles) on the last frame. */
  paused?: boolean;
  className?: string;
};

const DEFAULT_COLOR_STOPS: AuroraColorStops = ["#5227FF", "#7cff67", "#ff94b4", "#5227FF"];

function toVisualConfig(props: AuroraProps): AuroraVisualConfig {
  return {
    colorStops: props.colorStops ?? DEFAULT_COLOR_STOPS,
    amplitude: props.amplitude ?? 1,
    blend: props.blend ?? 0.5,
    speed: props.speed ?? 1,
    bandHeight: props.bandHeight ?? 1,
    rotation: props.rotation ?? 0,
    particleCount: props.particleCount ?? 0,
    particleSize: props.particleSize ?? 0.03,
    particleSpeed: props.particleSpeed ?? 1,
    particleOpacity: props.particleOpacity ?? 0.85,
    particleColor: props.particleColor ?? "#ffffff",
    particleTwinkle: props.particleTwinkle ?? 0.45,
  };
}

export default function Aurora(props: AuroraProps) {
  const {
    colorStops = DEFAULT_COLOR_STOPS,
    amplitude = 1.0,
    blend = 0.5,
    speed = 1.0,
    bandHeight = 1.0,
    rotation = 0,
    particleCount = 0,
    particleSize = 0.03,
    particleSpeed = 1,
    particleOpacity = 0.85,
    particleColor = "#ffffff",
    particleTwinkle = 0.45,
    paused = false,
    className,
  } = props;

  const ctnDom = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<AuroraSubscription | null>(null);
  const pausedRef = useRef(paused);
  const visibleRef = useRef(true);
  pausedRef.current = paused;
  const stopsKey = colorStops.join("|");

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.pointerEvents = "none";
    ctn.appendChild(canvas);

    const config = toVisualConfig({
      colorStops: stopsKey.split("|") as AuroraColorStops,
      amplitude,
      blend,
      speed,
      bandHeight,
      rotation,
      particleCount,
      particleSize,
      particleSpeed,
      particleOpacity,
      particleColor,
      particleTwinkle,
    });
    const subscription = subscribeAurora(config, canvas);
    subscriptionRef.current = subscription;

    if (!subscription) {
      canvas.remove();
      return () => {
        subscriptionRef.current = null;
      };
    }

    const applySize = () => {
      const width = ctn.offsetWidth;
      const height = ctn.offsetHeight;
      if (width <= 0 || height <= 0) return;
      subscription.setSize(width, height);
    };

    const applySleep = () => {
      const sleeping = pausedRef.current || !visibleRef.current;
      subscription.setSleeping(sleeping);
      if (sleeping) subscription.renderOnce();
    };

    applySize();
    applySleep();

    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(applySize);
    ro?.observe(ctn);
    window.addEventListener("resize", applySize);

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visibleRef.current = Boolean(entry?.isIntersecting);
              applySleep();
            },
            { rootMargin: "120px" },
          );
    io?.observe(ctn);

    return () => {
      window.removeEventListener("resize", applySize);
      ro?.disconnect();
      io?.disconnect();
      subscription.destroy();
      subscriptionRef.current = null;
      if (canvas.parentNode === ctn) canvas.remove();
    };
  }, [
    amplitude,
    bandHeight,
    blend,
    particleColor,
    particleCount,
    particleOpacity,
    particleSize,
    particleSpeed,
    particleTwinkle,
    rotation,
    speed,
    stopsKey,
  ]);

  useEffect(() => {
    const subscription = subscriptionRef.current;
    if (!subscription) return;
    const sleeping = paused || !visibleRef.current;
    subscription.setSleeping(sleeping);
    if (sleeping) subscription.renderOnce();
  }, [paused]);

  return (
    <div
      ref={ctnDom}
      className={className ? `aurora-container ${className}` : "aurora-container"}
    >
      <span className="cta-button__aurora-fallback" aria-hidden="true" />
    </div>
  );
}
