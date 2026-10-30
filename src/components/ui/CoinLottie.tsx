import type { CSSProperties } from "react";
import { DeferredLottie } from "@/lib/lottie/DeferredLottie";
import { lottieRenderConfig } from "@/utils/lottieRender";

export const COIN_LOTTIE_SRC = "/cursor-fx/Diamond%20Coin.lottie";
/** Still coin shown until the deferred Lottie mounts. */
const COIN_STILL_SRC = "/images/coin.webp";
/** CSS zoom on the player — pass the same value as extraScale so the canvas stays sharp. */
const COIN_LOTTIE_ZOOM = 1.6;

type CoinLottieProps = {
  className?: string;
  /** Square edge length in CSS px (or any CSS length). Default 1em so it tracks text. */
  size?: number | string;
  loop?: boolean;
  autoplay?: boolean;
  /** Playback multiplier. Default 1.25. */
  speed?: number;
  /** Extra canvas DPR on top of the art-fill zoom. Default 1. */
  extraScale?: number;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
};

/**
 * Inline coin mark for the top-nav HUD and other coin chips.
 * Source art has a transparent margin — scale + clip so the coin fills the box.
 */
export function CoinLottie({
  className,
  size = "1em",
  loop = true,
  autoplay = true,
  speed = 1.25,
  extraScale = 1,
  style,
  "aria-hidden": ariaHidden = true,
}: CoinLottieProps) {
  const edge =
    typeof size === "number" ? `${size * 1.3}px` : `calc(${size} * 1.3)`;

  return (
    <span
      className={["coin-lottie", className].filter(Boolean).join(" ")}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: edge,
        height: edge,
        flex: "0 0 auto",
        lineHeight: 0,
        verticalAlign: "middle",
        overflow: "hidden",
        ...style,
      }}
      aria-hidden={ariaHidden}
    >
      <DeferredLottie
        fallback={
          <img
            src={COIN_STILL_SRC}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
          />
        }
        src={COIN_LOTTIE_SRC}
        autoplay={autoplay}
        loop={loop}
        speed={speed}
        renderConfig={lottieRenderConfig({ extraScale: COIN_LOTTIE_ZOOM * extraScale })}
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${COIN_LOTTIE_ZOOM})`,
          transformOrigin: "center",
        }}
      />
    </span>
  );
}
