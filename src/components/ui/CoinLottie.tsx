import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { CSSProperties } from "react";
import { lottieRenderConfig } from "@/utils/lottieRender";

export const COIN_LOTTIE_SRC = "/lottie/lottieDiamondDust.lottie";

type CoinLottieProps = {
  className?: string;
  /** Square edge length in CSS px (or any CSS length). Default 1em so it tracks text. */
  size?: number | string;
  loop?: boolean;
  autoplay?: boolean;
  /** Playback multiplier. Default 1.25. */
  speed?: number;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
};

/**
 * Inline coin mark for the top-nav HUD and other coin chips.
 * Source art may include transparent margin — scale + clip so the mark fills the box.
 */
export function CoinLottie({
  className,
  size = "1em",
  loop = true,
  autoplay = true,
  speed = 1.25,
  style,
  "aria-hidden": ariaHidden = true,
}: CoinLottieProps) {
  // Dust particles need horizontal room; keep a wide viewport so edges aren't clipped.
  const height = typeof size === "number" ? `${size}px` : size;
  const width =
    typeof size === "number" ? `${Math.round(size * 1.75)}px` : `calc(${size} * 1.75)`;

  return (
    <span
      className={["coin-lottie", className].filter(Boolean).join(" ")}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width,
        height,
        flex: "0 0 auto",
        lineHeight: 0,
        verticalAlign: "middle",
        overflow: "visible",
        ...style,
      }}
      aria-hidden={ariaHidden}
    >
      <DotLottieReact
        src={COIN_LOTTIE_SRC}
        autoplay={autoplay}
        loop={loop}
        speed={speed}
        renderConfig={lottieRenderConfig()}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </span>
  );
}
