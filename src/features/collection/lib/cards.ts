export type MediaType = 'image' | 'video'
import {
  DEFAULT_EFFECT_INDEX,
  DEFAULT_MEDIA_URL,
} from './effects'
import {
  DEFAULT_HOLO_TRANSFORM,
  normalizeHoloTransform,
  type HoloTransform,
} from './holoTransform'

export const DEFAULT_BACK_URL = '/img/SugarScratch.png'

/** Shown on card faces until API media is available (or when it fails). */
export const PLACEHOLDER_MEDIA_URL = '/img/placeholder.png'

/** Identity badge rendered on the card face (shared influencer fields). */
export type CardFaceOverlayConfig = {
  name: string
  city?: string
  country?: string
  flagEmoji?: string
  flagSvgUrl?: string
  gradientColor?: string
  gradientColorEnd?: string
  /** Optional card number label, e.g. "01". */
  cardNumber?: string
}

export type CardConfig = {
  id: string
  name: string
  mediaType: MediaType
  mediaUrl: string
  backMediaType: MediaType
  backUrl: string
  effectIndex: number
  foilUrl: string
  maskUrl: string
  fullBleed: boolean
  backHolo: boolean
  flipAngle: number
  /** Live-tuned holo size/position for the custom pack aspect. */
  holoTransform: HoloTransform
  /**
   * Optional themed group (up to 3 consecutive cards share the same id).
   * Empty/undefined = ungrouped.
   */
  groupId: string
  /** Theme label drawn on the group stroke (from the first card in the group). */
  groupTheme: string
  /**
   * Optional play-count override for the caption meta ("Nx") and stack-backs.
   * When unset, a deterministic count is derived from the card id.
   */
  videoCardCount?: number
  /**
   * Backend model id for this motion card (used to open /game?model=&card=).
   */
  modelId?: string
  /**
   * Optional photo-slot fill override (0–10) for this motion card's grid.
   */
  photoFilledCount?: number
  /**
   * Optional explicit photo URLs for the active-card grid (up to 10).
   * When set, filled slots use these images instead of the placeholder art.
   */
  photoUrls?: string[]
  /**
   * Role-level filled static count (0–30). Gift unlocks at 30/30 across the
   * three motion videos in the category.
   */
  rolePhotoFilledCount?: number
  /** Exclusive category gift video (plays when gift is claimed). */
  giftVideoUrl?: string
  /** Optional HTML overlay on the card front (name / city / flag / gradient). */
  overlay?: CardFaceOverlayConfig
}

let cardSeq = 0

export function createCard(
  partial: Partial<CardConfig> & { sequence?: number } = {}
): CardConfig {
  cardSeq += 1
  const n = partial.sequence ?? cardSeq
  return {
    id: partial.id ?? `card-${Date.now()}-${n}`,
    name: partial.name ?? `Card ${n}`,
    mediaType: partial.mediaType ?? 'video',
    mediaUrl:
      (partial.mediaUrl && partial.mediaUrl.trim()) ||
      (partial.mediaType === 'image'
        ? PLACEHOLDER_MEDIA_URL
        : DEFAULT_MEDIA_URL),
    backMediaType: partial.backMediaType ?? 'image',
    backUrl: partial.backUrl ?? DEFAULT_BACK_URL,
    effectIndex: partial.effectIndex ?? DEFAULT_EFFECT_INDEX,
    foilUrl: partial.foilUrl ?? '',
    maskUrl: partial.maskUrl ?? '',
    fullBleed: partial.fullBleed ?? true,
    backHolo: partial.backHolo ?? true,
    flipAngle: partial.flipAngle ?? 0,
    holoTransform: normalizeHoloTransform(
      partial.holoTransform ?? DEFAULT_HOLO_TRANSFORM
    ),
    groupId: partial.groupId ?? '',
    groupTheme: partial.groupTheme ?? '',
    ...(typeof partial.modelId === 'string' && partial.modelId.trim()
      ? { modelId: partial.modelId.trim() }
      : {}),
    ...(typeof partial.videoCardCount === 'number' &&
    Number.isFinite(partial.videoCardCount)
      ? {
          // 0x = motion card with no playable games (still shown, no stack-backs).
          videoCardCount: Math.max(
            0,
            Math.min(5, Math.round(partial.videoCardCount))
          ),
        }
      : {}),
    ...(typeof partial.photoFilledCount === 'number' &&
    Number.isFinite(partial.photoFilledCount)
      ? {
          photoFilledCount: Math.max(
            0,
            Math.min(10, Math.round(partial.photoFilledCount))
          ),
        }
      : {}),
    ...(Array.isArray(partial.photoUrls)
      ? {
          // Keep empty strings so a fixed 10-slot grid can stay index-aligned.
          photoUrls: Array.from({ length: 10 }, (_, i) => {
            const url = partial.photoUrls?.[i]
            return typeof url === 'string' ? url.trim() : ''
          }),
        }
      : {}),
    ...(typeof partial.rolePhotoFilledCount === 'number' &&
    Number.isFinite(partial.rolePhotoFilledCount)
      ? {
          rolePhotoFilledCount: Math.max(
            0,
            Math.min(30, Math.round(partial.rolePhotoFilledCount)),
          ),
        }
      : {}),
    ...(typeof partial.giftVideoUrl === 'string' &&
    partial.giftVideoUrl.trim()
      ? { giftVideoUrl: partial.giftVideoUrl.trim() }
      : {}),
    ...(partial.overlay && typeof partial.overlay === 'object'
      ? {
          overlay: {
            name:
              typeof partial.overlay.name === 'string'
                ? partial.overlay.name.trim()
                : '',
            ...(typeof partial.overlay.city === 'string'
              ? { city: partial.overlay.city.trim() }
              : {}),
            ...(typeof partial.overlay.country === 'string'
              ? { country: partial.overlay.country.trim() }
              : {}),
            ...(typeof partial.overlay.flagEmoji === 'string'
              ? { flagEmoji: partial.overlay.flagEmoji.trim() }
              : {}),
            ...(typeof partial.overlay.flagSvgUrl === 'string'
              ? { flagSvgUrl: partial.overlay.flagSvgUrl.trim() }
              : {}),
            ...(typeof partial.overlay.gradientColor === 'string'
              ? { gradientColor: partial.overlay.gradientColor.trim() }
              : {}),
            ...(typeof partial.overlay.gradientColorEnd === 'string'
              ? { gradientColorEnd: partial.overlay.gradientColorEnd.trim() }
              : {}),
            ...(typeof partial.overlay.cardNumber === 'string'
              ? { cardNumber: partial.overlay.cardNumber.trim() }
              : {}),
          },
        }
      : {}),
  }
}
