import { useEffect } from 'react'
import type { SwipeCardData } from '../constants/cards'

type VideoPreloaderProps = {
  cards: SwipeCardData[]
  /** Fires once unique video URLs are warm enough (or immediately if none). */
  onReady?: () => void
}

function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 4000) {
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      video.removeEventListener('loadeddata', finish)
      video.removeEventListener('canplay', finish)
      video.removeEventListener('error', finish)
      resolve()
    }

    const timer = window.setTimeout(finish, timeoutMs)

    // Already decodable / cached.
    if (video.readyState >= 2) {
      finish()
      return
    }

    video.addEventListener('loadeddata', finish, { once: true })
    video.addEventListener('canplay', finish, { once: true })
    video.addEventListener('error', finish, { once: true })
  })
}

/**
 * Warms the browser media cache for upcoming videos so stack entries
 * don't flash black while the first frame decodes.
 */
export function VideoPreloader({ cards, onReady }: VideoPreloaderProps) {
  useEffect(() => {
    let cancelled = false

    const urls = [
      ...new Set(
        cards
          .filter((card) => card.mediaType === 'video')
          .map((card) => card.mediaUrl),
      ),
    ]

    const videos = urls.map((url) => {
      const video = document.createElement('video')
      video.muted = true
      video.preload = 'auto'
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.src = url
      // Kick off fetch/decode without attaching to the DOM.
      video.load()
      return video
    })

    void (async () => {
      if (videos.length === 0) {
        if (!cancelled) onReady?.()
        return
      }
      await Promise.all(videos.map((video) => waitForVideoReady(video)))
      if (!cancelled) onReady?.()
    })()

    return () => {
      cancelled = true
      for (const video of videos) {
        video.removeAttribute('src')
        video.load()
      }
    }
  }, [cards, onReady])

  return null
}
