import type { RevealCard } from '@/features/reveal/lib/cards'
import type { CharacterId } from '@/shared/catalog/characters'
import {
  buildDealtRound,
  inferThemeFromLabel,
  themeKey,
  type ThemedMotionCard,
} from '@/features/game/modules/session'

const ROLE_THEME: Record<CharacterId, string> = {
  policewoman: 'Police',
  nurse: 'Nurse',
  teacher: 'Teacher',
  gym: 'Gym',
  firefighter: 'Firegirl',
}

/** Real /cards id from a pack-fan reveal card (API draws use reveal-api-{id}). */
export function playableIdFromRevealCard(card: RevealCard): string | null {
  const id = card.id.trim()
  if (id.startsWith('reveal-api-')) {
    const raw = id.slice('reveal-api-'.length).trim()
    return raw || null
  }
  return null
}

/**
 * Build the 5080-style motion hand from the pack-open fan:
 * prefer the exact revealed API cards, fill missing themes from the pool.
 */
export function buildHandFromRevealCards(
  revealCards: RevealCard[],
  motionPool: ThemedMotionCard[],
): ThemedMotionCard[] {
  const byId = new Map(motionPool.map((card) => [card.id, card] as const))
  const used = new Set<string>()
  const hand: ThemedMotionCard[] = []

  for (const reveal of revealCards) {
    const playId = playableIdFromRevealCard(reveal)
    const direct = playId ? byId.get(playId) : undefined
    if (direct && !used.has(direct.id)) {
      hand.push(direct)
      used.add(direct.id)
      continue
    }

    const roleTheme = reveal.characterId
      ? ROLE_THEME[reveal.characterId]
      : null
    const themeHint =
      roleTheme ||
      inferThemeFromLabel(reveal.name) ||
      reveal.characterId ||
      ''
    if (!themeHint) continue
    const key = themeKey(themeHint)
    const matches = motionPool.filter(
      (card) => !used.has(card.id) && themeKey(card.theme) === key,
    )
    if (matches.length === 0) continue
    const match = matches[Math.floor(Math.random() * matches.length)]!
    hand.push(match)
    used.add(match.id)
  }

  if (hand.length >= 5) return hand.slice(0, 5)

  const fill = buildDealtRound(
    motionPool.filter((card) => !used.has(card.id)),
  )
  if (fill) {
    for (const card of fill.cards) {
      if (hand.length >= 5) break
      if (used.has(card.id)) continue
      hand.push(card)
      used.add(card.id)
    }
  }
  return hand
}
