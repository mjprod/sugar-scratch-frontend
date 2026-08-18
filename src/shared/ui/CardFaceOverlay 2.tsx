import type { CSSProperties } from 'react'
import {
  DEFAULT_OVERLAY_BACKGROUND_COLOR,
  DEFAULT_OVERLAY_BACKGROUND_COLOR_END,
  type SharedMedia,
} from '@/shared/catalog/characters'
import './CardFaceOverlay.css'

export type CardFaceOverlayData = {
  /** Display name on the card face (usually girlName). */
  name: string
  city?: string
  country?: string
  flagEmoji?: string
  flagSvgUrl?: string
  /** Top/start hex stop for the overlay gradient. */
  gradientColor?: string
  /** Bottom/end hex stop for the overlay gradient. */
  gradientColorEnd?: string
  /** Optional card number label, e.g. "01" or "P02". */
  cardNumber?: string
}

export type CardFaceOverlayProps = CardFaceOverlayData & {
  className?: string
}

/** Build overlay props from shared catalog identity. */
export function cardFaceOverlayFromShared(
  shared?: Pick<
    SharedMedia,
    | 'girlName'
    | 'influencerCity'
    | 'influencerCountry'
    | 'flagEmoji'
    | 'flagSvgUrl'
    | 'overlayBackgroundColor'
    | 'overlayBackgroundColorEnd'
  > | null,
  nameOverride?: string | null,
): CardFaceOverlayData {
  const name =
    (nameOverride ?? '').trim() ||
    shared?.girlName?.trim() ||
    ''
  return {
    name,
    city: shared?.influencerCity?.trim() || '',
    country: shared?.influencerCountry?.trim() || '',
    flagEmoji: shared?.flagEmoji?.trim() || '',
    flagSvgUrl: shared?.flagSvgUrl?.trim() || '',
    gradientColor:
      shared?.overlayBackgroundColor?.trim() ||
      DEFAULT_OVERLAY_BACKGROUND_COLOR,
    gradientColorEnd:
      shared?.overlayBackgroundColorEnd?.trim() ||
      DEFAULT_OVERLAY_BACKGROUND_COLOR_END,
  }
}

function locationLabel(city?: string, country?: string): string {
  const parts = [city?.trim(), country?.trim()].filter(Boolean) as string[]
  return parts.join(', ')
}

/**
 * Scaffold HTML overlay for card fronts
 * (collection coverflow + reveal/pack fan + home swipe).
 *
 * Sizing tokens live on `.card-face-overlay` (see CardFaceOverlay.css).
 * Fan cards override via `.fan-card .card-face-overlay` for a narrower strip.
 * Home swipe overrides via `.swipe-card > .card-face-overlay` (shorter border,
 * no card number, bottom pad clears the meta bar).
 *
 * Structure:
 *   .card-face-overlay
 *     .innerBorder
 *     .innerCardContent
 *       .cardNumber
 *       .influencerNameAndLocationRow
 *         .influencerNameAndLocationRow__text
 *           .influencerName
 *           .influencerLocation
 *       .influencerFlag
 */
export function CardFaceOverlay({
  name,
  city,
  country,
  flagEmoji,
  flagSvgUrl,
  gradientColor,
  gradientColorEnd,
  cardNumber,
  className,
}: CardFaceOverlayProps) {
  const displayName = name.trim()
  const location = locationLabel(city, country)
  const emoji = flagEmoji?.trim() || ''
  const svg = flagSvgUrl?.trim() || ''
  const number = cardNumber?.trim() || ''
  const colorStart =
    gradientColor?.trim() || DEFAULT_OVERLAY_BACKGROUND_COLOR
  const colorEnd =
    gradientColorEnd?.trim() || DEFAULT_OVERLAY_BACKGROUND_COLOR_END

  if (!displayName && !location && !emoji && !svg && !number) return null

  const style = {
    '--overlay-gradient-color': colorStart,
    '--overlay-gradient-color-end': colorEnd,
  } as CSSProperties

  return (
    <div
      className={['card-face-overlay', className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    >
      {/* Highest z-index within the overlay */}
      <div className="innerBorder" />

      {/* Content strip — lower z-index than border */}
      <div className="innerCardContent">
        {number ? <div className="cardNumber">{number}</div> : null}

        {(displayName || location) && (
          <div className="influencerNameAndLocationRow">
            {/*
              Fills remaining flex space. sideways-lr text runs bottom → top:
              name near the flag, location above.
            */}
            <div className="influencerNameAndLocationRow__text">
              {displayName ? (
                <div className="influencerName">{displayName}</div>
              ) : null}
              {location ? (
                <div className="influencerLocation">{location}</div>
              ) : null}
            </div>
          </div>
        )}

        {(svg || emoji) && (
          <div className="influencerFlag">
            {svg ? (
              <img src={svg} alt="" draggable={false} />
            ) : (
              <span className="influencerFlag__emoji">{emoji}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
