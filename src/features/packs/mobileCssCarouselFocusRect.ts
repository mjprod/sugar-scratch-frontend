/**
 * Live-video focus is sized from getBoundingClientRect so it tracks the
 * on-screen pack. During coverflow / scale swipes iOS often reports a tiny
 * visual rect (~40px) while layout size is still full — applying that flashes
 * a postage-stamp video. Ignore visual sizes that are far below layout.
 * Width is checked the same way: a still-rotated coverflow AABB can be tall
 * enough but horizontally wrong, which parked the CSS CTA off-axis then snap.
 */
export function shouldApplyFocusRect(
  visualHeight: number,
  layoutHeight: number,
  minRatio = 0.55,
  visualWidth = 0,
  layoutWidth = 0,
): boolean {
  if (!(visualHeight > 0)) return false;
  if (!(layoutHeight > 0)) return true;
  if (visualHeight < layoutHeight * minRatio) return false;
  if (layoutWidth > 0 && visualWidth > 0 && visualWidth < layoutWidth * minRatio) {
    return false;
  }
  return true;
}
