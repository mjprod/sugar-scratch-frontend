import { useCallback, useEffect, useMemo, useState } from 'react'
import CardCarousel from './components/CardCarousel'
import SlideDeck from './components/SlideDeck'
import { ActiveCardProvider, useActiveCard } from './context/ActiveCardContext'
import { createCard, type CardConfig } from './lib/cards'
import {
  DEFAULT_HOLO_TRANSFORM,
  normalizeHoloTransform,
  type HoloTransform,
} from './lib/holoTransform'
import {
  buildLayoutSlots,
  clampSlotIndex,
  createBackendDeck,
  createLoadingMockDeck,
  findCardSlotIndex,
  type DeckGroup,
} from './lib/cardGroups'
import { useDesktopCarousel } from './hooks/useDesktopCarousel'
import {
  CHARACTER_BY_ID,
  type CharacterId,
  type GroupId,
} from '@/shared/catalog/characters'
import { useCatalog } from '@/shared/catalog/CatalogContext'
import {
  fetchCollectionCatalogPaginated,
  peekCollectionCatalog,
  themeIdFromCardHint,
  type BackendCollectionCatalog,
} from '@/shared/backend/collection'
import { cardFaceOverlayFromShared } from '@/shared/ui/CardFaceOverlay'
import { usePageReady } from '@/shared/ui/PageTransition'
import { useSearchParams } from 'react-router-dom'
import './collection.css'

type CollectionExperienceProps = {
  ownedIds: Set<CharacterId>
  focusCharacterId?: CharacterId | null
  /** Restore the opened motion card after Play Game → back. */
  focusCardId?: string | null
  /** Force a backend model (creator page) instead of ?model= search param. */
  modelId?: string | null
  /** Compact height for embedding under creator Choose-a-Theme. */
  embedded?: boolean
  /** Reserved for Packs deep-link from unowned cards (unused while backend-owned). */
  onBuyPack?: (id: CharacterId) => void
}

/** Center the carousel on a motion card id, else a character group. */
function resolveFocusIndex(
  cards: CardConfig[],
  groups: DeckGroup[],
  focusCharacterId?: CharacterId | null,
  focusCardId?: string | null,
  byId: Partial<Record<CharacterId, { groupId: GroupId }>> = CHARACTER_BY_ID,
) {
  const layoutSlots = buildLayoutSlots(cards, groups)
  const cardKey = focusCardId?.trim()
  if (cardKey) {
    const cardIndex = cards.findIndex((c) => c.id === cardKey)
    if (cardIndex >= 0) {
      const slot = findCardSlotIndex(layoutSlots, cardIndex)
      return clampSlotIndex(slot >= 0 ? slot : 0, layoutSlots.length)
    }
  }
  if (!focusCharacterId) return 0
  const character = byId[focusCharacterId] ?? CHARACTER_BY_ID[focusCharacterId]
  if (!character) return 0
  const cardIndex = cards.findIndex((c) => c.groupId === character.groupId)
  if (cardIndex < 0) return 0
  const slot = findCardSlotIndex(layoutSlots, cardIndex)
  return clampSlotIndex(slot >= 0 ? slot : 0, layoutSlots.length)
}

function preloadCardMedia(card: CardConfig | null | undefined): Promise<void> {
  if (!card) return Promise.resolve()

  const loadOne = (type: CardConfig['mediaType'], url: string) =>
    new Promise<void>((resolve) => {
      if (!url) {
        resolve()
        return
      }
      if (type === 'image') {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = url
        return
      }
      const video = document.createElement('video')
      video.preload = 'auto'
      video.muted = true
      video.playsInline = true
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        video.removeEventListener('loadeddata', done)
        video.removeEventListener('canplay', done)
        video.removeEventListener('error', done)
        resolve()
      }
      video.addEventListener('loadeddata', done)
      video.addEventListener('canplay', done)
      video.addEventListener('error', done)
      // Don't block the transition forever on slow media.
      window.setTimeout(done, 1200)
      video.src = url
      try {
        video.load()
      } catch {
        done()
      }
    })

  return Promise.all([
    loadOne(card.mediaType, card.mediaUrl),
    loadOne(card.backMediaType, card.backUrl),
  ]).then(() => undefined)
}

function AppInner({
  focusCharacterId,
  focusCardId,
  embedded = false,
  initialFocusIndex,
  initialCards,
  initialGroups,
  emptyLabel = 'LOADING',
}: CollectionExperienceProps & {
  initialFocusIndex: number
  initialCards: CardConfig[]
  initialGroups: DeckGroup[]
  emptyLabel?: string
}) {
  const { markReady } = usePageReady()
  const [cards, setCards] = useState<CardConfig[]>(initialCards)
  const [groups, setGroups] = useState<DeckGroup[]>(() => initialGroups)
  const [focusIndex, setFocusIndex] = useState(initialFocusIndex)

  // Admin catalog edits rebuild the deck while preserving focus/active state.
  useEffect(() => {
    setCards(initialCards)
    setGroups(initialGroups)
    setFocusIndex(initialFocusIndex)
  }, [initialCards, initialGroups, initialFocusIndex])
  const [holoTransform] = useState<HoloTransform>(() =>
    normalizeHoloTransform(DEFAULT_HOLO_TRANSFORM),
  )
  const { activeCardId, setActiveCardId } = useActiveCard()
  const { limits } = useDesktopCarousel()

  const layoutSlots = useMemo(
    () => buildLayoutSlots(cards, groups),
    [cards, groups],
  )
  const slotCount = layoutSlots.length

  // Only re-center when the focus prop changes after the initial seeded mount.
  // Returning from Play Game keeps the card open via focusCardId seed.
  const didMountFocusRef = useMemo(() => ({ current: false }), [])
  useEffect(() => {
    if (!didMountFocusRef.current) {
      didMountFocusRef.current = true
      return
    }
    if (!focusCharacterId && !focusCardId) return
    setFocusIndex(
      resolveFocusIndex(cards, groups, focusCharacterId, focusCardId),
    )
    if (!focusCardId) setActiveCardId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCharacterId, focusCardId])

  // Hold route fade until centered card media + first layout paint are ready.
  useEffect(() => {
    let cancelled = false
    const focusSlot = layoutSlots[focusIndex]
    const hero =
      (focusSlot?.kind === 'card' ? cards[focusSlot.cardIndex] : null) ??
      cards[0]

    const run = async () => {
      if (hero) {
        await preloadCardMedia(hero)
        // Nearby cards: warm a couple neighbors so the strip doesn't pop.
        const neighborCards = [focusIndex - 1, focusIndex + 1]
          .map((slotIndex) => layoutSlots[slotIndex])
          .flatMap((slot) => {
            if (!slot || slot.kind !== 'card') return []
            const card = cards[slot.cardIndex]
            return card ? [card] : []
          })
          .slice(0, 2)

        await Promise.all(neighborCards.map((card) => preloadCardMedia(card)))
      }

      if (cancelled) return
      // Two rAFs so layout/carousel measure can settle while still hidden.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled) markReady()
        })
      })
    }

    void run()
    return () => {
      cancelled = true
    }
    // Only on mount / first focused deck — not every ownership tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFocusChange = useCallback(
    (slotIndex: number) => {
      if (activeCardId) return
      setFocusIndex(clampSlotIndex(slotIndex, slotCount))
    },
    [activeCardId, slotCount],
  )

  const handleSelectCard = useCallback(
    (cardIndex: number) => {
      if (activeCardId) return
      const card = cards[cardIndex]
      if (!card) return
      const slots = buildLayoutSlots(cards, groups)
      const slotIndex = findCardSlotIndex(slots, cardIndex)
      setFocusIndex(slotIndex >= 0 ? slotIndex : 0)
      setActiveCardId(card.id)
    },
    [activeCardId, cards, groups, setActiveCardId],
  )

  // Desktop keyboard (browse mode only — open card owns static-slot keys):
  // - ← / → cycle focus across the coverflow
  // - ↑ / Enter opens the focused motion card
  // - Esc / ↓ closes the open motion card (same as the top-right X)
  // While a motion card is open:
  //   ActiveCardPanel → cycle static slots 1–10, Space open selected static,
  //                     Enter opens "Play motion game" stub dialog
  //   HoloCard        → \ flips the motion card
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      if (el.isContentEditable) return true
      return Boolean(el.closest?.('[contenteditable="true"]'))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      // Nested overlays (gift / playing popup) own Escape themselves.
      // Exclude the parent FeaturedCardOverlay dialog so embedded coverflow keys still work.
      if (
        document.querySelector(
          '.static-card-playing, [role="dialog"][aria-modal="true"]:not(.creator-featured-overlay)',
        )
      ) {
        return
      }

      if (
        event.key === 'Escape' ||
        event.key === 'ArrowDown' ||
        event.key === 'Down'
      ) {
        if (!activeCardId) return
        event.preventDefault()
        setActiveCardId(null)
        return
      }

      // Open motion card: static-slot cycling / Space / Enter live on the panel;
      // flip (\) is handled on the active HoloCard.
      if (activeCardId) return

      if (event.key === 'ArrowLeft' || event.key === 'Left') {
        if (focusIndex <= 0) return
        event.preventDefault()
        setFocusIndex(clampSlotIndex(focusIndex - 1, slotCount))
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'Right') {
        if (focusIndex >= slotCount - 1) return
        event.preventDefault()
        setFocusIndex(clampSlotIndex(focusIndex + 1, slotCount))
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'Up' || event.key === 'Enter') {
        const slot = layoutSlots[focusIndex]
        if (!slot || slot.kind !== 'card') return
        const card = cards[slot.cardIndex]
        if (!card) return
        event.preventDefault()
        setActiveCardId(card.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeCardId,
    cards,
    focusIndex,
    layoutSlots,
    setActiveCardId,
    slotCount,
  ])

  return (
    <div
      className={[
        'prototype-app collection-app',
        embedded ? 'collection-app--embedded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <main className="prototype-preview">
        {cards.length === 0 ? (
          <div className="collection-empty" role="status">
            <p>{emptyLabel}</p>
          </div>
        ) : (
          <CardCarousel
            count={slotCount}
            focusIndex={focusIndex}
            onFocusChange={handleFocusChange}
            limits={limits}
            cards={cards}
            groups={groups}
          >
            <SlideDeck
              cards={cards}
              groups={groups}
              focusIndex={focusIndex}
              onFocusChange={handleFocusChange}
              onSelectCard={handleSelectCard}
              onFlipAngleChange={(index, flipAngle) => {
                setCards((prev) =>
                  prev.map((c, i) => (i === index ? { ...c, flipAngle } : c)),
                )
              }}
              limits={limits}
              pinHolo={false}
              holoTransform={holoTransform}
            />
          </CardCarousel>
        )}
      </main>
    </div>
  )
}

export function CollectionExperience(props: CollectionExperienceProps) {
  const catalog = useCatalog()
  const [searchParams] = useSearchParams()
  const selectedModelId =
    props.modelId?.trim() || searchParams.get('model')?.trim() || null
  const focusCardId =
    props.focusCardId?.trim() || searchParams.get('card')?.trim() || null
  const focusThemeId = themeIdFromCardHint(focusCardId, selectedModelId)
  const cachedCatalog = peekCollectionCatalog(
    catalog.productSharedMedia.girlName,
    selectedModelId,
  )
  const [backendCatalog, setBackendCatalog] =
    useState<BackendCollectionCatalog | null>(() => cachedCatalog ?? null)
  const [catalogLoaded, setCatalogLoaded] = useState(
    () => cachedCatalog !== undefined,
  )

  useEffect(() => {
    if (!catalog.productReady) return
    let cancelled = false
    const warm = peekCollectionCatalog(
      catalog.productSharedMedia.girlName,
      selectedModelId,
    )
    if (warm !== undefined) {
      setBackendCatalog(warm)
      setCatalogLoaded(true)
    } else {
      setCatalogLoaded(false)
    }
    // Theme-first pagination: focused theme paints immediately, others merge in.
    void fetchCollectionCatalogPaginated({
      catalogGirlName: catalog.productSharedMedia.girlName,
      modelId: selectedModelId,
      themeId: focusThemeId,
      onPage: (result) => {
        if (cancelled) return
        setBackendCatalog(result)
        setCatalogLoaded(true)
      },
    }).then((result) => {
      if (cancelled) return
      setBackendCatalog(result)
      setCatalogLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [
    catalog.productReady,
    catalog.productSharedMedia.girlName,
    selectedModelId,
    focusThemeId,
  ])

  // API deck when available; otherwise a single loading mockup card.
  // No full local catalog mockup — only this one-element loading state.
  const boot = useMemo(() => {
    if (!catalog.productReady) {
      const seed = createLoadingMockDeck(createCard)
      return {
        cards: seed.cards,
        groups: seed.groups,
        focusIndex: 0,
        activeCardId: null as string | null,
        sourceKey: 'loading-api',
        emptyLabel: 'LOADING',
      }
    }

    const productShared = catalog.resolveProductSharedMedia(selectedModelId)
    const overlay = cardFaceOverlayFromShared(productShared)
    const backendGroups =
      backendCatalog?.groups.filter(
        (group) => !selectedModelId || group.modelId === selectedModelId,
      ) ?? []
    if (backendGroups.length > 0) {
      const seed = createBackendDeck(createCard, backendGroups, {
        overlay,
        overlayForGroup: (group: { modelId: string; themeId?: string | null }) =>
          cardFaceOverlayFromShared(
            catalog.resolveProductSharedMedia(group.modelId, group.themeId),
          ),
      })
      const activeId =
        focusCardId && seed.cards.some((card) => card.id === focusCardId)
          ? focusCardId
          : null
      return {
        cards: seed.cards,
        groups: seed.groups,
        focusIndex: resolveFocusIndex(
          seed.cards,
          seed.groups,
          props.focusCharacterId,
          focusCardId,
          catalog.byId,
        ),
        activeCardId: activeId,
        sourceKey: `backend:${selectedModelId ?? 'all'}`,
        emptyLabel: 'LOADING',
      }
    }

    if (!catalogLoaded) {
      const seed = createLoadingMockDeck(createCard)
      return {
        cards: seed.cards,
        groups: seed.groups,
        focusIndex: 0,
        activeCardId: null as string | null,
        sourceKey: 'loading',
        emptyLabel: 'LOADING',
      }
    }

    return {
      cards: [] as CardConfig[],
      groups: [] as DeckGroup[],
      focusIndex: 0,
      activeCardId: null as string | null,
      sourceKey: 'empty',
      emptyLabel: 'No cards yet',
    }
  }, [
    backendCatalog,
    catalogLoaded,
    props.focusCharacterId,
    focusCardId,
    selectedModelId,
    catalog.productReady,
    catalog.byId,
    catalog.productSharedMedia,
    catalog.resolveProductSharedMedia,
  ])

  return (
    <ActiveCardProvider initialActiveCardId={boot.activeCardId}>
      <AppInner
        key={`${boot.sourceKey}:${boot.activeCardId ?? 'browse'}`}
        {...props}
        focusCardId={focusCardId}
        initialCards={boot.cards}
        initialGroups={boot.groups}
        initialFocusIndex={boot.focusIndex}
        emptyLabel={boot.emptyLabel}
      />
    </ActiveCardProvider>
  )
}

export default CollectionExperience
