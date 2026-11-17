/** How long a release velocity keeps the strip moving, in ms. */
export const FLING_MS = 640;

export const JOKER_MIN = 1;
export const JOKER_MAX = 38;
export const JOKER_COUNT = JOKER_MAX - JOKER_MIN + 1;

const BLUR_MAX = 10;

/**
 * Number the strip should land on after a swipe.
 * `fingerPxPerMs` is the finger's horizontal speed; leftward (negative) coasts
 * toward higher numbers. A zero velocity settles on the nearest number.
 */
export function flingIndex(
  scrollLeft: number,
  width: number,
  fingerPxPerMs: number,
  count: number,
): number {
  const span = width > 0 ? width : 1;
  const coast = -fingerPxPerMs * FLING_MS;
  const index = Math.round((scrollLeft + coast) / span);
  return Math.max(0, Math.min(count - 1, index));
}

/**
 * Motion smear in px for fast flings only. Gentle drags / short snaps stay sharp.
 * Callers should prefer CSS `filter: blur()` (Safari SVG blur is weak).
 */
export function motionBlurPx(pxPerMs: number): number {
  const speed = Math.abs(pxPerMs);
  // ~0.45 px/ms ≈ a real flick; below that the settle glide stays crisp.
  if (speed < 0.45) return 0;
  return Math.min(BLUR_MAX, (speed - 0.45) * 12);
}

/** Strip index for a typed value, or null when it is outside 1–38. */
export function customNumberIndex(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < JOKER_MIN || value > JOKER_MAX) {
    return null;
  }
  return value - JOKER_MIN;
}

export function padJoker(n: number) {
  return String(n).padStart(2, "0");
}

/** Recent horizontal finger speed in px/ms from pointer samples. */
export function fingerVelocity(samples: { x: number; t: number }[]) {
  const last = samples[samples.length - 1];
  if (!last) return 0;
  const cutoff = last.t - 80;
  let first = samples[0];
  for (const sample of samples) {
    if (sample.t >= cutoff) {
      first = sample;
      break;
    }
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return (last.x - first.x) / dt;
}

/** How far the 3D shell turns per number slot (radians). */
export const RAD_PER_SLOT = Math.PI / 9;

export type JokerBallHandle = {
  glideTo: (index: number) => void;
};
