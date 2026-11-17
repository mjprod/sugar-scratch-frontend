/** Tunable white-window / number chrome for the 3D joker ball. */
export type JokerBallWindowLook = {
  numOffsetX: number;
  numOffsetY: number;
  innerColor: string;
  innerOpacity: number;
  innerX: number;
  innerY: number;
  innerBlur: number;
  outerColor: string;
  outerOpacity: number;
  outerX: number;
  outerY: number;
  outerBlur: number;
};

export const DEFAULT_JOKER_WINDOW: JokerBallWindowLook = {
  numOffsetX: -2.5,
  numOffsetY: 4,
  innerColor: "#000000",
  innerOpacity: 0.25,
  innerX: 0.5,
  innerY: 12,
  innerBlur: 7.5,
  outerColor: "#ffffff",
  outerOpacity: 0.23,
  outerX: 0,
  outerY: 4.5,
  outerBlur: 0,
};

/** Window fill gradient (up to 3 stops). */
export type JokerBallGradientLook = {
  kind: "radial" | "linear";
  /** Degrees — used when kind is linear. */
  angle: number;
  stopCount: 1 | 2 | 3;
  c1: string;
  p1: number;
  c2: string;
  p2: number;
  c3: string;
  p3: number;
};

export const DEFAULT_JOKER_GRADIENT: JokerBallGradientLook = {
  kind: "linear",
  angle: 177,
  stopCount: 2,
  c1: "#efeae1",
  p1: 50,
  c2: "#807b6f",
  p2: 88,
  c3: "#c2b6a6",
  p3: 100,
};

function hexToRgb(hex: string) {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  return {
    r: Number.parseInt(full.slice(0, 2), 16) || 0,
    g: Number.parseInt(full.slice(2, 4), 16) || 0,
    b: Number.parseInt(full.slice(4, 6), 16) || 0,
  };
}

export function windowShadowCss(look: JokerBallWindowLook) {
  const inner = hexToRgb(look.innerColor);
  const outer = hexToRgb(look.outerColor);
  const outerShadow = `${look.outerX}px ${look.outerY}px ${look.outerBlur}px rgba(${outer.r}, ${outer.g}, ${outer.b}, ${look.outerOpacity})`;
  const innerShadow = `inset ${look.innerX}px ${look.innerY}px ${look.innerBlur}px rgba(${inner.r}, ${inner.g}, ${inner.b}, ${look.innerOpacity})`;
  return `${outerShadow}, ${innerShadow}`;
}

export function windowGradientCss(look: JokerBallGradientLook) {
  const stops = [
    { color: look.c1, pos: look.p1 },
    { color: look.c2, pos: look.p2 },
    { color: look.c3, pos: look.p3 },
  ]
    .slice(0, look.stopCount)
    .map((stop) => `${stop.color} ${stop.pos}%`)
    .join(", ");
  if (look.kind === "linear") {
    return `linear-gradient(${look.angle}deg, ${stops})`;
  }
  return `radial-gradient(circle at 50% 45%, ${stops})`;
}
