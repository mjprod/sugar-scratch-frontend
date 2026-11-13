/**
 * Live-video focus is sized from getBoundingClientRect so it tracks the
 * on-screen pack. During coverflow / scale swipes iOS often reports a tiny
 * visual rect (~40px) while layout size is still full — applying that flashes
 * a postage-stamp video. Ignore visual sizes that are far below layout.
 */
export function shouldApplyFocusRect(
  visualHeight: number,
  layoutHeight: number,
  minRatio = 0.55,
): boolean {
  if (!(visualHeight > 0)) return false;
  if (!(layoutHeight > 0)) return true;
  return visualHeight >= layoutHeight * minRatio;
}
