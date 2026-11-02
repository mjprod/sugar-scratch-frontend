/**
 * One getBoundingClientRect per animation frame.
 * Phone pointer/touch moves can fire hundreds of times between rAFs; each live
 * rect read forces layout (worse while scratch-zoom is transitioning).
 */

export type FrameClientRectCache = {
  rect: DOMRect | null;
  raf: number;
};

export function createFrameClientRectCache(): FrameClientRectCache {
  return { rect: null, raf: 0 };
}

type RectEl = { getBoundingClientRect: () => DOMRect };

export function readFrameClientRect(
  cache: FrameClientRectCache,
  el: RectEl,
  schedule: (cb: () => void) => number = (cb) =>
    requestAnimationFrame(cb as FrameRequestCallback),
): DOMRect {
  if (cache.rect) return cache.rect;
  cache.rect = el.getBoundingClientRect();
  if (!cache.raf) {
    cache.raf = schedule(() => {
      cache.rect = null;
      cache.raf = 0;
    });
  }
  return cache.rect;
}

export function clearFrameClientRectCache(
  cache: FrameClientRectCache,
  cancel: (id: number) => void = cancelAnimationFrame,
): void {
  if (cache.raf) cancel(cache.raf);
  cache.raf = 0;
  cache.rect = null;
}
