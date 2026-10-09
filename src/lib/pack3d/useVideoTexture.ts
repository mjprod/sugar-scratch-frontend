import { useEffect, useRef, useState } from 'react'
import type { CanvasTexture } from 'three'
import { PACK_TEXTURE_SIZE_DESKTOP, type VideoFitMode, type VideoTextureTransform } from './assets'
import {
  acquireVideoTexture,
  getVideoTextureForPlayback,
  makeVideoTextureCacheKey,
  releaseVideoTexture,
  setVideoTexturePlaying,
  subscribeVideoTextureReady,
} from './videoTextureCache'

const DEFAULT_TEXTURE_SIZE = PACK_TEXTURE_SIZE_DESKTOP

interface VideoTextureOptions {
  flipY?: boolean
  playing?: boolean
  textureSize?: number
  /** When false, skip attaching to a cached texture entirely. */
  enabled?: boolean
  /** Use a soft/blurred still (for unselected packs while one is active). */
  soft?: boolean
}

interface VideoTextureState {
  texture: CanvasTexture | null
  isReady: boolean
  error: string | null
}

export function useVideoTexture(
  videoUrl: string,
  fitMode: VideoFitMode,
  textureTransform: VideoTextureTransform,
  flipYOrOptions: boolean | VideoTextureOptions = true,
  playingArg = true,
  textureSizeArg = DEFAULT_TEXTURE_SIZE,
): VideoTextureState {
  const options: Required<VideoTextureOptions> =
    typeof flipYOrOptions === 'boolean'
      ? {
          flipY: flipYOrOptions,
          playing: playingArg,
          textureSize: textureSizeArg,
          enabled: true,
          soft: false,
        }
      : {
          flipY: flipYOrOptions.flipY ?? true,
          playing: flipYOrOptions.playing ?? true,
          textureSize: flipYOrOptions.textureSize ?? DEFAULT_TEXTURE_SIZE,
          enabled: flipYOrOptions.enabled ?? true,
          soft: flipYOrOptions.soft ?? false,
        }

  const { flipY, playing, textureSize, enabled, soft } = options
  const [texture, setTexture] = useState<CanvasTexture | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheKeyRef = useRef<string | null>(null)
  const isPlayingRef = useRef(false)
  const softRef = useRef(soft)

  useEffect(() => {
    softRef.current = soft
  }, [soft])

  useEffect(() => {
    if (!enabled) {
      if (cacheKeyRef.current && isPlayingRef.current) {
        setVideoTexturePlaying(cacheKeyRef.current, false)
        isPlayingRef.current = false
      }
      if (cacheKeyRef.current) {
        releaseVideoTexture(cacheKeyRef.current)
        cacheKeyRef.current = null
      }
      setTexture(null)
      setIsReady(false)
      setError(null)
      return
    }

    let cancelled = false
    const key = makeVideoTextureCacheKey({
      videoUrl,
      fitMode,
      textureTransform,
      flipY,
      textureSize,
    })

    try {
      const entry = acquireVideoTexture({
        videoUrl,
        fitMode,
        textureTransform,
        flipY,
        textureSize,
      })

      cacheKeyRef.current = key
      setIsReady(entry.isReady)
      setError(entry.error)
      setTexture(getVideoTextureForPlayback(key, playing, soft))

      const unsubscribe = subscribeVideoTextureReady(
        key,
        () => {
          if (!cancelled) {
            setIsReady(true)
            setError(null)
            setTexture(
              getVideoTextureForPlayback(
                key,
                isPlayingRef.current || playing,
                softRef.current,
              ),
            )
          }
        },
        (message) => {
          if (!cancelled) {
            setError(message)
          }
        },
      )

      if (playing) {
        setVideoTexturePlaying(key, true)
        isPlayingRef.current = true
        setTexture(getVideoTextureForPlayback(key, true, false))
      } else {
        isPlayingRef.current = false
        setTexture(getVideoTextureForPlayback(key, false, soft))
      }

      return () => {
        cancelled = true
        unsubscribe()
        if (isPlayingRef.current) {
          setVideoTexturePlaying(key, false)
          isPlayingRef.current = false
        }
        releaseVideoTexture(key)
        if (cacheKeyRef.current === key) {
          cacheKeyRef.current = null
        }
      }
    } catch (acquireError) {
      setTexture(null)
      setIsReady(false)
      setError(
        acquireError instanceof Error
          ? acquireError.message
          : 'Could not create video texture.',
      )
      return
    }
    // playing/soft are handled below so we can swap live/still/soft without re-acquiring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fitMode, flipY, textureSize, textureTransform, videoUrl])

  useEffect(() => {
    const key = cacheKeyRef.current
    if (!enabled || !key) {
      return
    }

    if (playing && !isPlayingRef.current) {
      setVideoTexturePlaying(key, true)
      isPlayingRef.current = true
      setTexture(getVideoTextureForPlayback(key, true, false))
      return
    }

    if (!playing && isPlayingRef.current) {
      setVideoTexturePlaying(key, false)
      isPlayingRef.current = false
      setTexture(getVideoTextureForPlayback(key, false, soft))
      return
    }

    if (!playing) {
      setTexture(getVideoTextureForPlayback(key, false, soft))
    }
  }, [enabled, playing, soft])

  return { texture, isReady, error }
}
