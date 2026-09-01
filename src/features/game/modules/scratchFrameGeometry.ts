import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../scratch/meshGeometry";

export const FRAME_RX = 8;
export const FRAME_W = CANVAS_WIDTH;
export const FRAME_H = CANVAS_HEIGHT;

export type NormalizedPoint = { nx: number; ny: number };

export function roundedRectPerimeter(
  w: number,
  h: number,
  r: number,
): number {
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

export function nearestEdgePoint(
  nx: number,
  ny: number,
  w = FRAME_W,
  h = FRAME_H,
): { x: number; y: number; edge: "top" | "right" | "bottom" | "left" } {
  const x = nx * w;
  const y = ny * h;
  const distances = {
    top: y,
    right: w - x,
    bottom: h - y,
    left: x,
  } as const;
  const edge = (
    Object.entries(distances).sort((a, b) => a[1] - b[1])[0] as [
      keyof typeof distances,
      number,
    ]
  )[0];
  switch (edge) {
    case "top":
      return { edge, x, y: 0 };
    case "right":
      return { edge, x: w, y };
    case "bottom":
      return { edge, x, y: h };
    default:
      return { edge: "left", x: 0, y };
  }
}

/** Subtle quadratic curve — energy flow, not a laser. */
export function energyTrailPath(
  from: NormalizedPoint,
  w = FRAME_W,
  h = FRAME_H,
): string {
  const sx = from.nx * w;
  const sy = from.ny * h;
  const target = nearestEdgePoint(from.nx, from.ny, w, h);
  const cx = sx + (target.x - sx) * 0.35 + (w * 0.5 - sx) * 0.08;
  const cy = sy + (target.y - sy) * 0.35 + (h * 0.5 - sy) * 0.08;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${target.x} ${target.y}`;
}

export function feedbackLabel(found: number, total: number): {
  primary: string;
  secondary: string;
} {
  if (found >= total) {
    return { primary: `${total} / ${total}`, secondary: "FOUND" };
  }
  if (found === total - 1) {
    return { primary: "✦ ONE LEFT", secondary: "" };
  }
  if (found === 10) {
    return { primary: "ALMOST THERE", secondary: "" };
  }
  return { primary: `${found} / ${total}`, secondary: "FOUND" };
}
