import { memo, useEffect, useRef, useState } from 'react'
import type { SwipeCardData } from '../constants/cards'
import { CARD_RADIUS } from '../constants/cards'
import { CardFaceOverlay } from '@/shared/ui/CardFaceOverlay'

type SwipeCardProps = {
  card: SwipeCardData
  /** Front + next-in-stack only should be true for video perf. */
  playing?: boolean
  className?: string
}

/**
 * Simplified fan-card shell: same aspect media treatment, no holo CSS.
 * Video stays hidden until the first frame is ready to avoid a black flash.
 * Memoized so parent re-renders (drag springs) don't thrash media state.
 *
 * Home cards mount the shared CardFaceOverlay (no card number) with
 * swipe-specific border/strip tokens in swipe.css.
 */
export const SwipeCard = memo(function SwipeCard({
  card,
  playing = false,
  className = '',
}: SwipeCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const readyUrlRef = useRef<string | null>(null)
  const overlay = card.overlay ?? null

  // Keep ready sticky per URL; only drop it when the source actually changes.
  useEffect(() => {
    if (readyUrlRef.current === card.mediaUrl) return
    readyUrlRef.current = null
    setReady(false)
  }, [card.mediaUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video || card.mediaType !== 'video') return

    let cancelled = false

    const markReady = () => {
      if (cancelled || video.readyState < 2) return
      readyUrlRef.current = card.mediaUrl
      setReady(true)
    }

    markReady()
    video.addEventListener('loadeddata', markReady)
    video.addEventListener('canplay', markReady)
    video.addEventListener('canplaythrough', markReady)
    video.addEventListener('loadedmetadata', markReady)
    // Do NOT call video.load() — it wipes the current frame and flashes black
    // even when the source is already cached.

    return () => {
      cancelled = true
      video.removeEventListener('loadeddata', markReady)
      video.removeEventListener('canplay', markReady)
      video.removeEventListener('canplaythrough', markReady)
      video.removeEventListener('loadedmetadata', markReady)
    }
  }, [card.mediaType, card.mediaUrl])

  // Play/pause without seeking — seeking would flash a black frame.
  // When we start playing a paused under-card, re-check ready so a cached
  // first frame can fade in even if loadeddata already fired while paused.
  useEffect(() => {
    const video = videoRef.current
    if (!video || card.mediaType !== 'video') return

    if (playing) {
      if (video.readyState >= 2) {
        readyUrlRef.current = card.mediaUrl
        setReady(true)
      }
      void video.play().catch(() => {
        // Muted + playsInline should allow autoplay; ignore rejections.
      })
      return
    }

    video.pause()
  }, [card.mediaType, card.mediaUrl, playing])

  return (
    <div
      className={`swipe-card ${ready ? 'is-ready' : 'is-loading'} ${className}`.trim()}
      style={{ borderRadius: CARD_RADIUS }}
    >
      <div className="swipe-card__media">
        {card.mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={card.mediaUrl}
            className={ready ? 'is-ready' : undefined}
            muted
            loop
            playsInline
            preload="auto"
            controls={false}
            disablePictureInPicture
            draggable={false}
          />
        ) : (
          <div
            className="swipe-card__image is-ready"
            role="img"
            aria-label={card.name}
            style={{ backgroundImage: `url(${card.mediaUrl})` }}
          />
        )}
      </div>

      {/* Same HTML overlay as collection/reveal — no cardNumber on home. */}
      {overlay ? (
        <CardFaceOverlay
          name={overlay.name}
          city={overlay.city}
          country={overlay.country}
          flagEmoji={overlay.flagEmoji}
          flagSvgUrl={overlay.flagSvgUrl}
          gradientColor={overlay.gradientColor}
          gradientColorEnd={overlay.gradientColorEnd}
        />
      ) : null}

      {/* Name sits above media so layout doesn't pop when video fades in. */}
      <div className="swipe-card__meta">
        <span className="swipe-card__name">{card.name}</span>
        {card.socialhandle?.trim() ? (
          <span className="swipe-card__socialhandle">{card.socialhandle}</span>
        ) : null}
      </div>
    </div>
  )
})
