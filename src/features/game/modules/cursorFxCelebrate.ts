/**
 * Cursor-FX celebrate + mobile defaults (Phase 5 perf / win-feel).
 * Particles are not a continuous trail — they fire briefly each time scratch
 * progress crosses another 10% band so the player feels a small win.
 */

export const CURSOR_FX_MILESTONE = 0.1;
/** How long spawn stays armed after a milestone (ms). */
export const CURSOR_FX_CELEBRATE_MS = 1100;
/** Longer arm on phones — finger often stays down past the 10% beat. */
export const CURSOR_FX_CELEBRATE_MS_COARSE = 2400;

export type CursorFxDeviceProfile = {
  fairyDust: boolean;
  particleSize: number;
  particleCount: number;
  /** Cap FairyDust overlay canvas DPR (1 on phone / coarse pointer). */
  maxOverlayDpr: number;
  /** True when `(pointer: coarse)` matched at profile resolve time. */
  coarsePointer: boolean;
};

export function progressMilestoneIndex(
  progress: number,
  step = CURSOR_FX_MILESTONE,
): number {
  if (!(progress > 0) || !(step > 0)) return 0;
  return Math.floor(progress / step + 1e-9);
}

/** Returns the milestone index crossed (1 = 10%, 2 = 20%, …), or null. */
export function crossedProgressMilestone(
  prevProgress: number,
  nextProgress: number,
  step = CURSOR_FX_MILESTONE,
): number | null {
  const prev = progressMilestoneIndex(prevProgress, step);
  const next = progressMilestoneIndex(nextProgress, step);
  if (next > prev && next > 0) return next;
  return null;
}

export function resolveCursorFxDeviceProfile(opts: {
  reducedMotion: boolean;
  coarsePointer: boolean;
  narrowViewport: boolean;
}): CursorFxDeviceProfile {
  if (opts.reducedMotion) {
    return {
      fairyDust: false,
      particleSize: 40,
      particleCount: 2,
      maxOverlayDpr: 1,
      coarsePointer: opts.coarsePointer,
    };
  }
  const mobile = opts.coarsePointer || opts.narrowViewport;
  if (mobile) {
    return {
      fairyDust: true,
      // Minimal trail — phones struggle with Lottie particle draw calls.
      particleSize: 40,
      particleCount: 1,
      maxOverlayDpr: 1,
      coarsePointer: opts.coarsePointer,
    };
  }
  return {
    fairyDust: true,
    particleSize: 64,
    particleCount: 5,
    maxOverlayDpr: 2,
    coarsePointer: opts.coarsePointer,
  };
}

/** Mild boost on celebrate; coarse stays tiny for frame budget. */
export function celebrateParticleBoost(
  baseCount: number,
  coarsePointer = false,
): number {
  if (coarsePointer) {
    return Math.min(2, Math.max(1, baseCount));
  }
  return Math.min(12, Math.max(baseCount, Math.round(baseCount * 1.6)));
}

export function celebrateDurationMs(coarsePointer: boolean): number {
  return coarsePointer ? CURSOR_FX_CELEBRATE_MS_COARSE : CURSOR_FX_CELEBRATE_MS;
}
