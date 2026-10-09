import { useEffect } from 'react'
import type { SwipeCardData } from '../constants/cards'

type VideoPreloaderProps = {
  cards: SwipeCardData[]
  /** Fires once stack posters are warm enough (or immediately if none). */
  onReady?: () => void
}

function waitForImageReady(url: string, timeoutMs = 4000) {
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve()
    }

    const timer = window.setTimeout(finish, timeoutMs)
    const image = new Image()
    image.decoding = 'async'
    image.onload = finish
    image.onerror = finish
    image.src = url
    if (image.complete) finish()
  })
}

/**
 * Warms stack posters only.
 *
 * Do NOT off-DOM preload the active video URLs — a second hidden decoder for the
 * same src races the on-screen <video> on iOS and leaves first-land paused until
 * a touch. The mounted SwipeCard elements own decode + autoplay themselves.
 */
export function VideoPreloader({ cards, onReady }: VideoPreloaderProps) {
  useEffect(() => {
    let cancelled = false

    const posterUrls = new Set<string>()
    for (const card of cards) {
      const poster = card.posterUrl?.trim()
      if (poster) posterUrls.add(poster)
    }

    void (async () => {
      const urls = [...posterUrls]
      if (urls.length === 0) {
        if (!cancelled) onReady?.()
        return
      }

      await Promise.all(urls.map((url) => waitForImageReady(url)))
      if (!cancelled) onReady?.()
    })()

    return () => {
      cancelled = true
    }
  }, [cards, onReady])

  return null
}
