import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { CSSProperties } from "react";
import { lottieRenderConfig } from "@/utils/lottieRender";

export const COIN_LOTTIE_SRC = "/cursor-fx/Diamond Coin.lottie";

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
 * Inline coin mark powered by the media-proxied cursor-fx Diamond Coin Lottie.
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
        style={{ width: "100%", height: "100%" }}
      />
    </span>
  );
}
