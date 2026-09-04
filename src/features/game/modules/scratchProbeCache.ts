/**
 * Throttle GPU `readPixels` probes used while scratching.
 *
 * Policy (Phase 1 perf):
 * - Fabric alpha: at most one sample per animation frame (skip entirely when
 *   fairy dust is off — that path is the only consumer).
 * - Symbol scratch map: UV distance gate first, then reuse a per-slot sample
 *   within the same animation frame — but callers must invalidate a slot after
 *   painting near it so a later stamp can re-probe once more foil is punched.
 *   Reusing a below-threshold sample across paints would skip reveals until the
 *   next stroke (pointer-up does not re-probe).
 */

export type FabricAlphaCache = {
  frame: number;
  alpha: number;
};

export type SymbolScratchProbeCache = {
  frame: number;
  /** Per-slot sample this frame; -1 = not sampled yet. */
  amounts: number[];
};

export function createFabricAlphaCache(): FabricAlphaCache {
  return { frame: -1, alpha: -1 };
}

export function createSymbolScratchProbeCache(
  slotCount: number,
): SymbolScratchProbeCache {
  return {
    frame: -1,
    amounts: Array.from({ length: slotCount }, () => -1),
  };
}

/** Fairy dust is the only consumer of fabric alpha; skip GPU when off. */
export function needsFabricAlphaSample(fairyDustEnabled: boolean): boolean {
  return fairyDustEnabled;
}

export function readCachedFabricAlpha(
  cache: FabricAlphaCache,
  frame: number,
): number | null {
  if (cache.frame === frame) return cache.alpha;
  return null;
}

export function writeCachedFabricAlpha(
  cache: FabricAlphaCache,
  frame: number,
  alpha: number,
): number {
  cache.frame = frame;
  cache.alpha = alpha;
  return alpha;
}

export function isSymbolNearStroke(
  strokeU: number,
  strokeV: number,
  symbolU: number,
  symbolV: number,
  radius: number,
): boolean {
  return Math.hypot(strokeU - symbolU, strokeV - symbolV) <= radius;
}

/**
 * Cached amount for this slot/frame, or null if the caller should GPU-sample.
 * Entering a new frame clears all slot samples.
 */
export function readCachedSymbolScratchAmount(
  cache: SymbolScratchProbeCache,
  frame: number,
  index: number,
): number | null {
  if (cache.frame !== frame) {
    cache.frame = frame;
    cache.amounts.fill(-1);
  }
  const amount = cache.amounts[index] ?? -1;
  if (amount < 0) return null;
  return amount;
}

export function writeCachedSymbolScratchAmount(
  cache: SymbolScratchProbeCache,
  frame: number,
  index: number,
  amount: number,
): number {
  if (cache.frame !== frame) {
    cache.frame = frame;
    cache.amounts.fill(-1);
  }
  cache.amounts[index] = amount;
  return amount;
}

/**
 * Clear one slot's sample for this frame so the next near-stroke probe hits GPU
 * again (after `paintScratch` advanced the scratch map).
 */
export function invalidateCachedSymbolScratchAmount(
  cache: SymbolScratchProbeCache,
  frame: number,
  index: number,
): void {
  if (cache.frame !== frame) return;
  if (index < 0 || index >= cache.amounts.length) return;
  cache.amounts[index] = -1;
}
