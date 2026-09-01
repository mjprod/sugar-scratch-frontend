import {
  DEFAULT_EFFECT_INDEX,
  HOLO_EFFECTS,
  type HoloEffect,
} from './effects'
import {
  CHARACTER_BY_ID,
  CHARACTER_IDS,
  DEFAULT_SWIPE_VIDEO_URL,
  formatCardNumber,
  formatCharacterDisplayName,
  MOTION_VIDEO_COUNT,
  revealCardId,
  type Character,
  type CharacterId,
  type PackFaceSlot,
} from '@/shared/catalog/characters'
import type { BackendFanCatalog } from '@/shared/backend/collection'

/** Local pack-back art (missing /img/SugarScratch.png used to 404). */
export const DEFAULT_BACK_URL = '/images/logoSugar.png'

export type MediaType = 'image' | 'video'

/** Identity badge rendered on the reveal card face. */
export type RevealCardOverlay = {
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

export type RevealCard = {
  id: string
  name: string
  mediaType: MediaType
  mediaUrl: string
  backUrl: string
  effect: HoloEffect
  /** Role this motion card belongs to (collection category). */
  characterId?: CharacterId
  /** Motion variant index 0–2 (display as 01–03). */
  motionSlot?: number
  /** Optional HTML overlay on the card front. */
  overlay?: RevealCardOverlay
}

function effectForIndex(index: number): HoloEffect {
  return (
    HOLO_EFFECTS[(DEFAULT_EFFECT_INDEX + index) % HOLO_EFFECTS.length] ??
    HOLO_EFFECTS[DEFAULT_EFFECT_INDEX]!
  )
}

function resolveMotionUrl(character: Character, motionSlot: number): string {
  const slot = Math.max(0, Math.min(MOTION_VIDEO_COUNT - 1, motionSlot))
  const fromMotion = (character.motionVideos[slot] ?? '').trim()
  if (fromMotion) return fromMotion
  // Prefer any filled motion variant before falling back to swipe face.
  for (const url of character.motionVideos) {
    const trimmed = (url ?? '').trim()
    if (trimmed) return trimmed
  }
  // Roles ship empty locally — use the shared swipe clip, never a missing PNG.
  return character.videoUrl.trim() || DEFAULT_SWIPE_VIDEO_URL
}

/** True random 0..n-1 — used so every open/replay redraws fresh. */
function randomIndex(n: number): number {
  if (n <= 1) return 0
  return Math.floor(Math.random() * n)
}

/** Fisher–Yates shuffle (new array). */
function shuffleCopy<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]!
    next[i] = next[j]!
    next[j] = tmp
  }
  return next
}

function characterMap(
  characters?: readonly Character[],
): Record<CharacterId, Character> {
  if (!characters?.length) return CHARACTER_BY_ID
  const map = { ...CHARACTER_BY_ID }
  for (const character of characters) {
    map[character.id] = character
  }
  return map
}

/**
 * Five holo variants of a single role (legacy / single-character reveal route).
 * Prefers that role's motion videos when present.
 */
export function createCharacterPackCards(
  characterId: CharacterId,
  characterOverride?: Character,
): RevealCard[] {
  const character = characterOverride ?? CHARACTER_BY_ID[characterId]
  return Array.from({ length: 5 }, (_, index) => {
    const motionSlot = index % MOTION_VIDEO_COUNT
    return {
      id: revealCardId(characterId, index),
      name: `${character.name} · ${effectForIndex(index).label}`,
      mediaType: 'video',
      mediaUrl: resolveMotionUrl(character, motionSlot),
      backUrl: character.backUrl,
      effect: effectForIndex(index),
      characterId,
      motionSlot,
    }
  })
}

export type MixedPackCardsOptions = {
  /** Live catalog roles (admin overrides / published Juliana motions). */
  characters?: readonly Character[]
  /**
   * Published backend motion cards. When present, each theme picks one API
   * clip instead of the local admin catalog motions.
   */
  backendFan?: BackendFanCatalog | null
  /** Foil pack slot (1 or 2) — retained for callers; draw is always random. */
  packSlot?: PackFaceSlot
  /**
   * Remount / replay token. Changing this (e.g. sequence runId) forces a fresh
   * random draw — the value itself is not hashed.
   */
  seed?: string | number | null
  /** Optional girl name prefix for card titles ("Juliana Police Woman"). */
  girlName?: string | null
  /** Optional card-face identity overlay shared across the fan. */
  overlay?: RevealCardOverlay | null
}

/**
 * Pack-open shuffler: one random motion card per theme
 * (police / nurse / teacher / gym / firefighter), then a random fan order.
 * Every call redraws — open and Replay open never reuse the prior layout.
 */
export function createMixedCategoryPackCards(
  options: MixedPackCardsOptions = {},
): RevealCard[] {
  const {
    characters,
    backendFan = null,
    girlName = null,
    overlay = null,
  } = options
  // Touch seed so callers that pass runId still invalidate memo caches even
  // though the draw itself is Math.random (not a hash of the seed).
  void options.seed
  void options.packSlot

  const byId = characterMap(characters)
  const overlayBase = overlay
    ? {
        ...overlay,
        name: overlay.name.trim() || girlName?.trim() || '',
      }
    : null

  // One card per theme, then shuffle fan positions so order is never fixed.
  const themed = CHARACTER_IDS.map((characterId) => {
    const character = byId[characterId] ?? CHARACTER_BY_ID[characterId]
    const apiPool = backendFan?.byRole[characterId] ?? []

    if (apiPool.length > 0) {
      const pick = randomIndex(apiPool.length)
      const apiCard = apiPool[pick]!
      const roleName = formatCharacterDisplayName(character.name, girlName)
      const variantLabel = String(pick + 1).padStart(2, '0')
      return {
        id: `reveal-api-${apiCard.id}`,
        name: `${roleName} · ${variantLabel}`,
        mediaType: 'video' as const,
        mediaUrl: apiCard.videoUrl,
        backUrl: character.backUrl || DEFAULT_BACK_URL,
        effect: effectForIndex(0),
        characterId,
        motionSlot: pick,
        ...(overlayBase
          ? {
              overlay: {
                ...overlayBase,
                name: overlayBase.name || girlName?.trim() || roleName,
                cardNumber:
                  overlayBase.cardNumber ||
                  formatCardNumber(characterId, pick),
              },
            }
          : {}),
      } satisfies RevealCard
    }

    const motionSlot = randomIndex(MOTION_VIDEO_COUNT)
    const mediaUrl = resolveMotionUrl(character, motionSlot)
    const roleName = formatCharacterDisplayName(character.name, girlName)
    const variantLabel = String(motionSlot + 1).padStart(2, '0')

    return {
      id: revealCardId(characterId, motionSlot),
      name: `${roleName} · ${variantLabel}`,
      mediaType: 'video' as const,
      mediaUrl,
      backUrl: character.backUrl || DEFAULT_BACK_URL,
      effect: effectForIndex(0),
      characterId,
      motionSlot,
      ...(overlayBase
        ? {
            overlay: {
              ...overlayBase,
              name: overlayBase.name || girlName?.trim() || roleName,
              cardNumber:
                overlayBase.cardNumber ||
                formatCardNumber(characterId, motionSlot),
            },
          }
        : {}),
    } satisfies RevealCard
  })

  return shuffleCopy(themed).map((card, index) => ({
    ...card,
    effect: effectForIndex(index),
  }))
}
