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
export const PACK_VIDEO_URL = '/assets/default.mp4'

export const PACK_VIDEO_FIT_MODE: VideoFitMode = 'contain'
export const PACK_TEXTURE_SIZE = 1024
