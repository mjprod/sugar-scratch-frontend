import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { RevealCard } from '../lib/cards'
import { CardFaceOverlay } from '@/shared/ui/CardFaceOverlay'

type FanCardProps = {
  card: RevealCard
  /** When true, start muted looping playback (entrance animation). */
  playing?: boolean
}

/**
 * Presentation-only card shell (no holo shine/glare effects).
 */
export function FanCard({ card, playing = false }: FanCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const { effect, overlay } = card
  const types = effect.types ?? 'fire'
  const subtypes = effect.subtypes ?? 'basic'
  const supertype = effect.supertype ?? 'pokémon'
  const rarity = effect.rarity.toLowerCase()

  // Keep videos paused while preloading; only play once the fan entrance starts.
  // Do not seek to 0 — that wipes the current picture and flashes black.
  useEffect(() => {
    const video = videoRef.current
    if (!video || card.mediaType !== 'video') return

    const markReady = () => {
      if (video.readyState >= 2) setVideoReady(true)
    }
    markReady()
    video.addEventListener('loadeddata', markReady)
    video.addEventListener('canplay', markReady)

    if (playing) {
      void video.play().catch(() => {
        // Muted + playsInline should allow autoplay; ignore rejections.
      })
    } else {
      video.pause()
    }

    return () => {
      video.removeEventListener('loadeddata', markReady)
      video.removeEventListener('canplay', markReady)
    }
  }, [card.mediaType, card.mediaUrl, playing])

  const style = {
    '--pointer-x': '50%',
    '--pointer-y': '50%',
    '--pointer-from-center': 0,
    '--pointer-from-top': 0.5,
    '--pointer-from-left': 0.5,
    // Force foil/shine stacks off (matches sugar-scratch-holo holo-disabled).
    '--card-opacity': 0,
    '--background-x': '50%',
    '--background-y': '50%',
    '--rotate-x': '0deg',
    '--rotate-y': '0deg',
    '--flip-y': '0deg',
    '--card-scale': 1,
    '--translate-x': '0px',
    '--translate-y': '0px',
    '--card-aspect': 0.528421,
  } as CSSProperties

  return (
    <div className="fan-card">
      <div
        className={`card ${types} interactive full-bleed holo-disabled`}
        data-number=""
        data-set=""
        data-subtypes={subtypes}
        data-supertype={supertype}
        data-rarity={rarity}
        data-trainer-gallery={effect.trainerGallery ? 'true' : 'false'}
        style={style}
      >
        <div className="card__translater">
          <div className="card__rotator" aria-hidden="true">
            <div className="card__back">
              <div
                className="card__media card__media--image"
                role="img"
                aria-label={`${card.name} back`}
                style={{ backgroundImage: `url(${card.backUrl})` }}
              />
            </div>
            <div className="card__front">
              {card.mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={card.mediaUrl}
                  className={videoReady ? 'is-ready' : undefined}
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
                  className="card__media card__media--image"
                  role="img"
                  aria-label={card.name}
                  style={{ backgroundImage: `url(${card.mediaUrl})` }}
                />
              )}
              {overlay ? (
                <CardFaceOverlay
                  name={overlay.name || card.name}
                  city={overlay.city}
                  country={overlay.country}
                  flagEmoji={overlay.flagEmoji}
                  flagSvgUrl={overlay.flagSvgUrl}
                  gradientColor={overlay.gradientColor}
                  gradientColorEnd={overlay.gradientColorEnd}
                  cardNumber={overlay.cardNumber}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
