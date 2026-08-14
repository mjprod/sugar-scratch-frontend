import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

import { DiamondLottie } from "@/components/ui/DiamondLottie";

import Aurora from "./Aurora";
import BorderGlow from "./BorderGlow";
import "./CtaButton.css";

/** True for empty / diamond-emoji markers that should render the Lottie mark. */
function isDiamondIconMarker(icon: ReactNode): boolean {
  return icon == null || icon === "" || icon === "💎";
}

function renderCostIcon(
  icon: ReactNode,
  opts?: { animate?: boolean },
): ReactNode {
  if (icon === false) return null;
  if (isDiamondIconMarker(icon)) {
    const animate = opts?.animate !== false;
    // Offscreen / frozen CTAs: skip wasm Lottie entirely (static glyph).
    if (!animate) {
      return (
        <span
          className="cta-button__cost-lottie cta-button__cost-lottie--static"
          aria-hidden
        >
          💎
        </span>
      );
    }
    return (
      <DiamondLottie
        className="cta-button__cost-lottie"
        size="1.1em"
        autoplay
        loop
        aria-hidden
      />
    );
  }
  return icon;
}

export type CtaShape = "squircle" | "hex";

/** Matches packs / stage mobile breakpoint used elsewhere in the app. */
const CTA_MOBILE_MQ = "(max-width: 980px)";

function subscribeMobileViewport(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia(CTA_MOBILE_MQ);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getMobileViewportSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(CTA_MOBILE_MQ).matches;
}

function useIsMobileViewport() {
  return useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    () => false,
  );
}

/**
 * Full multi drop-shadow bloom is expensive on phones. Prefer the cheaper
 * "lite" cone on mobile unless the caller opts into full/off explicitly.
 * (Previously squircle defaulted to "off", which made the orbiting stroke
 * effectively invisible — only a 1px mesh rim remained.)
 */
function resolveGlowOuterBloom(
  glowOuterBloom: boolean | "full" | "lite" | "off" | undefined,
  isMobile: boolean,
): boolean | "full" | "lite" | "off" {
  if (glowOuterBloom !== undefined) return glowOuterBloom;
  if (isMobile) return "lite";
  return "full";
}

export type CtaButtonProps = {
  label?: string;
  /** Optional secondary cost row under the title. Empty / null hides the row. */
  costAmount?: string | number | null;
  /**
   * Shown after costAmount. Defaults to the diamond Lottie.
   * Pass `false` to hide, a custom node, or `"💎"` (also maps to the Lottie).
   */
  costIcon?: ReactNode;
  /** Clip silhouette. Default soft rounded rect. */
  shape?: CtaShape;
  /**
   * Fixed width in px. Ignored when `fillParent` is true (uses parent box).
   * Defaults to the squircle template width when not filling.
   */
  width?: number;
  /**
   * Fixed height in px. Ignored when `fillParent` is true (uses parent box).
   * Defaults to the squircle template height when not filling.
   */
  height?: number;
  /**
   * Stretch to the parent container’s content box. Width/height CSS become 100%,
   * and BorderGlow silhouette tracks the measured box via ResizeObserver.
   */
  fillParent?: boolean;
  /** Squircle corner roundness (ignored by hex silhouette). */
  cornerRadius?: number;
  /**
   * Hex only: tip depth as a fraction of height (higher = longer points).
   * Default 0.27.
   */
  hexTip?: number;
  strokeWidth?: number;
  strokeColor?: string;
  /** Four aurora ramp stops: A, B, mid (between B & C), C. */
  auroraColorStops?: [string, string, string, string];
  auroraSpeed?: number;
  auroraBlend?: number;
  auroraAmplitude?: number;
  /** Vertical fill of aurora bands (1 = stock, higher = fills more of the button). */
  auroraBandHeight?: number;
  /** Rotate the aurora field in degrees (e.g. 45 for a diagonal look). */
  auroraRotation?: number;
  /** Color behind transparent aurora pixels (the “black” plate). */
  auroraBaseColor?: string;
  /** Soft circle particles inside the aurora shader pass. */
  particleCount?: number;
  particleSize?: number;
  particleSpeed?: number;
  particleOpacity?: number;
  particleColor?: string;
  particleTwinkle?: number;
  /**
   * Freeze the aurora shader clock (still shows the last/current frame).
   * Useful on low-power / mobile paths without greying out the button.
   */
  auroraPaused?: boolean;
  /**
   * When false, keep a static diamond mark (no Lottie rAF/wasm loop).
   * Defaults to true whenever the diamond marker is used.
   */
  costIconAnimated?: boolean;
  labelColor?: string;
  fontSize?: number;
  forceHover?: boolean;
  forcePressed?: boolean;
  /** Border glow (mesh rim + outer bloom). */
  glowEnabled?: boolean;
  /** Continuous orbit — no hover required. */
  glowAlwaysOn?: boolean;
  glowEdgeSensitivity?: number;
  glowColor?: string;
  glowRadius?: number;
  glowIntensity?: number;
  glowConeSpread?: number;
  glowFillOpacity?: number;
  glowOrbitSpeed?: number;
  glowAlwaysOnProximity?: number;
  glowColors?: [string, string, string];
  /**
   * Outer bloom quality for BorderGlow:
   * - true/"full" — desktop multi-shadow cone
   * - "lite" — cheaper single soft glow (mobile)
   * - false/"off" — rim only
   *
   * When omitted, uses `"lite"` on mobile (≤980px) for perf, and `"full"`
   * otherwise. Pass an explicit value to override.
   */
  glowOuterBloom?: boolean | "full" | "lite" | "off";
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

const DEFAULT_AURORA: [string, string, string, string] = [
  "#aa3c6b",
  "#ea2e89",
  "#42001b",
  "#933e4c",
];
const DEFAULT_GLOW_COLORS: [string, string, string] = ["#aa085f", "#e00083", "#eb6a00"];

const DEFAULT_WIDTH = 292;
const DEFAULT_HEIGHT = 64;

export function CtaButton({
  label = "Start Playing",
  costAmount = null,
  costIcon,
  shape = "squircle",
  width: widthProp,
  height: heightProp,
  fillParent = false,
  cornerRadius = 999,
  hexTip = 0.27,
  strokeWidth = 1,
  strokeColor = "rgba(170, 8, 95, 0.42)",
  auroraColorStops = DEFAULT_AURORA,
  auroraSpeed = 1.2,
  auroraBlend = 1,
  auroraAmplitude = 1.1,
  auroraBandHeight = 2.2,
  auroraRotation = 2,
  auroraBaseColor = "#42001b",
  particleCount = 15,
  particleSize = 0.036,
  particleSpeed = 4,
  particleOpacity = 0.37,
  particleColor = "#fb4b97",
  particleTwinkle = 0.51,
  auroraPaused = false,
  costIconAnimated = true,
  labelColor = "#ffe0e8",
  fontSize = 18,
  forceHover = false,
  forcePressed = false,
  glowEnabled = true,
  glowAlwaysOn = true,
  glowEdgeSensitivity = 15,
  glowColor = "326 90 30",
  glowRadius = 40,
  glowIntensity = 0.95,
  glowConeSpread = 28,
  glowFillOpacity = 0.13,
  glowOrbitSpeed = 70,
  glowAlwaysOnProximity = 94,
  glowColors = DEFAULT_GLOW_COLORS,
  glowOuterBloom,
  disabled = false,
  className,
  type = "button",
  style,
  ...buttonProps
}: CtaButtonProps) {
  const isMobileViewport = useIsMobileViewport();
  const reducedMotion = usePrefersReducedMotion();
  const resolvedOuterBloom = resolveGlowOuterBloom(
    glowOuterBloom,
    isMobileViewport,
  );

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [measured, setMeasured] = useState({
    width: widthProp ?? DEFAULT_WIDTH,
    height: heightProp ?? DEFAULT_HEIGHT,
  });

  useLayoutEffect(() => {
    if (!fillParent) {
      setMeasured({
        width: widthProp ?? DEFAULT_WIDTH,
        height: heightProp ?? DEFAULT_HEIGHT,
      });
      return;
    }

    const el = buttonRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const apply = (width: number, height: number) => {
      const nextW = Math.max(1, Math.round(width));
      const nextH = Math.max(1, Math.round(height));
      setMeasured((prev) =>
        prev.width === nextW && prev.height === nextH
          ? prev
          : { width: nextW, height: nextH },
      );
    };

    apply(el.clientWidth, el.clientHeight);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      if (box) {
        apply(box.inlineSize, box.blockSize);
        return;
      }
      apply(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fillParent, widthProp, heightProp]);

  const width = fillParent ? measured.width : (widthProp ?? DEFAULT_WIDTH);
  const height = fillParent ? measured.height : (heightProp ?? DEFAULT_HEIGHT);

  const strokeOrbitActive =
    glowEnabled && glowAlwaysOn && !disabled && !reducedMotion && glowOrbitSpeed > 0;
  const orbitDurationSec =
    glowOrbitSpeed > 0 ? 360 / Math.max(glowOrbitSpeed, 0.001) : 0;
  // Skip WebGL entirely while paused — CSS fallback keeps the look.
  const auroraLive = !disabled && !auroraPaused;
  // Mobile feed can mount many CTAs; keep particles lighter when animating.
  const liveParticleCount = isMobileViewport
    ? Math.min(particleCount, 8)
    : particleCount;

  const stroke = Math.max(0, strokeWidth);
  const radius = Math.max(0, Math.min(cornerRadius, Math.min(width, height) / 2));
  // Keep inner corners concentric with the outer shape after the stroke inset.
  const innerRadius = Math.max(0, radius - stroke);
  const tipRatio = Math.max(0.12, Math.min(0.55, hexTip));
  const tipPx = height * tipRatio;
  const innerTipPx = Math.max(0, tipPx - stroke * 0.85);
  const showCost =
    costAmount != null && costAmount !== "" && !(typeof costAmount === "number" && Number.isNaN(costAmount));
  const costText = showCost ? String(costAmount) : "";

  const strokeA = glowColors[0] ?? "#aa085f";
  const strokeB = glowColors[1] ?? "#e00083";
  const strokeC = glowColors[2] ?? "#eb6a00";
  // Frost base from strokeColor (soft magenta, not white). Mesh cone
  // paints on top via .cta-button__stroke so the orbit matches BorderGlow.
  const ringBase =
    strokeColor && strokeColor !== "transparent"
      ? strokeColor
      : "rgba(170, 8, 95, 0.42)";

  const cssVars = {
    ...(fillParent
      ? {
          "--cta-w": "100%",
          "--cta-h": "100%",
        }
      : {
          "--cta-w": `${width}px`,
          "--cta-h": `${height}px`,
        }),
    "--cta-r": `${radius}px`,
    "--cta-inner-r": `${innerRadius}px`,
    "--cta-tip": `${tipPx}px`,
    "--cta-inner-tip": `${innerTipPx}px`,
    "--cta-stroke": `${stroke}px`,
    "--cta-stroke-color": ringBase,
    "--cta-stroke-a": strokeA,
    "--cta-stroke-b": strokeB,
    "--cta-stroke-c": strokeC,
    "--cta-cone-spread": String(Math.max(8, Math.min(48, glowConeSpread))),
    "--cta-cursor-angle": "45deg",
    "--cta-cursor-angle-start": "45deg",
    "--cta-orbit-duration": strokeOrbitActive
      ? `${orbitDurationSec}s`
      : "0s",
    "--cta-aurora-base": auroraBaseColor,
    "--cta-label-color": labelColor,
    "--cta-font-size": `${fontSize}px`,
  } as CSSProperties;

  const classes = [
    "cta-button",
    `cta-button--${shape}`,
    fillParent ? "cta-button--fill" : "",
    glowEnabled ? "is-glow-on" : "is-glow-off",
    strokeOrbitActive ? "is-stroke-orbit" : "",
    forceHover ? "is-force-hover" : "",
    forcePressed ? "is-force-pressed" : "",
    disabled ? "is-disabled" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const button = (
    <button
      {...buttonProps}
      ref={buttonRef}
      type={type}
      disabled={disabled}
      className={classes}
      style={{ ...cssVars, ...style }}
      // Extra iOS guard: prevent long-press selection / callout on the control.
      onContextMenu={(event) => {
        event.preventDefault();
        buttonProps.onContextMenu?.(event);
      }}
    >
      {/*
        On-button stroke ring (iOS-safe). Fixed mesh + CSS @property cone angle —
        same model as BorderGlow always-on, without underlay stacking issues.
      */}
      <span className="cta-button__stroke" aria-hidden="true" />
      <span className="cta-button__inner">
        <span className="cta-button__aurora" aria-hidden="true">
          {auroraLive ? (
            <Aurora
              colorStops={auroraColorStops}
              speed={auroraSpeed}
              blend={auroraBlend}
              amplitude={auroraAmplitude}
              bandHeight={auroraBandHeight}
              rotation={auroraRotation}
              particleCount={liveParticleCount}
              particleSize={particleSize}
              particleSpeed={particleSpeed}
              particleOpacity={particleOpacity}
              particleColor={particleColor}
              particleTwinkle={particleTwinkle}
              paused={false}
            />
          ) : (
            <span className="cta-button__aurora-fallback" />
          )}
        </span>
        <span className="cta-button__face" aria-hidden="true" />
        <span className="cta-button__label">
          <span className="cta-button__title">{label}</span>
          {showCost ? (
            <span className="cta-button__cost">
              <span className="cta-button__cost-amount">{costText}</span>
              {(() => {
                const icon = renderCostIcon(costIcon, {
                  animate: costIconAnimated && !disabled && !reducedMotion,
                });
                if (icon == null || icon === false) return null;
                return (
                  <span className="cta-button__cost-icon" aria-hidden="true">
                    {icon}
                  </span>
                );
              })()}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );

  if (!glowEnabled) return button;

  return (
    <BorderGlow
      bare
      className={[
        "cta-button-glow",
        `cta-button-glow--${shape}`,
        fillParent ? "cta-button-glow--fill" : "",
        disabled ? "is-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      alwaysOn={glowAlwaysOn && !disabled}
      disabled={disabled}
      edgeSensitivity={glowEdgeSensitivity}
      glowColor={glowColor}
      backgroundColor="transparent"
      borderRadius={radius}
      glowRadius={glowRadius}
      glowIntensity={disabled ? 0 : glowIntensity}
      coneSpread={glowConeSpread}
      fillOpacity={disabled ? 0 : glowFillOpacity}
      orbitSpeed={disabled ? 0 : glowOrbitSpeed}
      alwaysOnProximity={disabled ? 0 : glowAlwaysOnProximity}
      colors={glowColors}
      animated={false}
      shape={shape === "hex" ? "hex" : "rounded-rect"}
      shapeWidth={width}
      shapeHeight={height}
      hexTip={tipRatio}
      outerBloom={disabled ? "off" : resolvedOuterBloom}
    >
      {button}
    </BorderGlow>
  );
}
