import { memo, useEffect, useRef, useState } from 'react'
import type { SwipeCardData } from '../constants/cards'
import { CARD_RADIUS } from '../constants/cards'
import { CardFaceOverlay } from '@/shared/ui/CardFaceOverlay'

type SwipeCardProps = {
  card: SwipeCardData
  /**
   * Mount a <video> element (front + one warm neighbor). Deeper cards stay on
   * API posters so iOS never decodes the full pile at once.
   */
  mountVideo?: boolean
  /** Call play() — live front / leaving flyer only. */
  playing?: boolean
  className?: string
}

/** WebKit autoplay only trusts muted + playsinline as real DOM attributes. */
function armIosAutoplay(video: HTMLVideoElement) {
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
}

/**
 * Drop decoder buffers for a swiped-off / demoted card.
 * Deferred one tick so React Strict Mode remounts don't wipe a still-live node.
 */
function releaseVideoDecoder(video: HTMLVideoElement) {
  try {
    video.pause()
  } catch {
    /* ignore */
  }

  window.setTimeout(() => {
    // Still in the tree → Strict Mode bounce or promote kept this element.
    if (video.isConnected) return
    if (!video.getAttribute('src') && !video.currentSrc) return

    try {
      video.removeAttribute('src')
      video.removeAttribute('poster')
      // Empty <source> children if any ever appear.
      while (video.firstChild) video.removeChild(video.firstChild)
      video.load()
    } catch {
      /* ignore */
    }
  }, 0)
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
  mountVideo = false,
  playing = false,
  className = '',
}: SwipeCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const readyUrlRef = useRef<string | null>(null)
  const overlay = card.overlay ?? null
  const posterUrl = card.posterUrl?.trim() || ''
  const isVideo = card.mediaType === 'video'
  // Warm neighbor may mount a paused decoder; only `playing` starts playback.
  const showVideo = isVideo && (mountVideo || playing)
  // Keep the still under the video so promote/demote never flashes black.
  const showPoster = Boolean(posterUrl)
  const mediaReady =
    !isVideo || Boolean(posterUrl) || (showVideo && ready)

  const setVideoNode = (video: HTMLVideoElement | null) => {
    videoRef.current = video
    if (!video) return
    // Arm before the first browser autoplay evaluation / play() attempt.
    armIosAutoplay(video)
  }

  // Keep ready sticky per URL; only drop it when the source actually changes.
  useEffect(() => {
    if (readyUrlRef.current === card.mediaUrl) return
    readyUrlRef.current = null
    setReady(false)
  }, [card.mediaUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !showVideo) return

    let cancelled = false
    let retryTimer: number | null = null

    armIosAutoplay(video)

    // Re-attach if a deferred discard / strict-mode bounce cleared src.
    if (video.getAttribute('src') !== card.mediaUrl) {
      video.src = card.mediaUrl
    }

    const markReady = () => {
      if (cancelled || video.readyState < 2) return
      readyUrlRef.current = card.mediaUrl
      setReady(true)
    }

    const tryPlay = () => {
      if (cancelled) return
      if (!playing) {
        video.pause()
        markReady()
        return
      }
      if (!video.paused && !video.ended) {
        markReady()
        return
      }

      armIosAutoplay(video)
      markReady()
      void video.play().then(markReady).catch(() => {
        // Retry from media listeners / delayed timers below.
      })
    }

    markReady()
    tryPlay()

    // Cover first-paint race after the stage becomes visible.
    if (playing) {
      retryTimer = window.setTimeout(() => {
        tryPlay()
        retryTimer = window.setTimeout(tryPlay, 280)
      }, 80)
    }

    video.addEventListener('loadeddata', tryPlay)
    video.addEventListener('canplay', tryPlay)
    video.addEventListener('canplaythrough', tryPlay)
    video.addEventListener('loadedmetadata', tryPlay)
    video.addEventListener('playing', markReady)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryPlay()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Do NOT call video.load() — it wipes the current frame and flashes black
    // even when the source is already cached.

    return () => {
      cancelled = true
      if (retryTimer != null) window.clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      video.removeEventListener('loadeddata', tryPlay)
      video.removeEventListener('canplay', tryPlay)
      video.removeEventListener('canplaythrough', tryPlay)
      video.removeEventListener('loadedmetadata', tryPlay)
      video.removeEventListener('playing', markReady)
      // Swiped-off / demoted out of the 2-video window: free iOS decoder memory.
      releaseVideoDecoder(video)
    }
  }, [card.mediaUrl, playing, showVideo])

  return (
    <div
      className={`swipe-card ${mediaReady ? 'is-ready' : 'is-loading'} ${className}`.trim()}
      style={{ borderRadius: CARD_RADIUS }}
    >
      <div className="swipe-card__media">
        {showPoster ? (
          <div
            className="swipe-card__image is-ready"
            role="img"
            aria-label={card.name}
            style={{ backgroundImage: `url(${posterUrl || card.mediaUrl})` }}
          />
        ) : null}
        {showVideo ? (
          <video
            ref={setVideoNode}
            src={card.mediaUrl}
            poster={posterUrl || undefined}
            className={ready ? 'is-ready' : undefined}
            muted
            loop
            playsInline
            autoPlay={playing}
            preload={playing ? 'auto' : 'metadata'}
            controls={false}
            disablePictureInPicture
            draggable={false}
            onLoadedData={(event) => {
              armIosAutoplay(event.currentTarget)
              if (event.currentTarget.readyState >= 2) {
                readyUrlRef.current = card.mediaUrl
                setReady(true)
              }
              if (playing) {
                void event.currentTarget.play().catch(() => {})
              }
            }}
            onCanPlay={(event) => {
              armIosAutoplay(event.currentTarget)
              if (playing) {
                void event.currentTarget.play().catch(() => {})
              }
            }}
            onPlaying={() => {
              readyUrlRef.current = card.mediaUrl
              setReady(true)
            }}
          />
        ) : null}
        {!isVideo && !showPoster ? (
          <div
            className="swipe-card__image is-ready"
            role="img"
            aria-label={card.name}
            style={{ backgroundImage: `url(${card.mediaUrl})` }}
          />
        ) : null}
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
