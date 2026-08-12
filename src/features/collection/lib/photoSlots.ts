/** Total photo-card slots shown under an active motion card. */
export const PHOTO_SLOTS = 10

/** Filled photo slots use the Sugar Scratch card back art when no catalog URL is set. */
export const PHOTO_SLOT_IMAGE = '/img/SugarScratch.png'

export type PhotoSlotFill = {
  src: string | null
}

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function normalizePhotoUrls(urls?: readonly string[] | null): string[] {
  if (!urls?.length) return []
  // Fixed-length grids keep empty slots so photo-scratch indices stay aligned.
  if (urls.length >= PHOTO_SLOTS || urls.some((url) => !String(url ?? '').trim())) {
    return Array.from({ length: PHOTO_SLOTS }, (_, i) => {
      const url = urls[i]
      return typeof url === 'string' ? url.trim() : ''
    })
  }
  return urls
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter(Boolean)
    .slice(0, PHOTO_SLOTS)
}

/**
 * Deterministic per-card photo fills:
 * - explicit photoUrls from the catalog take priority (index-aligned when sparse)
 * - optional filledOverride forces an exact filled count (0–PHOTO_SLOTS)
 * - otherwise some cards get none, others get 1–4 random placeholder images
 * Same cardKey always yields the same layout when using the random path.
 */
export function buildPhotoSlotFills(
  cardKey: string,
  filledOverride?: number | null,
  photoUrls?: readonly string[] | null,
): PhotoSlotFill[] {
  const catalogUrls = normalizePhotoUrls(photoUrls)
  const hasExplicitGrid =
    Array.isArray(photoUrls) &&
    (photoUrls.length >= PHOTO_SLOTS ||
      photoUrls.some((url) => !String(url ?? '').trim()))

  if (catalogUrls.some(Boolean)) {
    if (hasExplicitGrid) {
      return Array.from({ length: PHOTO_SLOTS }, (_, i) => ({
        src: catalogUrls[i] || null,
      }))
    }
    // Packed catalog photos: place in order, leave remaining slots empty.
    // If filledOverride is smaller, only show that many leading photos.
    let count = catalogUrls.length
    if (typeof filledOverride === 'number' && Number.isFinite(filledOverride)) {
      count = Math.max(
        0,
        Math.min(PHOTO_SLOTS, Math.round(filledOverride), catalogUrls.length),
      )
    }
    return Array.from({ length: PHOTO_SLOTS }, (_, i) => ({
      src: i < count ? (catalogUrls[i] ?? null) : null,
    }))
  }

  if (typeof filledOverride === 'number' && Number.isFinite(filledOverride)) {
    const count = Math.max(0, Math.min(PHOTO_SLOTS, Math.round(filledOverride)))
    return Array.from({ length: PHOTO_SLOTS }, (_, i) => ({
      src: i < count ? PHOTO_SLOT_IMAGE : null,
    }))
  }

  const rand = mulberry32(hashSeed(cardKey || 'photo-grid'))
  const fills: PhotoSlotFill[] = Array.from({ length: PHOTO_SLOTS }, () => ({
    src: null,
  }))

  // ~70% of cards get at least one photo; others stay empty.
  if (rand() < 0.3) return fills

  const count = 1 + Math.floor(rand() * 4) // 1..4
  const indices = Array.from({ length: PHOTO_SLOTS }, (_, i) => i)
  // Fisher–Yates with seeded rng
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }

  for (let n = 0; n < count; n++) {
    const slot = indices[n]!
    fills[slot] = { src: PHOTO_SLOT_IMAGE }
  }
  return fills
}

/** Count of filled photo slots for a motion card (0–PHOTO_SLOTS). */
export function getPhotoFilledCount(
  cardKey: string,
  filledOverride?: number | null,
  photoUrls?: readonly string[] | null,
): number {
  return buildPhotoSlotFills(cardKey, filledOverride, photoUrls).filter(
    (s) => s.src,
  ).length
}

/**
 * Number of video cards available for a motion card.
 * Deterministic 1–2 by default. Optional override (0–5) is used when a card
 * seeds an explicit count:
 *   0 → motion card stays visible, meta shows "0x", no stack-backs / no play
 *   5 → deep stack demo
 */
export function getVideoCardCount(
  cardKey: string,
  override?: number | null
): number {
  if (typeof override === 'number' && Number.isFinite(override)) {
    return Math.max(0, Math.min(5, Math.round(override)))
  }
  const rand = mulberry32(hashSeed(`video:${cardKey || 'card'}`))
  // Default demo cards always have at least one playable game.
  if (rand() < 0.75) return 1
  return 2
}
