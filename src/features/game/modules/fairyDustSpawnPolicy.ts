/**
 * Fairy-dust spawn / fabric-probe policy (Phase 9).
 * On coarse pointers, celebrate may arm mid-stroke but particles spawn only
 * after pointer-up — avoids a second full-stage canvas + readPixels during scratch.
 */

export function shouldSpawnFairyDust(opts: {
  playWindow: boolean;
  celebrate: boolean;
  isScratching: boolean;
  cursorOnMesh: boolean;
  coarsePointer: boolean;
}): boolean {
  if (!opts.playWindow || !opts.celebrate) return false;
  if (opts.coarsePointer) return !opts.isScratching;
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
