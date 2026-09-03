import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { normalizeMediaUrl } from "@/services/models";
import type { VideoFitMode, VideoTextureTransform } from './assets'
import {
  getPackStageVideoFilter,
  subscribePackStageLook,
} from './packStageLook'

const PLAYING_FRAME_INTERVAL_MS = 1000 / 30
const IDLE_EVICT_MS = 45_000

export interface VideoTextureCacheKeyInput {
  videoUrl: string
  fitMode: VideoFitMode
  textureTransform: VideoTextureTransform
  flipY: boolean
  textureSize: number
}

interface CacheEntry {
  key: string
  videoUrl: string
  fitMode: VideoFitMode
  textureTransform: VideoTextureTransform
  flipY: boolean
  textureSize: number
  video: HTMLVideoElement
  // Frozen still used by non-focused packs that share this video.
  stillCanvas: HTMLCanvasElement
  stillContext: CanvasRenderingContext2D
  stillTexture: CanvasTexture
  // Live canvas used only while at least one consumer is playing.
  liveCanvas: HTMLCanvasElement
  liveContext: CanvasRenderingContext2D
  liveTexture: CanvasTexture
  refCount: number
  playingCount: number
  /** Restored by resumePausedVideoTextures after pauseAllVideoTextures. */
  pausedPlayingCount: number
  isReady: boolean
  error: string | null
  frameId: number
  lastDrawAt: number
  readyListeners: Set<() => void>
  errorListeners: Set<(message: string) => void>
  evictTimer: number | null
}

const cache = new Map<string, CacheEntry>()

function serializeTransform(transform: VideoTextureTransform) {
  return [
    transform.offsetX,
    transform.offsetY,
    transform.scaleX,
    transform.scaleY,
    transform.rotation,
  ].join(':')
}

function resolveVideoTextureUrl(videoUrl: string): string {
  // Force API media (e.g. https://host/models/.../pack-face.mp4) onto the
  // Vite same-origin proxy path so canvas-backed Three.js textures stay CORS-safe.
  return normalizeMediaUrl(videoUrl) || videoUrl
}

export function makeVideoTextureCacheKey(input: VideoTextureCacheKeyInput): string {
  return [
    resolveVideoTextureUrl(input.videoUrl),
    input.fitMode,
    serializeTransform(input.textureTransform),
    input.flipY ? '1' : '0',
    String(input.textureSize),
  ].join('|')
}

function createCanvasTexture(
  size: number,
  flipY: boolean,
): {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  texture: CanvasTexture
} {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    throw new Error('Canvas context is not available in this browser.')
  }

  context.fillStyle = '#040608'
  context.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.flipY = flipY
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true

  return { canvas, context, texture }
}

function drawVideoToContext(
  entry: CacheEntry,
  context: CanvasRenderingContext2D,
  texture: CanvasTexture,
) {
  const { video, textureSize, fitMode, textureTransform } = entry

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return
  }

  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = 1

  let drawWidth = textureSize
  let drawHeight = textureSize
  let offsetX = 0
  let offsetY = 0

  if (fitMode === 'stretch') {
    drawWidth = textureSize
    drawHeight = textureSize
  } else if (fitMode === 'cover') {
    if (sourceRatio > targetRatio) {
      drawHeight = textureSize
      drawWidth = drawHeight * sourceRatio
      offsetX = (textureSize - drawWidth) / 2
    } else {
      drawWidth = textureSize
      drawHeight = drawWidth / sourceRatio
      offsetY = (textureSize - drawHeight) / 2
    }
  } else if (sourceRatio > targetRatio) {
    drawWidth = textureSize
    drawHeight = drawWidth / sourceRatio
    offsetY = (textureSize - drawHeight) / 2
  } else {
    drawHeight = textureSize
    drawWidth = drawHeight * sourceRatio
    offsetX = (textureSize - drawWidth) / 2
  }

  context.fillStyle = '#040608'
  context.fillRect(0, 0, textureSize, textureSize)

  context.save()
  // Live grade from PackStageDebug (brightness / contrast / saturation).
  context.filter = getPackStageVideoFilter()
  context.translate(
    textureSize / 2 + textureTransform.offsetX * textureSize,
    textureSize / 2 + textureTransform.offsetY * textureSize,
  )
  context.rotate((textureTransform.rotation * Math.PI) / 180)
  context.scale(textureTransform.scaleX, textureTransform.scaleY)
  context.drawImage(
    video,
    offsetX - textureSize / 2,
    offsetY - textureSize / 2,
    drawWidth,
    drawHeight,
  )
  context.restore()
  context.filter = 'none'

  texture.needsUpdate = true
}

function drawLiveFrame(entry: CacheEntry) {
  drawVideoToContext(entry, entry.liveContext, entry.liveTexture)
  entry.lastDrawAt = performance.now()
}

function drawStillFrame(entry: CacheEntry) {
  drawVideoToContext(entry, entry.stillContext, entry.stillTexture)
}

/** Re-grade cached stills/live frames when PackStageDebug video sliders change. */
function redrawAllEntriesForGrade() {
  for (const entry of cache.values()) {
    if (entry.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) continue
    if (entry.playingCount > 0) {
      drawLiveFrame(entry)
    }
    // Always refresh stills so off-center packs pick up the grade.
    drawStillFrame(entry)
  }
}

if (typeof window !== 'undefined') {
  let lastFilter = getPackStageVideoFilter()
  subscribePackStageLook(() => {
    const next = getPackStageVideoFilter()
    if (next === lastFilter) return
    lastFilter = next
    redrawAllEntriesForGrade()
  })
}

function copyLiveToStill(entry: CacheEntry) {
  entry.stillContext.drawImage(entry.liveCanvas, 0, 0)
  entry.stillTexture.needsUpdate = true
}

function stopLoop(entry: CacheEntry) {
  if (entry.frameId) {
    window.cancelAnimationFrame(entry.frameId)
    entry.frameId = 0
  }
}

function startLoop(entry: CacheEntry) {
  if (entry.frameId || entry.playingCount <= 0) {
    return
  }

  const tick = (now: number) => {
    if (entry.playingCount <= 0 || entry.refCount <= 0) {
      entry.frameId = 0
      return
    }

    if (
      now - entry.lastDrawAt >= PLAYING_FRAME_INTERVAL_MS &&
      entry.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      drawLiveFrame(entry)
    }

    entry.frameId = window.requestAnimationFrame(tick)
  }

  entry.frameId = window.requestAnimationFrame(tick)
}

function freeCanvas(canvas: HTMLCanvasElement) {
  // Zeroing dimensions is the most reliable way to drop canvas bitmap memory
  // (decoded video frames / stills) in Safari and Chrome.
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, 1, 1)
}

function destroyEntry(entry: CacheEntry) {
  stopLoop(entry)

  if (entry.evictTimer !== null) {
    window.clearTimeout(entry.evictTimer)
    entry.evictTimer = null
  }

  entry.playingCount = 0
  entry.refCount = 0
  entry.readyListeners.clear()
  entry.errorListeners.clear()

  try {
    entry.video.pause()
  } catch {
    // ignore
  }
  // Detach media thoroughly so the browser can drop the decoder / demuxer.
  try {
    entry.video.removeAttribute('src')
    entry.video.removeAttribute('srcObject')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(entry.video as any).srcObject = null
    entry.video.load()
  } catch {
    // ignore
  }

  try {
    entry.stillTexture.dispose()
    entry.liveTexture.dispose()
  } catch {
    // ignore
  }

  freeCanvas(entry.stillCanvas)
  freeCanvas(entry.liveCanvas)

  cache.delete(entry.key)
}

function ensureEntry(input: VideoTextureCacheKeyInput): CacheEntry {
  const key = makeVideoTextureCacheKey(input)
  const existing = cache.get(key)
  if (existing) {
    if (existing.evictTimer !== null) {
      window.clearTimeout(existing.evictTimer)
      existing.evictTimer = null
    }
    return existing
  }

  const still = createCanvasTexture(input.textureSize, input.flipY)
  const live = createCanvasTexture(input.textureSize, input.flipY)

  const resolvedVideoUrl = resolveVideoTextureUrl(input.videoUrl)

  const video = document.createElement('video')
  video.src = resolvedVideoUrl
  video.muted = true
  video.loop = true
  video.autoplay = false
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')

  const entry: CacheEntry = {
    key,
    videoUrl: resolvedVideoUrl,
    fitMode: input.fitMode,
    textureTransform: input.textureTransform,
    flipY: input.flipY,
    textureSize: input.textureSize,
    video,
    stillCanvas: still.canvas,
    stillContext: still.context,
    stillTexture: still.texture,
    liveCanvas: live.canvas,
    liveContext: live.context,
    liveTexture: live.texture,
    refCount: 0,
    playingCount: 0,
    pausedPlayingCount: 0,
    isReady: false,
    error: null,
    frameId: 0,
    lastDrawAt: 0,
    readyListeners: new Set(),
    errorListeners: new Set(),
    evictTimer: null,
  }

  const handleLoadedData = () => {
    entry.isReady = true
    // Seed still/live so focused/unfocused packs have content immediately.
    drawStillFrame(entry)
    drawLiveFrame(entry)
    for (const listener of entry.readyListeners) {
      listener()
    }
  }

  const handleError = () => {
    entry.error = 'Could not load the selected video file.'
    for (const listener of entry.errorListeners) {
      listener(entry.error)
    }
  }

  video.addEventListener('loadeddata', handleLoadedData)
  video.addEventListener('error', handleError)
  video.load()

  cache.set(key, entry)
  return entry
}

export function acquireVideoTexture(input: VideoTextureCacheKeyInput): CacheEntry {
  const entry = ensureEntry(input)
  entry.refCount += 1

  if (entry.evictTimer !== null) {
    window.clearTimeout(entry.evictTimer)
    entry.evictTimer = null
  }

  return entry
}

/**
 * Warm the shared video-texture cache without starting playback.
 * Returns a disposer that releases the held cache ref.
 */
export function preloadVideoTexture(input: VideoTextureCacheKeyInput): () => void {
  const entry = acquireVideoTexture(input)
  return () => releaseVideoTexture(entry.key)
}

export function releaseVideoTexture(key: string) {
  const entry = cache.get(key)
  if (!entry) {
    return
  }

  entry.refCount = Math.max(0, entry.refCount - 1)

  if (entry.refCount === 0) {
    entry.playingCount = 0
    stopLoop(entry)
    try {
      entry.video.pause()
    } catch {
      // ignore
    }

    // Keep decoded stills around so scrolling back is instant.
    entry.evictTimer = window.setTimeout(() => {
      if (entry.refCount === 0) {
        destroyEntry(entry)
      }
    }, IDLE_EVICT_MS)
  }
}

export type VideoTextureCacheStats = {
  entries: number
  refs: number
  playing: number
  ready: number
}

/** Snapshot of shared pack-face video texture cache pressure. */
export function getVideoTextureCacheStats(): VideoTextureCacheStats {
  let refs = 0
  let playing = 0
  let ready = 0
  for (const entry of cache.values()) {
    refs += entry.refCount
    playing += entry.playingCount
    if (entry.isReady) ready += 1
  }
  return { entries: cache.size, refs, playing, ready }
}

/**
 * Immediately destroy every cached pack video + canvas texture.
 * Use when leaving GPU-heavy routes (e.g. /packs) so decoded video frames
 * and WebGL-related canvas bitmaps don't linger for IDLE_EVICT_MS.
 *
 * Safe to call even if some entries still have refs — those consumers should
 * already be unmounting; force-clear prioritizes memory recovery.
 */
export function clearVideoTextureCache(): VideoTextureCacheStats {
  const before = getVideoTextureCacheStats()
  // Copy first — destroyEntry mutates the map.
  const entries = Array.from(cache.values())
  for (const entry of entries) {
    destroyEntry(entry)
  }
  return before
}

/** Pause every cached video without disposing textures (tab hide / soft leave). */
export function pauseAllVideoTextures() {
  for (const entry of cache.values()) {
    if (entry.playingCount > 0) {
      entry.pausedPlayingCount = entry.playingCount
    }
    entry.playingCount = 0
    stopLoop(entry)
    try {
      entry.video.pause()
    } catch {
      // ignore
    }
  }
}

/** Resume entries that were playing when pauseAllVideoTextures ran. */
export function resumePausedVideoTextures() {
  for (const entry of cache.values()) {
    const resumeCount = entry.pausedPlayingCount
    if (resumeCount <= 0) continue
    entry.pausedPlayingCount = 0
    entry.playingCount = resumeCount
    void entry.video.play().catch(() => {
      // Muted autoplay should work; fail gracefully if blocked.
    })
    if (entry.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      drawLiveFrame(entry)
    }
    startLoop(entry)
  }
}

export function setVideoTexturePlaying(key: string, playing: boolean) {
  const entry = cache.get(key)
  if (!entry) {
    return
  }

  if (playing) {
    entry.pausedPlayingCount = 0
    entry.playingCount += 1
    if (entry.playingCount === 1) {
      // Start live updates for the focused pack only.
      void entry.video.play().catch(() => {
        // Muted autoplay should work in modern browsers, but we fail gracefully.
      })
      if (entry.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        drawLiveFrame(entry)
      }
      startLoop(entry)
    }
    return
  }

  entry.playingCount = Math.max(0, entry.playingCount - 1)
  if (entry.playingCount === 0) {
    // Freeze current frame into the still texture used by non-focused packs.
    if (entry.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      drawLiveFrame(entry)
      copyLiveToStill(entry)
    }
    entry.video.pause()
    stopLoop(entry)
  }
}

export function getVideoTextureForPlayback(
  key: string,
  playing: boolean,
  _soft = false,
): CanvasTexture | null {
  const entry = cache.get(key)
  if (!entry) {
    return null
  }

  return playing ? entry.liveTexture : entry.stillTexture
}

export function subscribeVideoTextureReady(
  key: string,
  onReady: () => void,
  onError: (message: string) => void,
) {
  const entry = cache.get(key)
  if (!entry) {
    return () => undefined
  }

  entry.readyListeners.add(onReady)
  entry.errorListeners.add(onError)

  if (entry.isReady) {
    onReady()
  }
  if (entry.error) {
    onError(entry.error)
  }

  return () => {
    entry.readyListeners.delete(onReady)
    entry.errorListeners.delete(onError)
  }
}
