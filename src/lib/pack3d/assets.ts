export type VideoFitMode = 'cover' | 'contain' | 'stretch'

export interface VideoTextureTransform {
  offsetX: number
  offsetY: number
  scaleX: number
  scaleY: number
  rotation: number
}

export interface ModelRotation {
  x: number
  y: number
  z: number
}

/** Reveal-tuned UV framing for the pack face video on card2.glb. */
export const DEFAULT_VIDEO_TEXTURE_TRANSFORM: VideoTextureTransform = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 0.55,
  scaleY: 0.95,
  rotation: 0,
}

export const DEFAULT_MODEL_ROTATION: ModelRotation = {
  x: -12,
  y: 90.5,
  z: 0,
}

export const PACK_MODEL_URL = '/assets/card2.glb'

export const PACK_VIDEO_FIT_MODE: VideoFitMode = 'contain'
export const PACK_TEXTURE_SIZE_DESKTOP = 768
export const PACK_TEXTURE_SIZE_MOBILE = 640
export const PACK_TEXTURE_SIZE_MOBILE_SIDE = 192
/** Legacy alias. Prefer `resolvePackTextureSize` for coverflow. */
export const PACK_TEXTURE_SIZE = PACK_TEXTURE_SIZE_DESKTOP

/** Viewport-tiered pack face canvas size (home / coverflow). */
export function resolvePackTextureSize(
  isMobile: boolean,
  offset = 0,
): number {
  if (!isMobile) return PACK_TEXTURE_SIZE_DESKTOP
  // Center + immediate neighbors stay 640 so a swipe doesn't decode 192→640 on land.
  return Math.abs(offset) <= 1
    ? PACK_TEXTURE_SIZE_MOBILE
    : PACK_TEXTURE_SIZE_MOBILE_SIDE
}
