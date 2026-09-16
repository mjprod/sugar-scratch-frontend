/**
 * Fairy-dust spawn / fabric-probe policy (Phase 9).
 * Coarse pointers skip fabric readPixels mid-scratch, but celebrate trails
 * still spawn while the finger is down so the 10% win-feel isn't missed.
 */

export function shouldSpawnFairyDust(opts: {
  playWindow: boolean;
  celebrate: boolean;
  isScratching: boolean;
  cursorOnMesh: boolean;
  coarsePointer: boolean;
}): boolean {
  if (!opts.playWindow || !opts.celebrate) return false;
  // Celebrate window: spawn on both fine + coarse (including mid-stroke).
  if (opts.coarsePointer) return true;
  return opts.isScratching && opts.cursorOnMesh;
}

/** Fabric readPixels only when fairy dust could use the sample this frame. */
export function shouldSampleFabricAlpha(opts: {
  fairyDust: boolean;
  coarsePointer: boolean;
  isScratching: boolean;
}): boolean {
  if (!opts.fairyDust) return false;
  if (opts.coarsePointer && opts.isScratching) return false;
  return true;
}

/** Pixels the pointer must travel in one move before a trail coin emits. */
export function fairyDustSpawnMinDistancePx(coarsePointer: boolean): number {
  return coarsePointer ? 40 : 14;
}

export function shouldSpawnFairyDustForMove(
  dx: number,
  dy: number,
  minDistancePx: number,
): boolean {
  const min = Math.max(0, minDistancePx);
  return dx * dx + dy * dy >= min * min;
}
