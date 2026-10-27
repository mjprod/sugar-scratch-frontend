import { useEffect, useState } from 'react'
import type { CanvasTexture } from 'three'
import { normalizeMediaUrl } from '@/lib/mediaUrl'
import { PACK_TEXTURE_SIZE_DESKTOP, type VideoFitMode, type VideoTextureTransform } from './assets'
import { createPackFaceCanvas, paintPackFaceSource } from './videoTextureCache'

/** Live video once a frame is ready; poster otherwise (side packs / pre-decode). */
export function pickPackFaceTexture<T>(
  video: { texture: T | null; isReady: boolean } | null,
  poster: T | null,
): T | null {
  if (video?.isReady && video.texture) return video.texture
  return poster
}

/**
 * Pack-face still from the API poster, framed like the video texture.
 * Side packs keep this; the front pack swaps to video when a frame is ready.
 */
export function usePosterTexture(
  posterUrl: string | undefined,
  fitMode: VideoFitMode,
  textureTransform: VideoTextureTransform,
  options: { flipY?: boolean; textureSize?: number } = {},
): { texture: CanvasTexture | null } {
  const flipY = options.flipY ?? true
  const textureSize = options.textureSize ?? PACK_TEXTURE_SIZE_DESKTOP
  const [texture, setTexture] = useState<CanvasTexture | null>(null)

  useEffect(() => {
    const url = normalizeMediaUrl(posterUrl?.trim() || '')
    if (!url) {
      setTexture(null)
      return
    }

    let cancelled = false
    let painted: CanvasTexture | null = null
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (cancelled) return
      const { context, texture: next } = createPackFaceCanvas(textureSize, flipY)
      paintPackFaceSource(
        context,
        next,
        image,
        image.naturalWidth,
        image.naturalHeight,
        fitMode,
        textureTransform,
      )
      painted = next
      setTexture(next)
    }
    image.onerror = () => {
      if (!cancelled) setTexture(null)
    }
    image.src = url

    return () => {
      cancelled = true
      painted?.dispose()
      setTexture(null)
    }
  }, [fitMode, flipY, posterUrl, textureSize, textureTransform])

  return { texture }
}
