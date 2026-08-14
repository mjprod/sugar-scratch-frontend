import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { CSSProperties } from "react";

export const DIAMOND_LOTTIE_SRC = "/lottie/lottieDiamond.lottie";

type DiamondLottieProps = {
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
 * Inline diamond mark powered by public/lottie/lottieDiamond.lottie.
 * Drop-in replacement for the 💎 emoji in currency / cost UI.
 */
export function DiamondLottie({
  className,
  size = "1em",
  loop = true,
  autoplay = true,
  speed = 1.25,
  style,
  "aria-hidden": ariaHidden = true,
}: DiamondLottieProps) {
  // Scale mark ~30% larger than the surrounding text size, keep square.
  const edge =
    typeof size === "number" ? `${size * 1.3}px` : `calc(${size} * 1.3)`;

  return (
    <span
      className={["diamond-lottie", className].filter(Boolean).join(" ")}
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
        src={DIAMOND_LOTTIE_SRC}
        autoplay={autoplay}
        loop={loop}
        speed={speed}
        style={{ width: "100%", height: "100%" }}
      />
    </span>
  );
}
