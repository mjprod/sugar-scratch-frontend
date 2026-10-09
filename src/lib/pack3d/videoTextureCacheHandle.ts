export type VideoTextureCacheStats = {
  entries: number
  refs: number
  playing: number
  ready: number
}

/**
 * three-free entry point to the pack video texture cache. The global route
 * purge lives in the main bundle; importing videoTextureCache directly would
 * pull three.js into every page. The cache registers itself here when its
 * chunk loads — until then there is nothing to purge.
 */
export type VideoTextureCacheApi = {
  stats: () => VideoTextureCacheStats
  clear: () => VideoTextureCacheStats
  pauseAll: () => void
}

const EMPTY_STATS: VideoTextureCacheStats = { entries: 0, refs: 0, playing: 0, ready: 0 }

let api: VideoTextureCacheApi | null = null

export function registerVideoTextureCache(next: VideoTextureCacheApi) {
  api = next
}

export function getVideoTextureCacheStatsIfLoaded(): VideoTextureCacheStats {
  return api ? api.stats() : { ...EMPTY_STATS }
}

export function clearVideoTextureCacheIfLoaded(): VideoTextureCacheStats {
  return api ? api.clear() : { ...EMPTY_STATS }
}

export function pauseAllVideoTexturesIfLoaded() {
  api?.pauseAll()
}
