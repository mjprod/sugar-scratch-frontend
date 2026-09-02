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
/** Legacy / reveal max. Prefer `resolvePackTextureSize` for coverflow. */
export const PACK_TEXTURE_SIZE = 1024
export const PACK_TEXTURE_SIZE_DESKTOP = 768
export const PACK_TEXTURE_SIZE_MOBILE = 512

/** Viewport-tiered pack face canvas size (home / coverflow). */
export function resolvePackTextureSize(isMobile: boolean): number {
  return isMobile ? PACK_TEXTURE_SIZE_MOBILE : PACK_TEXTURE_SIZE_DESKTOP
}
