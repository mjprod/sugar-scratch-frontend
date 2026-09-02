export {
  DEFAULT_MODEL_ROTATION,
  DEFAULT_VIDEO_TEXTURE_TRANSFORM,
  PACK_MODEL_URL,
  PACK_TEXTURE_SIZE,
  PACK_TEXTURE_SIZE_DESKTOP,
  PACK_TEXTURE_SIZE_MOBILE,
  PACK_VIDEO_FIT_MODE,
  resolvePackTextureSize,
  type ModelRotation,
  type VideoFitMode,
  type VideoTextureTransform,
} from './assets'

export {
  applyPackFaceMaterial,
  cloneSceneWithMaterials,
  collectStandardMaterials,
  isTexturableMaterial,
  resolveTargetMaterial,
  stripPackFaceAlbedo,
  type TexturableMaterial,
} from './materials'

export {
  applyApiCardLightColors,
  DEFAULT_PACK_STAGE_FACE,
  DEFAULT_PACK_STAGE_LIGHTS,
  DEFAULT_PACK_STAGE_LOOK,
  DEFAULT_PACK_STAGE_VIDEO,
  formatPackStageLook,
  getPackStageLook,
  getPackStageVideoFilter,
  resetPackStageLook,
  setPackStageLook,
  subscribePackStageLook,
  updatePackStageLook,
  type PackStageFaceSettings,
  type PackStageLightSettings,
  type PackStageLookSettings,
  type PackStageVideoGradeSettings,
} from './packStageLook'

export { useVideoTexture } from './useVideoTexture'
export {
  acquireVideoTexture,
  clearVideoTextureCache,
  getVideoTextureCacheStats,
  getVideoTextureForPlayback,
  makeVideoTextureCacheKey,
  pauseAllVideoTextures,
  preloadVideoTexture,
  releaseVideoTexture,
  resumePausedVideoTextures,
  setVideoTexturePlaying,
  subscribeVideoTextureReady,
  type VideoTextureCacheKeyInput,
  type VideoTextureCacheStats,
} from './videoTextureCache'
