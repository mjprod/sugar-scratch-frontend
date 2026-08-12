import { PLACEHOLDER_MEDIA_URL, type CardConfig } from './cards'
import { DESKTOP_LAYOUT, type LayoutMetrics } from './carouselLayout'
import { getDefaultMediaUrlForGroup } from './effects'
import {
  CHARACTER_BY_GROUP_ID,
  formatCardNumber,
  getFilledPhotoUrls,
  getGiftVideoUrl,
  getMotionVideoList,
  getRolePhotoFilledCount,
  type Character,
  type GroupId,
} from '@/shared/catalog/characters'
import type { BackendCollectionGroup } from '@/shared/backend/collection'

/** Max cards allowed in one themed group. */
export const MAX_GROUP_SIZE = 3

/** First-class group definition (may contain 0–3 cards). */
export type DeckGroup = {
  id: string
  theme: string
  /** Model×theme avatar from the collection API when available. */
  avatarUrl?: string | null
}

export type CardGroupSpan = {
  id: string
  theme: string
  /** Inclusive first layout-slot index of this group. */
  startSlot: number
  /** Inclusive last layout-slot index of this group. */
  endSlot: number
  /** How many real cards are currently assigned (0–3). */
  cardCount: number
  /** Always MAX_GROUP_SIZE — groups reserve full width. */
  slotCount: number
  /** Model×theme avatar when provided by the collection API. */
  avatarUrl?: string | null
}

/** One position in the horizontal track (real card or empty placeholder). */
export type LayoutSlot =
  | {
      kind: 'card'
      key: string
      cardId: string
      cardIndex: number
      groupId: string | null
      slotInGroup: number
    }
  | {
      kind: 'placeholder'
      key: string
      groupId: string
      slotInGroup: number
    }

/** Fixed deck groups — every card must belong to one of these. */
export const FIXED_GROUPS: DeckGroup[] = [
  { id: 'group-1', theme: 'Police Woman' },
  { id: 'group-2', theme: 'Nurse' },
  { id: 'group-3', theme: 'Teacher' },
  { id: 'group-4', theme: 'Gym' },
  { id: 'group-5', theme: 'Firefighter' },
]

export function createGroup(
  partial: Partial<DeckGroup> & { theme?: string } = {}
): DeckGroup {
  const n = partial.theme?.trim() || 'Untitled'
  return {
    id: partial.id ?? `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    theme: n,
  }
}

/** Always the fixed five groups (themes can be renamed later if desired). */
export function getFixedGroups(overrides?: DeckGroup[]): DeckGroup[] {
  if (!overrides?.length) return FIXED_GROUPS.map((g) => ({ ...g }))
  // Keep fixed ids/order; allow theme renames from saved state.
  return FIXED_GROUPS.map((fixed) => {
    const saved = overrides.find((g) => g.id === fixed.id)
    return {
      id: fixed.id,
      theme: saved?.theme?.trim() || fixed.theme,
    }
  })
}

/**
 * Keep cards contiguous by group, ordered as `groups`.
 * Orphans / overflow are reassigned into groups that still have room —
 * no ungrouped cards.
 */
export function orderCardsByGroups(
  cards: CardConfig[],
  groups: DeckGroup[]
): CardConfig[] {
  const groupList = groups.length > 0 ? groups : FIXED_GROUPS
  const byId = new Map(cards.map((c) => [c.id, c]))
  const used = new Set<string>()
  const ordered: CardConfig[] = []
  const counts = new Map<string, number>()

  for (const group of groupList) {
    const members = cards.filter((c) => c.groupId === group.id)
    let taken = 0
    for (const card of members) {
      if (taken >= MAX_GROUP_SIZE) break
      const live = byId.get(card.id)
      if (!live || used.has(live.id)) continue
      ordered.push({
        ...live,
        groupId: group.id,
        groupTheme: group.theme,
      })
      used.add(live.id)
      taken += 1
    }
    counts.set(group.id, taken)
  }

  // Rehome anything left over into the first group with open slots.
  for (const card of cards) {
    if (used.has(card.id)) continue
    const target =
      groupList.find((g) => (counts.get(g.id) ?? 0) < MAX_GROUP_SIZE) ??
      groupList[0]
    if (!target) continue
    ordered.push({
      ...card,
      groupId: target.id,
      groupTheme: target.theme,
    })
    used.add(card.id)
    counts.set(target.id, (counts.get(target.id) ?? 0) + 1)
  }

  return ordered
}

/**
 * Build the full layout track: every group contributes exactly MAX_GROUP_SIZE
 * slots (cards first, then placeholders). Ungrouped cards are single slots.
 */
export function buildLayoutSlots(
  cards: CardConfig[],
  groups: DeckGroup[]
): LayoutSlot[] {
  const slots: LayoutSlot[] = []
  const used = new Set<string>()

  for (const group of groups) {
    const members = cards
      .map((card, cardIndex) => ({ card, cardIndex }))
      .filter(({ card }) => card.groupId === group.id)

    let filled = 0
    for (const { card, cardIndex } of members) {
      if (filled >= MAX_GROUP_SIZE) break
      if (used.has(card.id)) continue
      slots.push({
        kind: 'card',
        key: card.id,
        cardId: card.id,
        cardIndex,
        groupId: group.id,
        slotInGroup: filled,
      })
      used.add(card.id)
      filled += 1
    }

    while (filled < MAX_GROUP_SIZE) {
      slots.push({
        kind: 'placeholder',
        key: `ph-${group.id}-${filled}`,
        groupId: group.id,
        slotInGroup: filled,
      })
      filled += 1
    }
  }

  cards.forEach((card, cardIndex) => {
    if (used.has(card.id)) return
    // Orphaned groupId that isn't in `groups` — still render as a single card.
    slots.push({
      kind: 'card',
      key: card.id,
      cardId: card.id,
      cardIndex,
      groupId: card.groupId?.trim() || null,
      slotInGroup: 0,
    })
  })

  return slots
}

/** Group spans over the slot track (always MAX_GROUP_SIZE wide). */
export function buildGroupSpans(
  cards: CardConfig[],
  groups: DeckGroup[]
): CardGroupSpan[] {
  const slots = buildLayoutSlots(cards, groups)
  const spans: CardGroupSpan[] = []

  for (const group of groups) {
    let start = -1
    let end = -1
    let cardCount = 0
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!
      if (slot.groupId !== group.id) continue
      if (start < 0) start = i
      end = i
      if (slot.kind === 'card') cardCount += 1
    }
    if (start < 0 || end < 0) continue
    spans.push({
      id: group.id,
      theme: group.theme,
      startSlot: start,
      endSlot: end,
      cardCount,
      slotCount: end - start + 1,
      avatarUrl: group.avatarUrl ?? null,
    })
  }

  return spans
}

/** Slot index of a real card, or -1. */
export function findCardSlotIndex(
  slots: LayoutSlot[],
  cardIndex: number
): number {
  return slots.findIndex(
    (s) => s.kind === 'card' && s.cardIndex === cardIndex
  )
}

/** Card index living in a layout slot, or -1 for empty placeholders. */
export function getSlotCardIndex(
  slots: LayoutSlot[],
  slotIndex: number
): number {
  const slot = slots[slotIndex]
  return slot?.kind === 'card' ? slot.cardIndex : -1
}

/**
 * Clamp a layout-slot focus index into the track.
 * Empty placeholder slots are valid focus targets for scrolling.
 */
export function clampSlotIndex(slotIndex: number, slotCount: number): number {
  if (slotCount <= 0) return 0
  return Math.min(Math.max(Math.round(slotIndex), 0), slotCount - 1)
}

/**
 * Horizontal step from slot `from` toward `from + dir`.
 * In-group: cardStep.
 * Across group boundaries: cardStep + 2×cardGap (double the extra group gap).
 * Adjacent ungrouped cards stay on cardStep.
 */
export function stepBetweenSlots(
  slots: LayoutSlot[],
  from: number,
  dir: 1 | -1,
  metrics: LayoutMetrics = DESKTOP_LAYOUT
): number {
  const a = slots[from]
  const b = slots[from + dir]
  if (!a || !b) return metrics.cardStep

  const ga = a.groupId
  const gb = b.groupId
  if (ga && gb && ga === gb) return metrics.cardStep

  // Two ungrouped singles sit tightly; anything involving a group gets the extra gap.
  if (!ga && !gb) return metrics.cardStep
  // Double the inter-group gap so themed packs breathe more in the row.
  return metrics.cardStep + metrics.cardGap * 2
}

/** Absolute X of slot `index` relative to slot `originIndex` (origin at x=0). */
export function getRelativeSlotX(
  slots: LayoutSlot[],
  originIndex: number,
  index: number,
  metrics: LayoutMetrics = DESKTOP_LAYOUT
): number {
  if (index === originIndex) return 0
  if (originIndex < 0 || index < 0) {
    return (index - originIndex) * metrics.cardStep
  }
  const dir: 1 | -1 = index > originIndex ? 1 : -1
  let x = 0
  for (let i = originIndex; i !== index; i += dir) {
    x += dir * stepBetweenSlots(slots, i, dir, metrics)
  }
  return x
}

/**
 * Absolute X of card `index` relative to focused card (origin at x=0).
 * Accounts for placeholder slots and double gaps between groups.
 */
export function getRelativeCardX(
  cards: CardConfig[],
  groups: DeckGroup[],
  focusIndex: number,
  index: number,
  metrics: LayoutMetrics = DESKTOP_LAYOUT
): number {
  if (index === focusIndex) return 0
  const slots = buildLayoutSlots(cards, groups)
  const origin = findCardSlotIndex(slots, focusIndex)
  const target = findCardSlotIndex(slots, index)
  if (origin < 0 || target < 0) {
    return (index - focusIndex) * metrics.cardStep
  }
  return getRelativeSlotX(slots, origin, target, metrics)
}

/**
 * Layout frame for a group relative to the focused card origin.
 * Groups always reserve the full 3-slot width for a stable stroke.
 */
export function getGroupFrame(
  cards: CardConfig[],
  groups: DeckGroup[],
  focusIndex: number,
  span: CardGroupSpan,
  dragOffsetPx = 0,
  metrics: LayoutMetrics = DESKTOP_LAYOUT
): { x: number; width: number } | null {
  const slots = buildLayoutSlots(cards, groups)
  const origin = findCardSlotIndex(slots, focusIndex)
  if (origin < 0) return null
  if (span.startSlot < 0 || span.endSlot < 0) return null

  const padX = 22
  const left =
    getRelativeSlotX(slots, origin, span.startSlot, metrics) +
    dragOffsetPx -
    padX
  const right =
    getRelativeSlotX(slots, origin, span.endSlot, metrics) +
    dragOffsetPx +
    metrics.cardWidth +
    padX
  return {
    x: left,
    width: Math.max(right - left, metrics.cardWidth + padX * 2),
  }
}

/** Constant full-group stroke width (3 slots + side padding). */
export function getFullGroupWidth(
  padX = 22,
  metrics: LayoutMetrics = DESKTOP_LAYOUT
): number {
  return (
    MAX_GROUP_SIZE * metrics.cardWidth +
    (MAX_GROUP_SIZE - 1) * metrics.cardGap +
    padX * 2
  )
}

/** Card label: "Nurse - 01", "Gym - 03", etc. */
export function formatGroupCardName(theme: string, slotIndex: number): string {
  const n = Math.max(1, Math.floor(slotIndex) + 1)
  const label = theme.trim() || 'Group'
  return `${label} - ${String(n).padStart(2, '0')}`
}

export type CatalogLookup = {
  /** Prefer groupId → character from the live catalog. */
  byGroupId?: Partial<Record<GroupId, Character>> | Record<string, Character>
  /** Global girl name applied to every role title. */
  girlName?: string
  /** Card-face overlay identity (shared across roles). */
  overlay?: CardConfig['overlay']
  /** Per backend group overlay (e.g. each model’s API influencer profile). */
  overlayForGroup?: (
    group: BackendCollectionGroup,
  ) => CardConfig['overlay'] | undefined
}

function characterForGroup(
  groupId: string,
  lookup?: CatalogLookup,
): Character | null {
  const fromLookup = lookup?.byGroupId?.[groupId as GroupId]
  if (fromLookup) return fromLookup
  if (groupId in CHARACTER_BY_GROUP_ID) {
    return CHARACTER_BY_GROUP_ID[groupId as GroupId]
  }
  return null
}

function resolveGroupTheme(
  group: DeckGroup,
  character: Character | null,
  girlName?: string,
): string {
  const role = character?.name?.trim() || group.theme
  const girl = girlName?.trim()
  if (!girl) return role
  if (!role) return girl
  if (role.toLowerCase() === girl.toLowerCase()) return girl
  if (role.toLowerCase().startsWith(`${girl.toLowerCase()} `)) return role
  return `${girl} ${role}`
}

function resolveSlotMediaUrl(
  character: Character | null,
  slot: number,
  group: DeckGroup,
): string {
  if (character) {
    const motions = getMotionVideoList(character)
    const fromMotion = motions[slot] || motions[0]
    if (fromMotion) return fromMotion
    if (character.videoUrl.trim()) return character.videoUrl.trim()
  }
  return getDefaultMediaUrlForGroup(group.theme, group.id)
}

function resolveSlotVideoCount(
  character: Character | null,
  demoOverride?: number,
): number | undefined {
  if (typeof demoOverride === 'number') return demoOverride
  if (!character) return undefined
  const n = getMotionVideoList(character).length
  return n > 0 ? Math.min(5, n) : undefined
}

function resolveSlotPhotos(
  character: Character | null,
  slot: number,
): {
  photoUrls?: string[]
  photoFilledCount?: number
  giftVideoUrl?: string
  rolePhotoFilledCount?: number
} {
  if (!character) return {}
  const photos = getFilledPhotoUrls(character, slot)
  const giftVideoUrl = getGiftVideoUrl(character)
  const rolePhotoFilledCount = getRolePhotoFilledCount(character)
  return {
    ...(photos.length > 0
      ? {
          photoUrls: photos,
          photoFilledCount: photos.length,
        }
      : {}),
    ...(giftVideoUrl ? { giftVideoUrl } : {}),
    ...(rolePhotoFilledCount > 0 ? { rolePhotoFilledCount } : {}),
  }
}

/**
 * Default demo deck with mixed group fills so stack-back underlays are easy
 * to verify:
 *   Police Woman  → 1
 *   Nurse         → 2
 *   Teacher       → 3
 *   Gym           → 1
 *   Firefighter     → 2
 *
 * When a live catalog is provided, each group's theme/name, motion videos,
 * and photo URLs come from that character. Named "{theme} - 01" … within each
 * group. Groups still reserve MAX_GROUP_SIZE layout slots; unfilled slots stay
 * as placeholders.
 */
export function createFullDefaultDeck(
  create: (partial?: Partial<CardConfig> & { sequence?: number }) => CardConfig,
  lookup?: CatalogLookup,
): {
  cards: CardConfig[]
  groups: DeckGroup[]
} {
  const baseGroups = getFixedGroups()
  // Keep in FIXED_GROUPS order. Always seed 3 motion-card slots per role so
  // admin motion videos 1–3 are visible; ownership still gates play count.
  const fills = [3, 3, 3, 3, 3]
  const groups = baseGroups.map((group) => {
    const character = characterForGroup(group.id, lookup)
    return {
      id: group.id,
      theme: resolveGroupTheme(group, character, lookup?.girlName),
    }
  })
  const cards: CardConfig[] = []
  let sequence = 1
  groups.forEach((group, groupIndex) => {
    const character = characterForGroup(group.id, lookup)
    const fill = Math.max(
      0,
      Math.min(MAX_GROUP_SIZE, fills[groupIndex] ?? MAX_GROUP_SIZE),
    )
    for (let slot = 0; slot < fill; slot++) {
      // Demo overrides kept for stack-depth / no-play UX checks:
      // Nurse-02 = 5x stack depth, Teacher-02 = 0x no-play
      let videoCardCount: number | undefined
      if (group.id === 'group-2' && slot === 1) videoCardCount = 5
      if (group.id === 'group-3' && slot === 1) videoCardCount = 0
      if (videoCardCount === undefined) {
        videoCardCount = resolveSlotVideoCount(character)
      }
      const photos = resolveSlotPhotos(character, slot)
      cards.push(
        create({
          sequence,
          name: formatGroupCardName(group.theme, slot),
          groupId: group.id,
          groupTheme: group.theme,
          mediaType: 'video',
          mediaUrl: resolveSlotMediaUrl(character, slot, group),
          ...(videoCardCount !== undefined ? { videoCardCount } : {}),
          ...photos,
          ...(lookup?.overlay
            ? {
                overlay: {
                  ...lookup.overlay,
                  cardNumber:
                    lookup.overlay.cardNumber ??
                    formatCardNumber(group.id, slot),
                },
              }
            : {}),
        }),
      )
      sequence += 1
    }
  })
  return { cards: orderCardsByGroups(cards, groups), groups }
}

/**
 * Single-card loading mockup shown while the collection API is in flight.
 * Uses placeholder art + LOADING labels (no identity overlay).
 */
export function createLoadingMockDeck(
  create: (partial?: Partial<CardConfig> & { sequence?: number }) => CardConfig,
): {
  cards: CardConfig[]
  groups: DeckGroup[]
} {
  const groups: DeckGroup[] = [
    { id: 'loading-group', theme: 'LOADING', avatarUrl: null },
  ]
  const cards = [
    create({
      id: 'loading-card',
      sequence: 1,
      name: 'LOADING',
      groupId: 'loading-group',
      groupTheme: 'LOADING',
      mediaType: 'image',
      mediaUrl: PLACEHOLDER_MEDIA_URL,
      videoCardCount: 0,
      photoFilledCount: 0,
    }),
  ]
  return { cards, groups }
}

/** Build the collection track from models and published motion cards. */
export function createBackendDeck(
  create: (partial?: Partial<CardConfig> & { sequence?: number }) => CardConfig,
  backendGroups: BackendCollectionGroup[],
  lookup?: CatalogLookup,
): {
  cards: CardConfig[]
  groups: DeckGroup[]
} {
  // Group headings use API titles: "{Model Name} {Theme Name}".
  const groups = backendGroups.map((group) => {
    const theme =
      group.themeName?.trim() ||
      group.title?.trim() ||
      'Motion'
    return {
      id: group.id,
      theme,
      avatarUrl: group.avatarUrl ?? null,
    }
  })
  let sequence = 1
  const cards = backendGroups.flatMap((group, groupIndex) => {
    const theme = groups[groupIndex]?.theme || group.themeName || group.title
    return group.cards.map((card, slot) => {
      const overlay =
        lookup?.overlayForGroup?.(group) ?? lookup?.overlay ?? undefined
      const mediaUrl =
        (card.trailerUrl && card.trailerUrl.trim()) ||
        (card.videoUrl && card.videoUrl.trim()) ||
        ''
      const hasMedia = Boolean(mediaUrl)
      const next = create({
        id: card.id,
        sequence,
        name: formatGroupCardName(theme, slot),
        groupId: group.id,
        groupTheme: theme,
        modelId: group.modelId,
        mediaType: hasMedia ? 'video' : 'image',
        mediaUrl: hasMedia ? mediaUrl : PLACEHOLDER_MEDIA_URL,
        photoFilledCount: card.photoScratchDone,
        photoUrls: card.photoUrls,
        ...(overlay
          ? {
              overlay: {
                ...overlay,
                cardNumber:
                  overlay.cardNumber ?? formatCardNumber(group.id, slot),
              },
            }
          : {}),
      })
      sequence += 1
      return next
    })
  })
  return { cards: orderCardsByGroups(cards, groups), groups }
}

/**
 * Sparse demo deck for testing empty group slots / half-opacity nav dots.
 * Pattern per fixed group (fills only some of the 3 reserved slots):
 *   Police Woman  → 2
 *   Nurse         → 1
 *   Teacher       → 3
 *   Gym           → 0  (all empty)
 *   Firefighter     → 2
 */
export function createSparseDefaultDeck(
  create: (partial?: Partial<CardConfig> & { sequence?: number }) => CardConfig,
  lookup?: CatalogLookup,
): {
  cards: CardConfig[]
  groups: DeckGroup[]
} {
  const baseGroups = getFixedGroups()
  // Keep in FIXED_GROUPS order.
  const fills = [2, 1, 3, 0, 2]
  const groups = baseGroups.map((group) => {
    const character = characterForGroup(group.id, lookup)
    return {
      id: group.id,
      theme: resolveGroupTheme(group, character, lookup?.girlName),
    }
  })
  const cards: CardConfig[] = []
  let sequence = 1
  groups.forEach((group, groupIndex) => {
    const character = characterForGroup(group.id, lookup)
    const fill = Math.max(
      0,
      Math.min(MAX_GROUP_SIZE, fills[groupIndex] ?? 1),
    )
    for (let slot = 0; slot < fill; slot++) {
      const photos = resolveSlotPhotos(character, slot)
      cards.push(
        create({
          sequence,
          name: formatGroupCardName(group.theme, slot),
          groupId: group.id,
          groupTheme: group.theme,
          mediaType: 'video',
          mediaUrl: resolveSlotMediaUrl(character, slot, group),
          ...(lookup?.overlay
            ? {
                overlay: {
                  ...lookup.overlay,
                  cardNumber:
                    lookup.overlay.cardNumber ??
                    formatCardNumber(group.id, slot),
                },
              }
            : {}),
          ...(resolveSlotVideoCount(character) !== undefined
            ? { videoCardCount: resolveSlotVideoCount(character) }
            : {}),
          ...photos,
        }),
      )
      sequence += 1
    }
  })
  // Guarantee at least one focusable card if the pattern ever collapses.
  if (cards.length === 0 && groups[0]) {
    const group = groups[0]
    const character = characterForGroup(group.id, lookup)
    cards.push(
      create({
        sequence: 1,
        name: formatGroupCardName(group.theme, 0),
        groupId: group.id,
        groupTheme: group.theme,
        mediaType: 'video',
        mediaUrl: resolveSlotMediaUrl(character, 0, group),
      }),
    )
  }
  return { cards: orderCardsByGroups(cards, groups), groups }
}

/**
 * Force the fixed five groups and assign every card into one of them.
 * Used for prototype demos / migration of older saved decks.
 * Empty decks are replaced with the mixed default demo deck.
 */
export function withDefaultGroups(
  cards: CardConfig[],
  savedGroups?: DeckGroup[],
  create?: (partial?: Partial<CardConfig> & { sequence?: number }) => CardConfig
): {
  cards: CardConfig[]
  groups: DeckGroup[]
} {
  const groups = getFixedGroups(savedGroups)

  // Fresh / empty seed → mixed default (solo + multi groups for stack-back).
  // Partial fills are intentional; do not pad every group to MAX_GROUP_SIZE.
  if (cards.length === 0) {
    if (create) return createFullDefaultDeck(create)
    return { cards, groups }
  }

  // Prefer existing valid memberships; rehome unknowns into open slots.
  const knownIds = new Set(groups.map((g) => g.id))
  const normalized = cards.map((card) => {
    const gid = card.groupId?.trim() || ''
    if (gid && knownIds.has(gid)) {
      const group = groups.find((g) => g.id === gid)!
      return { ...card, groupId: group.id, groupTheme: group.theme }
    }
    return { ...card, groupId: '', groupTheme: '' }
  })

  // If nothing is assigned yet, fill groups in order (and name by slot).
  if (!normalized.some((c) => c.groupId)) {
    const seeded = normalized.map((card, index) => {
      const groupOrd = Math.floor(index / MAX_GROUP_SIZE)
      const slot = index % MAX_GROUP_SIZE
      const group = groups[Math.min(groupOrd, groups.length - 1)]!
      const looksDefault = /^Card\s+\d+$/i.test(card.name.trim())
      return {
        ...card,
        name: looksDefault
          ? formatGroupCardName(group.theme, slot)
          : card.name,
        groupId: group.id,
        groupTheme: group.theme,
      }
    })
    return { cards: orderCardsByGroups(seeded, groups), groups }
  }

  return { cards: orderCardsByGroups(normalized, groups), groups }
}

/** How many cards currently sit in a group. */
export function countGroupMembers(
  cards: CardConfig[],
  groupId: string
): number {
  return cards.filter((c) => c.groupId === groupId).length
}

/** Members of a group in deck order (capped at MAX_GROUP_SIZE). */
export function getGroupMembers(
  cards: CardConfig[],
  groupId: string
): CardConfig[] {
  return cards
    .filter((c) => c.groupId === groupId)
    .slice(0, MAX_GROUP_SIZE)
}

/**
 * Assign a card to a group (no-op if group is full).
 * Returns reordered cards with synced groupTheme.
 */
export function assignCardToGroup(
  cards: CardConfig[],
  groups: DeckGroup[],
  cardId: string,
  groupId: string
): CardConfig[] {
  const groupList = groups.length > 0 ? groups : FIXED_GROUPS
  const group = groupList.find((g) => g.id === groupId)
  if (!group) return cards

  const members = countGroupMembers(cards, groupId)
  const card = cards.find((c) => c.id === cardId)
  if (!card) return cards

  // Already in this group — just refresh theme.
  if (card.groupId === groupId) {
    return orderCardsByGroups(
      cards.map((c) =>
        c.groupId === groupId ? { ...c, groupTheme: group.theme } : c
      ),
      groupList
    )
  }

  if (members >= MAX_GROUP_SIZE) return cards

  const next = cards.map((c) =>
    c.id === cardId
      ? { ...c, groupId: group.id, groupTheme: group.theme }
      : c
  )
  return orderCardsByGroups(next, groupList)
}

/**
 * Place a specific card into a group's slot index (0–2).
 * If the slot already has a card, swap memberships when possible.
 * Empty slot value (`cardId === ''`) rehomes the current occupant
 * into another group with room — never leaves cards ungrouped.
 */
export function setGroupSlot(
  cards: CardConfig[],
  groups: DeckGroup[],
  groupId: string,
  slotIndex: number,
  cardId: string
): CardConfig[] {
  const groupList = groups.length > 0 ? groups : FIXED_GROUPS
  const group = groupList.find((g) => g.id === groupId)
  if (!group) return cards
  const slot = Math.max(0, Math.min(MAX_GROUP_SIZE - 1, Math.floor(slotIndex)))

  const members = getGroupMembers(cards, groupId)
  const occupant = members[slot] ?? null

  // Clear slot: rehome occupant elsewhere.
  if (!cardId) {
    if (!occupant) return orderCardsByGroups(cards, groupList)
    const target =
      groupList.find(
        (g) =>
          g.id !== groupId && countGroupMembers(cards, g.id) < MAX_GROUP_SIZE
      ) ?? null
    if (!target) return orderCardsByGroups(cards, groupList)
    return assignCardToGroup(cards, groupList, occupant.id, target.id)
  }

  const incoming = cards.find((c) => c.id === cardId)
  if (!incoming) return cards
  if (occupant?.id === cardId) return orderCardsByGroups(cards, groupList)

  // Incoming already in this group — reorder slots by swapping.
  if (incoming.groupId === groupId) {
    const ids = members.map((m) => m.id)
    while (ids.length < MAX_GROUP_SIZE) ids.push('')
    const from = ids.indexOf(cardId)
    if (from < 0) return orderCardsByGroups(cards, groupList)
    const tmp = ids[slot] || ''
    ids[slot] = cardId
    ids[from] = tmp
    const order = new Map(ids.filter(Boolean).map((id, i) => [id, i]))
    const next = [...cards].sort((a, b) => {
      if (a.groupId !== groupId && b.groupId !== groupId) return 0
      if (a.groupId !== groupId) return 1
      if (b.groupId !== groupId) return -1
      return (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)
    })
    // Rebuild membership order via sequential re-assign.
    const reorderedMembers = ids
      .filter(Boolean)
      .map((id) => next.find((c) => c.id === id)!)
      .filter(Boolean)
    const others = next.filter((c) => c.groupId !== groupId)
    return orderCardsByGroups(
      [
        ...reorderedMembers.map((c) => ({
          ...c,
          groupId: group.id,
          groupTheme: group.theme,
        })),
        ...others,
      ],
      groupList
    )
  }

  // Incoming from another group.
  if (occupant) {
    // Swap: occupant takes incoming's group (if room / always since swap).
    const fromGroupId = incoming.groupId
    const fromGroup = groupList.find((g) => g.id === fromGroupId)
    const next = cards.map((c) => {
      if (c.id === incoming.id) {
        return { ...c, groupId: group.id, groupTheme: group.theme }
      }
      if (c.id === occupant.id) {
        return {
          ...c,
          groupId: fromGroup?.id ?? fromGroupId,
          groupTheme: fromGroup?.theme ?? c.groupTheme,
        }
      }
      return c
    })
    return orderCardsByGroups(next, groupList)
  }

  // Empty slot and group has room.
  if (members.length >= MAX_GROUP_SIZE) return cards
  return assignCardToGroup(cards, groupList, cardId, groupId)
}

/** Rename a group and sync theme onto member cards. */
export function renameGroup(
  cards: CardConfig[],
  groups: DeckGroup[],
  groupId: string,
  theme: string
): { cards: CardConfig[]; groups: DeckGroup[] } {
  const groupList = getFixedGroups(groups)
  const fixed = FIXED_GROUPS.find((g) => g.id === groupId)
  const trimmed = theme.trim() || fixed?.theme || 'Untitled'
  const nextGroups = groupList.map((g) =>
    g.id === groupId ? { ...g, theme: trimmed } : g
  )
  const nextCards = cards.map((c) =>
    c.groupId === groupId ? { ...c, groupTheme: trimmed } : c
  )
  return { cards: orderCardsByGroups(nextCards, nextGroups), groups: nextGroups }
}
