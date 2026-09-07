// @ts-nocheck
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import ActiveCardPanel from './ActiveCardPanel'
import HoloCard from './HoloCard'
import type { CardConfig } from '../lib/cards'
import { useActiveCard } from '../context/ActiveCardContext'
import { useCarousel } from '../context/CarouselContext'
import {
  DEFAULT_EFFECT_INDEX,
  DEFAULT_GROUP_AVATAR_URL,
  getGroupAvatarUrl,
  HOLO_EFFECTS,
} from '../lib/effects'
import { useCatalog } from '@/shared/catalog/CatalogContext'
import type { HoloTransform } from '../lib/holoTransform'
import {
  buildGroupSpans,
  buildLayoutSlots,
  clampSlotIndex,
  getFullGroupWidth,
  getRelativeSlotX,
  type DeckGroup,
  type LayoutSlot,
} from '../lib/cardGroups'
import {
  getPhotoFilledCount,
  getVideoCardCount,
  PHOTO_SLOTS,
  photoScratchIdForSlot,
} from '../lib/photoSlots'
import { useNavigate } from 'react-router-dom'
import { Paths } from '@/routes/Paths'
import { unlockCountdownSound } from '@/features/game/modules/InitialCountdown'
import { useCollectionActions } from '../CollectionActionsContext'
import {
  DESKTOP_LAYOUT,
  getLoadedIndexRange,
  getSlideTarget,
  makeLayoutMetrics,
  rubberBandDragOffset,
  SPRING_DAMPING,
  SPRING_DAMPING_FAST,
  SPRING_STIFFNESS,
  SPRING_STIFFNESS_FAST,
  stepSpring,
  type LayoutMetrics,
  type VisibilityLimits,
} from '../lib/carouselLayout'

function clampEffectIndex(index: unknown): number {
  const max = HOLO_EFFECTS.length - 1
  if (typeof index !== 'number' || !Number.isFinite(index)) {
    return DEFAULT_EFFECT_INDEX
  }
  return Math.min(Math.max(Math.round(index), 0), Math.max(max, 0))
}

function CardMetaPlayIcon() {
  return (
    <svg
      className="coverflow__meta-icon coverflow__meta-icon--play"
      width="23"
      height="17"
      viewBox="0 0 18.2 13.2"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M17.8,0H.5C.2,0,0,.2,0,.5v12.2c0,.3.2.5.5.5h17.2c.3,0,.5-.2.5-.5V.5c0-.3-.2-.5-.5-.5M11.3,6.8l-3.3,2.6c0,0-.3,0-.3-.1v-5.2c0-.2.2-.2.3,0l3.3,2.6v.3h0"
      />
    </svg>
  )
}

function CardMetaPhotoIcon() {
  return (
    <svg
      className="coverflow__meta-icon coverflow__meta-icon--photo"
      width="17"
      height="17"
      viewBox="0 0 56 56"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M7.715 49.574h40.57c4.899 0 7.36-2.437 7.36-7.265V13.69c0-4.828-2.461-7.265-7.36-7.265H7.715C2.84 6.426.355 8.84.355 13.69v28.62c0 4.851 2.485 7.265 7.36 7.265m10.218-21c-3.187 0-5.789-2.601-5.789-5.789c0-3.164 2.602-5.789 5.79-5.789c3.164 0 5.765 2.625 5.765 5.79c0 3.187-2.601 5.788-5.766 5.788M7.762 45.801c-2.25 0-3.633-1.36-3.633-3.657v-1.43l7.195-6.28c1.031-.914 2.156-1.383 3.211-1.383c1.125 0 2.32.469 3.352 1.43l4.5 4.03l11.18-9.937c1.171-1.031 2.46-1.5 3.773-1.5c1.289 0 2.625.492 3.75 1.524l10.78 9.984v3.61c0 2.25-1.405 3.609-3.632 3.609Z"
      />
    </svg>
  )
}

/** Read a CSS length custom property as px (handles px / rem / bare numbers). */
function readCssLengthPx(el: Element, prop: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(prop).trim()
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return fallback
  if (raw.endsWith('rem')) {
    const root =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
      16
    return n * root
  }
  // Registered <length> props usually resolve to px; bare numbers treat as px.
  return n
}

/** Read a unitless CSS number custom property (e.g. registered <number>). */
function readCssNumber(el: Element, prop: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(prop).trim()
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

type Motion = {
  x: number
  vx: number
  scale: number
  vScale: number
  opacity: number
  brightness: number
}

type SlideDeckProps = {
  cards: CardConfig[]
  groups: DeckGroup[]
  /** Focused layout-slot index (empty placeholders are valid). */
  focusIndex: number
  /** Focus change by layout-slot index. */
  onFocusChange: (slotIndex: number) => void
  /** Click a non-left card: scroll it to hero slot + activate. */
  onSelectCard: (cardIndex: number) => void
  onFlipAngleChange: (index: number, flipAngle: number) => void
  limits: VisibilityLimits
  /** Debug: force holo visible on active card. */
  pinHolo?: boolean
  /** Debug: shared holo transform / color knobs. */
  holoTransform?: HoloTransform
}

type DeckItemProps = {
  card: CardConfig
  /** Real card index (for media / flip state). */
  index: number
  /** Layout-slot index used for carousel focus. */
  slotIndex: number
  /** Only the focused card is expandable; updated via class in rAF too. */
  expandable: boolean
  /** Dim this non-active neighbor (right-side only — left strip stays full). */
  isDimmed: boolean
  /** This item is the selected hero. */
  isActiveItem: boolean
  /** Outside the active card's group — blur when a selection is open. */
  isInactiveGroupItem: boolean
  pinHolo: boolean
  holoTransform?: HoloTransform
  onFocusChange: (slotIndex: number) => void
  onSelectCard: (cardIndex: number) => void
  onFlipAngleChange: (index: number, flipAngle: number) => void
  onCloseActive: () => void
  registerNode: (id: string, node: HTMLDivElement | null) => void
  /** Bubble face-ready up so group titles can say LOADING too. */
  onFaceMediaReady?: (cardId: string, ready: boolean) => void
}

const DeckItem = memo(function DeckItem({
  card,
  index,
  slotIndex,
  expandable,
  isDimmed,
  isActiveItem,
  isInactiveGroupItem,
  pinHolo,
  holoTransform,
  onFocusChange,
  onSelectCard,
  onFlipAngleChange,
  onCloseActive,
  registerNode,
  onFaceMediaReady,
}: DeckItemProps) {
  const navigate = useNavigate()
  const actions = useCollectionActions()
  // Keep a neutral effect object so HoloCard props stay stable while holos are off.
  const effect =
    HOLO_EFFECTS[clampEffectIndex(card.effectIndex)] ??
    HOLO_EFFECTS[DEFAULT_EFFECT_INDEX]!

  /**
   * A still poster is already visible face media. Seed / reset from that so
   * captions do not get stuck on LOADING: HoloCard reports ready on first
   * paint when a poster exists, and this child's effect runs *before* a
   * parent `setFaceReady(false)` reset — so a false reset would never hear
   * a second `true` (ready stays true, callback deps do not change).
   */
  const posterReady = Boolean(card.posterUrl?.trim())
  const faceMediaKey = `${card.id}\0${card.mediaUrl}\0${card.mediaType}\0${card.posterUrl ?? ''}`
  const [faceReady, setFaceReady] = useState(posterReady)
  const [faceMediaKeySeen, setFaceMediaKeySeen] = useState(faceMediaKey)
  if (faceMediaKeySeen !== faceMediaKey) {
    setFaceMediaKeySeen(faceMediaKey)
    setFaceReady(posterReady)
  }

  const handleFaceMediaReady = useCallback(
    (ready: boolean) => {
      setFaceReady(ready)
      onFaceMediaReady?.(card.id, ready)
    },
    [card.id, onFaceMediaReady],
  )

  const handlePlayPhotoCard = useCallback(
    (slotIndex: number) => {
      const motion = card.id.trim()
      if (!motion) return
      const photoId = photoScratchIdForSlot(motion, slotIndex)
      const model = (card.modelId || '').trim()
      unlockCountdownSound()
      if (actions.onPlayPhotoCard) {
        actions.onPlayPhotoCard(model, photoId, slotIndex)
        return
      }
      navigate(
        Paths.photoScratchPlay(photoId, {
          modelId: model || undefined,
        }),
      )
    },
    [actions, card.id, card.modelId, navigate],
  )

  // One source of truth for the play meta "Nx" and the stack-back layers.
  // Underlays are meta count minus one: 2→1, 3→2, 4→3. ≤1 → none.
  // Cap underlays at 3 even for 5x+. Hidden while active.
  const videoCount = getVideoCardCount(card.id, card.videoCardCount)
  const photoCount = getPhotoFilledCount(
    card.id,
    card.photoFilledCount,
    card.photoUrls,
  )
  const stackLayers =
    videoCount > 1
      ? Math.min(Math.max(0, Math.floor(videoCount) - 1), 3)
      : 0

  return (
    <div
      ref={(node) => registerNode(card.id, node)}
      className={`coverflow__item${isActiveItem ? ' is-active-item' : ''}${
        isDimmed ? ' is-dimmed' : ''
      }${isInactiveGroupItem ? ' is-inactive-group-item' : ''}`}
      data-index={index}
      data-slot-index={slotIndex}
      data-card-id={card.id}
      style={
        {
          opacity: 1,
          transform: 'translate3d(0px, -50%, 0)',
          zIndex: 100,
        } as CSSProperties
      }
    >
      <div className="coverflow__card">
        {/*
          Stack underlays match coverflow__meta-text play count ("Nx").
          Same footprint as .card; no holo/motion. Hidden while active.
        */}
        {stackLayers > 0 &&
          Array.from({ length: stackLayers }, (_, layer) => {
            // layer 0 = rearmost (highest offset), last = nearest the face.
            const stackI = stackLayers - layer
            return (
              <div
                key={`stack-back-${card.id}-${stackI}`}
                className={`coverflow__stack-back${
                  isActiveItem ? ' is-hidden' : ''
                }`}
                style={{ '--stack-i': stackI } as CSSProperties}
                aria-hidden="true"
              />
            )
          })}
        <HoloCard
          cardKey={card.id}
          cardName={card.name}
          videoCardCount={card.videoCardCount}
          modelId={card.modelId}
          photoFilledCount={card.photoFilledCount}
          photoUrls={card.photoUrls}
          rolePhotoFilledCount={card.rolePhotoFilledCount}
          giftVideoUrl={card.giftVideoUrl}
          overlay={card.overlay}
          src={card.mediaUrl}
          mediaType={card.mediaType}
          poster={card.posterUrl}
          back={card.backUrl}
          backMediaType={card.backMediaType}
          effect={effect}
          foil=""
          mask=""
          fullBleed={true}
          backHolo={true}
          flipAngle={card.flipAngle}
          onFlipAngleChange={(flipAngle) =>
            onFlipAngleChange(index, flipAngle)
          }
          expandable={expandable}
          pinHolo={pinHolo && isActiveItem}
          holoTransform={holoTransform ?? card.holoTransform}
          onFaceMediaReady={handleFaceMediaReady}
          // Focused card toggles active itself; side cards scroll left + activate.
          onSelect={() =>
            expandable ? onFocusChange(slotIndex) : onSelectCard(index)
          }
        />
      </div>
      {/*
        Mount the photo grid only while this card is the active selection.
        ActiveCardPanel keeps itself mounted through EXIT_MS for the reverse
        stagger, so we don't need expandable pre-mount (that was still racing
        focus/activate on mobile after long scrubs).
      */}
      {isActiveItem && (
        <ActiveCardPanel
          cardName={card.name}
          cardKey={card.id}
          videoCardCount={card.videoCardCount}
          photoFilledCount={card.photoFilledCount}
          photoUrls={card.photoUrls}
          rolePhotoFilledCount={card.rolePhotoFilledCount}
          giftVideoUrl={card.giftVideoUrl}
          visible
          gridOnly
          onClose={onCloseActive}
          onPlayPhotoCard={handlePlayPhotoCard}
        />
      )}
      <div
        className={`coverflow__caption${
          isActiveItem ? ' is-active-hidden' : ''
        }${faceReady ? '' : ' is-loading'}`}
      >
        <p className="coverflow__label">
          {faceReady ? card.name : 'LOADING'}
        </p>
        <div className="coverflow__meta" aria-hidden="true">
          <span className="coverflow__meta-item">
            <CardMetaPlayIcon />
            <span className="coverflow__meta-text">
              {faceReady ? `${videoCount}x` : 'LOADING'}
            </span>
          </span>
          <span className="coverflow__meta-divider" />
          <span className="coverflow__meta-item">
            <CardMetaPhotoIcon />
            <span className="coverflow__meta-text">
              {faceReady ? `${photoCount}/${PHOTO_SLOTS}` : 'LOADING'}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
})

type PlaceholderItemProps = {
  slotKey: string
  groupTheme: string
  isInactiveGroupItem: boolean
  registerNode: (id: string, node: HTMLDivElement | null) => void
}

const PlaceholderItem = memo(function PlaceholderItem({
  slotKey,
  groupTheme,
  isInactiveGroupItem,
  registerNode,
}: PlaceholderItemProps) {
  return (
    <div
      ref={(node) => registerNode(slotKey, node)}
      className={`coverflow__item coverflow__item--placeholder${
        isInactiveGroupItem ? ' is-inactive-group-item' : ''
      }`}
      data-slot-key={slotKey}
      aria-hidden="true"
      style={
        {
          opacity: 0.55,
          transform: 'translate3d(0px, -50%, 0)',
          zIndex: 40,
        } as CSSProperties
      }
    >
      <div className="coverflow__placeholder" title={`${groupTheme} empty slot`}>
        <span className="coverflow__placeholder-plus">+</span>
        <span className="coverflow__placeholder-label">Empty slot</span>
      </div>
    </div>
  )
})

/**
 * Flat left-anchored deck with per-slot springs matching sugar-scracth3dpack:
 *
 *   stiff / damp via stepSpring
 *   focusIndex is discrete/finite; each slot springs its own x/scale toward
 *   getSlideTarget. Group strokes follow the same springing slot positions —
 *   never snap ahead of the cards.
 */
export default function SlideDeck({
  cards,
  groups,
  focusIndex,
  onFocusChange,
  onSelectCard,
  onFlipAngleChange,
  limits,
  pinHolo = false,
  holoTransform,
}: SlideDeckProps) {
  const catalog = useCatalog()
  const { activeCardId, setActiveCardId } = useActiveCard()
  const { getDragOffsetPx, getSwipeIntensity, isDragging } = useCarousel()
  const hasActiveSelection = activeCardId !== null
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const motionRefs = useRef<Map<string, Motion>>(new Map())
  const focusIndexRef = useRef(focusIndex)
  const cardsRef = useRef(cards)
  const groupsRef = useRef(groups)
  const limitsRef = useRef(limits)
  const isDraggingRef = useRef(isDragging)
  const hasActiveSelectionRef = useRef(hasActiveSelection)
  const getSwipeIntensityRef = useRef(getSwipeIntensity)
  const layoutMetricsRef = useRef<LayoutMetrics>(DESKTOP_LAYOUT)
  /** cardId → face media ready (drives group title LOADING state). */
  const [faceReadyByCardId, setFaceReadyByCardId] = useState<
    Record<string, boolean>
  >({})

  const handleFaceMediaReady = useCallback((cardId: string, ready: boolean) => {
    setFaceReadyByCardId((prev) => {
      if (prev[cardId] === ready) return prev
      return { ...prev, [cardId]: ready }
    })
  }, [])

  useEffect(() => {
    // Drop readiness for cards that left the deck (catalog swap / remount).
    const live = new Set(cards.map((c) => c.id))
    setFaceReadyByCardId((prev) => {
      let changed = false
      const next: Record<string, boolean> = {}
      for (const [id, ready] of Object.entries(prev)) {
        if (live.has(id)) next[id] = ready
        else changed = true
      }
      return changed ? next : prev
    })
  }, [cards])
  useEffect(() => {
    focusIndexRef.current = focusIndex
  }, [focusIndex])
  useEffect(() => {
    cardsRef.current = cards
  }, [cards])
  useEffect(() => {
    groupsRef.current = groups
  }, [groups])
  useEffect(() => {
    limitsRef.current = limits
  }, [limits])
  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])
  useEffect(() => {
    hasActiveSelectionRef.current = hasActiveSelection
  }, [hasActiveSelection])
  useEffect(() => {
    getSwipeIntensityRef.current = getSwipeIntensity
  }, [getSwipeIntensity])

  // Keep layout math in sync with CSS (mobile shrinks cards + gap).
  // Use offsetWidth (layout box) — never getBoundingClientRect, which includes
  // spring/hover scale and made the group stroke lose its right pad.
  useEffect(() => {
    const sample = () => {
      const frame =
        (document.querySelector('.coverflow__frame') as HTMLElement | null) ??
        null
      let item: HTMLElement | undefined
      for (const el of itemRefs.current.values()) {
        if (el.offsetWidth > 0) {
          item = el
          break
        }
      }
      if (!frame && !item) return

      const measuredWidth = item?.offsetWidth ?? 0
      const width =
        measuredWidth > 0
          ? measuredWidth
          : frame
            ? readCssLengthPx(
                frame,
                '--rendered-card-width',
                DESKTOP_LAYOUT.cardWidth
              )
            : DESKTOP_LAYOUT.cardWidth
      const gap = frame
        ? readCssLengthPx(frame, '--card-gap', DESKTOP_LAYOUT.cardGap)
        : DESKTOP_LAYOUT.cardGap
      layoutMetricsRef.current = makeLayoutMetrics(width, gap)
    }
    sample()
    // Remeasure after paint so newly mounted items have layout.
    const raf = requestAnimationFrame(sample)
    window.addEventListener('resize', sample)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', sample)
    }
  }, [cards, groups, focusIndex, activeCardId])

  const registerNode = useMemo(
    () => (id: string, node: HTMLDivElement | null) => {
      if (node) itemRefs.current.set(id, node)
      else {
        itemRefs.current.delete(id)
        // Keep motion so remounts near the edge don't pop from 0.
      }
    },
    []
  )

  const layoutSlots = useMemo(
    () => buildLayoutSlots(cards, groups),
    [cards, groups]
  )

  // Seed motion for newly mounted slots at their current target.
  useEffect(() => {
    const focus = focusIndexRef.current
    const vis = limitsRef.current
    const metrics = layoutMetricsRef.current
    const list = cards
    const groupList = groups
    const slots = buildLayoutSlots(list, groupList)
    const origin = clampSlotIndex(focus, slots.length)
    const live = new Set(slots.map((s) => s.key))

    for (const id of [...motionRefs.current.keys()]) {
      if (!live.has(id)) motionRefs.current.delete(id)
    }

    slots.forEach((slot, slotIndex) => {
      if (motionRefs.current.has(slot.key)) return
      const offset = slotIndex - origin
      const x = getRelativeSlotX(slots, origin, slotIndex, metrics)
      const target = getSlideTarget(offset, vis, x)
      motionRefs.current.set(slot.key, {
        x: target.x,
        vx: 0,
        scale: target.scale,
        vScale: 0,
        opacity: target.opacity,
        brightness: target.brightness,
      })
    })
  }, [cards, groups, focusIndex, limits])

  // rAF loop — same integrator family as CoverFlowPack useFrame in 3dpack,
  // with variable gaps (2×) between themed groups. Group frames sample the
  // springing slot positions so the stroke eases with the cards.
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const frameDelta = (now - last) / 1000
      last = now
      const dt = Math.min(frameDelta, 1 / 30)

      const list = cardsRef.current
      const groupList = groupsRef.current
      const slots = buildLayoutSlots(list, groupList)
      const focus = focusIndexRef.current
      const vis = limitsRef.current
      const metrics = layoutMetricsRef.current
      const originSlot = clampSlotIndex(focus, slots.length)
      const isActiveOpen = hasActiveSelectionRef.current
      // Sample once per frame — rapid swipes → snappier settle springs.
      const swipeIntensity = getSwipeIntensityRef.current()
      const springStiff =
        SPRING_STIFFNESS +
        (SPRING_STIFFNESS_FAST - SPRING_STIFFNESS) * swipeIntensity
      const springDamp =
        SPRING_DAMPING + (SPRING_DAMPING_FAST - SPRING_DAMPING) * swipeIntensity

      // Real pixel spans to the ends (group gaps included).
      // Left-anchored: free drag range is exactly these distances, and empty
      // placeholder slots count as real stops.
      const toFirstPx =
        originSlot > 0
          ? Math.abs(getRelativeSlotX(slots, originSlot, 0, metrics))
          : 0
      const toLastPx =
        originSlot < slots.length - 1
          ? Math.abs(
              getRelativeSlotX(slots, originSlot, slots.length - 1, metrics)
            )
          : 0

      // Browse = hard clamp (no overshoot past first/last).
      // Active open allows soft rubber (room for photo grid / open hero give).
      // Sample scrub from the shared ref API (no React re-render per move).
      const dragPx = rubberBandDragOffset(
        getDragOffsetPx(),
        originSlot,
        slots.length,
        metrics.cardStep,
        { toFirstPx, toLastPx },
        isActiveOpen ? 'active' : 'browse'
      )

      /*
       * End-align while browsing near the right end.
       *
       * Pure left-anchoring keeps the focus hero on the left, so when you reach
       * the last cards the deck sits on the LEFT with a huge empty RIGHT.
       * While browsing we shift the row so the trailing edge packs to the right.
       * When a card is active we keep left-anchoring for the photo grid.
       */
      let endAlignShift = 0
      let viewSpan = 0
      const probe =
        itemRefs.current.values().next().value ??
        document.querySelector('.coverflow__viewport')
      const viewportEl =
        (probe as HTMLElement | null)?.closest?.(
          '.coverflow__viewport'
        ) as HTMLElement | null
      const viewportW =
        viewportEl?.clientWidth ||
        (typeof window !== 'undefined' ? window.innerWidth : 0)
      const stageLeft = viewportEl
        ? readCssLengthPx(viewportEl, '--stage-left-safe', metrics.cardWidth)
        : metrics.cardWidth
      const stageRight = viewportEl
        ? readCssLengthPx(viewportEl, '--stage-right-safe', metrics.cardWidth)
        : metrics.cardWidth
      viewSpan = Math.max(0, viewportW - stageLeft - stageRight)

      if (!isActiveOpen) {
        // Full deck width from first→last + one card.
        const deckSpan = toFirstPx + toLastPx + metrics.cardWidth
        const maxScroll = Math.max(0, deckSpan - viewSpan)
        // How far we've "scrolled" from the start (left-anchored).
        const scroll = toFirstPx
        // Once scroll would leave empty space on the right, push the row right
        // so the last card packs against the right safe zone.
        if (scroll > maxScroll) {
          endAlignShift = scroll - maxScroll
        }
      }

      const virtualFocus = originSlot - dragPx / metrics.cardStep
      // Approximate which layout-slot window is "active" for mount culling.
      // Focus is already slot-based, so empty placeholders stay in-window.
      const windowFocus = Math.round(virtualFocus)
      const { min, max } = getLoadedIndexRange(
        windowFocus,
        slots.length,
        vis
      )

      // When end-aligned, older groups slide into view on the left — expand the
      // mount window so those cards aren't culled (would show empty group frames).
      const extraLeftSlots =
        endAlignShift > 0
          ? Math.ceil(endAlignShift / Math.max(1, metrics.cardStep)) + 14
          : 2
      // When end-aligned, keep the entire left side of the deck mounted/visible —
      // one missing card was still being culled at the far left edge.
      const slotMin =
        endAlignShift > 0 ? 0 : Math.max(0, min - extraLeftSlots)
      const slotMax = Math.min(slots.length - 1, max + 6)
      // Track which slot keys actually integrated this frame. Group strokes
      // must not use stale spring x for slots that were culled/hidden.
      const integratedKeys = new Set<string>()

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex]!
        const el = itemRefs.current.get(slot.key)
        if (!el) continue

        // Off-window: hide without integrating (keeps CPU down).
        if (slotIndex < slotMin || slotIndex > slotMax) {
          el.style.visibility = 'hidden'
          el.style.pointerEvents = 'none'
          continue
        }

        integratedKeys.add(slot.key)
        const offset = slotIndex - originSlot - dragPx / metrics.cardStep
        // Left-anchored relative X + drag + optional end-align while browsing.
        const x =
          getRelativeSlotX(slots, originSlot, slotIndex, metrics) +
          dragPx +
          endAlignShift
        const target = getSlideTarget(offset, vis, x)

        /*
         * End-align can move cards that are "far left of focus" into the real
         * viewport. getSlideTarget still treats them as off-stage (opacity 0)
         * because it only knows focus-relative offset. Restore left-card look
         * for anything that actually sits on-screen after the shift.
         */
        if (endAlignShift > 0 && !isActiveOpen) {
          const cardW = metrics.cardWidth
          // Generous left threshold so a partially-visible leading card stays filled.
          const onScreen = x > -cardW * 1.35 && x < viewSpan + cardW * 0.35
          if (onScreen && target.opacity < 0.5) {
            if (offset < 0) {
              // Same soft treatment as normal previous cards.
              target.opacity = 0.92
              target.brightness = 0.88
              target.scale = Math.max(0.96, 0.99 + Math.max(offset, -8) * 0.01)
            } else {
              target.opacity = Math.max(target.opacity, 0.55)
              target.brightness = Math.max(target.brightness, 0.7)
              target.scale = Math.max(target.scale, 0.92)
            }
          }
        }

        let motion = motionRefs.current.get(slot.key)
        if (!motion) {
          motion = {
            x: target.x,
            vx: 0,
            scale: target.scale,
            vScale: 0,
            opacity: target.opacity,
            brightness: target.brightness,
          }
          motionRefs.current.set(slot.key, motion)
        }

        if (isDraggingRef.current) {
          motion.x = target.x
          motion.vx = 0
          motion.scale = target.scale
          motion.vScale = 0
          // Snap opacity/brightness while dragging only for large jumps
          // (e.g. end-aligned left groups popping on-stage). Small lighting
          // changes ease so the next-card dim lifts smoothly into the hero.
          const lightJump =
            Math.abs(target.opacity - motion.opacity) > 0.25 ||
            Math.abs(target.brightness - motion.brightness) > 0.25
          if (lightJump) {
            motion.opacity = target.opacity
            motion.brightness = target.brightness
          }
        } else {
          // Rapid successive stage swipes raise intensity → snappier settle.
          // Still one card per swipe; this only speeds the spring trajectory.
          const nextX = stepSpring(
            motion.x,
            motion.vx,
            target.x,
            dt,
            springStiff,
            springDamp
          )
          motion.x = nextX.value
          motion.vx = nextX.velocity

          const nextScale = stepSpring(
            motion.scale,
            motion.vScale,
            target.scale,
            dt,
            springStiff,
            springDamp
          )
          motion.scale = nextScale.value
          motion.vScale = nextScale.velocity
        }

        // Lighting eases independently of x/scale springs.
        // Brightening into the left hero is slower so it reads as a fade-up
        // rather than a hard state flip when focus settles.
        const brightening = target.brightness > motion.brightness + 0.001
        const lightRate = brightening ? 3.2 : 7.5
        const visualLerp = 1 - Math.exp(-lightRate * dt)
        motion.opacity =
          motion.opacity + (target.opacity - motion.opacity) * visualLerp
        motion.brightness =
          motion.brightness +
          (target.brightness - motion.brightness) * visualLerp

        if (
          Math.abs(target.x - motion.x) < 0.05 &&
          Math.abs(motion.vx) < 1
        ) {
          motion.x = target.x
          motion.vx = 0
        }
        if (
          Math.abs(target.scale - motion.scale) < 0.0005 &&
          Math.abs(motion.vScale) < 0.01
        ) {
          motion.scale = target.scale
          motion.vScale = 0
        }
        if (Math.abs(target.opacity - motion.opacity) < 0.002) {
          motion.opacity = target.opacity
        }
        if (Math.abs(target.brightness - motion.brightness) < 0.002) {
          motion.brightness = target.brightness
        }

        const isFocused =
          slot.kind === 'card' && Math.abs(offset) < 0.5
        // Only treat as background when actually off to the left of the stage
        // after end-align — not merely "left of focus" in index space.
        const isBackground =
          offset < -0.5 && x + metrics.cardWidth * 0.5 < 0
        const isActiveHero = el.classList.contains('is-active-item')
        const hasActive =
          document.querySelector('.coverflow__item.is-active-item') !== null

        // Always drive from the eased motion values — never snap the focused
        // card to full brightness, so the light-up animates into the hero slot.
        let brightness = motion.brightness
        let opacity = Math.max(0, Math.min(1, motion.opacity))

        if (slot.kind === 'placeholder') {
          // Keep empty slots readable but quieter than real cards.
          brightness = Math.min(brightness, 0.85)
          opacity = Math.min(opacity, 0.72)
        }

        // When any card is open, every non-hero (left, right, same group,
        // placeholders) shares the same dim + blur treatment. No left special case.
        const inactiveWhileActive = hasActive && !isActiveHero
        if (inactiveWhileActive) {
          brightness = Math.min(brightness, 0.35)
          opacity = Math.min(opacity, 0.55)
        }

        // Hover scale/lift ease via CSS; fold them into the live transform.
        // Skip hover lift/dim while a hero is open so left cards can't re-brighten.
        const hoverBright = inactiveWhileActive
          ? 1
          : readCssNumber(el, '--hover-bright', 1)
        const hoverFade = inactiveWhileActive
          ? 1
          : readCssNumber(el, '--hover-fade', 1)
        const hoverScale = inactiveWhileActive
          ? 1
          : readCssNumber(el, '--hover-scale', 1)
        const hoverLift = inactiveWhileActive
          ? 0
          : readCssLengthPx(el, '--hover-lift', 0)
        brightness *= hoverBright
        opacity = Math.max(0, Math.min(1, opacity * hoverFade))
        const scale = motion.scale * hoverScale
        // Cards are centered with translateY(-50%); extra lift is applied after that.
        const y = hoverLift

        el.style.visibility = 'visible'
        el.style.opacity = String(opacity)
        el.style.zIndex = String(
          isActiveHero
            ? 300
            : isFocused && !hasActive
              ? 200
              : slot.kind === 'placeholder'
                ? Math.max(30, target.zIndex - 40)
                : target.zIndex
        )
        el.style.transform = `translate3d(${motion.x.toFixed(2)}px, calc(-50% + ${y.toFixed(2)}px), 0) scale(${scale})`
        // Sample transitioned --item-blur; also force blur for inactive-while-active
        // so left/background cards can't stay sharp if the class lags a frame.
        const itemBlur = readCssLengthPx(el, '--item-blur', 0)
        const forcedBlur = inactiveWhileActive ? Math.max(itemBlur, 10) : itemBlur
        const blurPart =
          forcedBlur > 0.05 ? `blur(${forcedBlur.toFixed(2)}px) ` : ''
        if (isActiveHero) {
          el.style.filter = 'none'
        } else if (inactiveWhileActive) {
          el.style.filter = `${blurPart}brightness(${brightness})`
        } else if (isFocused && forcedBlur <= 0.05 && Math.abs(brightness - 1) < 0.01) {
          el.style.filter = 'none'
        } else {
          el.style.filter = `${blurPart}brightness(${brightness})`
        }
        el.classList.toggle('is-focused', isFocused)
        el.classList.toggle('is-background', isBackground)
        // Keep dim class in sync for CSS blur var even on left/background cards.
        if (slot.kind === 'card') {
          el.classList.toggle('is-dimmed', inactiveWhileActive)
          el.classList.toggle('is-inactive-group-item', inactiveWhileActive)
        } else {
          el.classList.toggle('is-inactive-group-item', inactiveWhileActive)
        }
        el.style.pointerEvents =
          slot.kind === 'placeholder' ||
          isBackground ||
          inactiveWhileActive
            ? 'none'
            : 'auto'
      }

      // Position themed group strokes every frame from layout + optional live
      // spring of the first slot. Never leave a frame with a stale transform —
      // that was the "stroke stuck in place" bug after fast mobile scrubs.
      const spans = buildGroupSpans(list, groupList)
      for (const span of spans) {
        const frameEl = groupRefs.current.get(span.id)
        if (!frameEl) continue

        // Hide only when the whole group is outside the live window.
        if (span.endSlot < slotMin || span.startSlot > slotMax) {
          frameEl.style.visibility = 'hidden'
          continue
        }

        // Layout X always moves with focus/drag/end-align — safe fallback.
        const layoutX =
          getRelativeSlotX(slots, originSlot, span.startSlot, metrics) +
          dragPx +
          endAlignShift

        // Prefer a live spring only if that first slot integrated this frame
        // AND we're not mid-scrub (during drag, springs can lag/stale while
        // the row is finger-driven). Layout math keeps strokes locked to cards.
        const startSlot = slots[span.startSlot]
        const startMotion = startSlot
          ? motionRefs.current.get(startSlot.key)
          : undefined
        const useSpring =
          !isDraggingRef.current &&
          !!startSlot &&
          integratedKeys.has(startSlot.key) &&
          typeof startMotion?.x === 'number'
        const startX = useSpring ? startMotion!.x : layoutX

        const padX = readCssLengthPx(frameEl, '--group-pad-x', 22)
        const frameWidth = getFullGroupWidth(padX, metrics)

        // Always rewrite transform/width every frame so a culled first-slot
        // can never leave the stroke frozen at a previous position.
        frameEl.style.visibility = 'visible'
        frameEl.style.transform = `translate3d(${(startX - padX).toFixed(2)}px, -50%, 0)`
        frameEl.style.width = `${frameWidth.toFixed(2)}px`
      }

      for (const [id, el] of itemRefs.current) {
        const slotIndex = slots.findIndex((s) => s.key === id)
        if (slotIndex < slotMin || slotIndex > slotMax || slotIndex < 0) {
          el.style.visibility = 'hidden'
          el.style.pointerEvents = 'none'
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Finite load window over layout slots (cards + empty placeholders).
  // Near the end of the deck, also cover end-align: older groups that slide
  // into the left side of the viewport must stay mounted.
  const slotCount = layoutSlots.length
  const nearEnd =
    slotCount > 0 && focusIndex >= Math.max(0, slotCount - 8)
  const ranges = [
    getLoadedIndexRange(focusIndex, slotCount, limits),
    getLoadedIndexRange(
      Math.min(slotCount - 1, Math.max(0, focusIndex + 1)),
      slotCount,
      limits
    ),
    getLoadedIndexRange(
      Math.min(slotCount - 1, Math.max(0, focusIndex - 1)),
      slotCount,
      limits
    ),
    // Prefetch further right so Gym/Firefighter cards mount before a fast scrub
    // lands on them (avoids blank faces while video first-frames decode).
    getLoadedIndexRange(
      Math.min(slotCount - 1, Math.max(0, focusIndex + 3)),
      slotCount,
      limits
    ),
    getLoadedIndexRange(
      Math.min(slotCount - 1, Math.max(0, focusIndex + 5)),
      slotCount,
      limits
    ),
    // Pull the window further left when browsing near the end.
    ...(nearEnd
      ? [
          getLoadedIndexRange(
            Math.max(0, focusIndex - 6),
            slotCount,
            limits
          ),
          getLoadedIndexRange(
            Math.max(0, focusIndex - 10),
            slotCount,
            limits
          ),
        ]
      : []),
  ]
  const mountMin = Math.min(...ranges.map((r) => r.min))
  const mountMax = Math.max(...ranges.map((r) => r.max))

  const mountedSlots = useMemo(() => {
    // Focus is slot-based already; pad around the active window so partial
    // groups / neighbors stay alive while scrubbing.
    let minSlot = Number.isFinite(mountMin) ? mountMin : 0
    let maxSlot = Number.isFinite(mountMax)
      ? mountMax
      : Math.min(layoutSlots.length - 1, 8)
    if (!Number.isFinite(minSlot) || !Number.isFinite(maxSlot)) {
      minSlot = 0
      maxSlot = Math.min(layoutSlots.length - 1, 8)
    }
    // Extra left pad near the end so end-aligned older groups don't lose a card.
    // Extra right pad so upcoming video cards can decode a first frame early.
    const leftPad = nearEnd ? 10 : 3
    const rightPad = 8
    minSlot = Math.max(0, minSlot - leftPad)
    maxSlot = Math.min(layoutSlots.length - 1, maxSlot + rightPad)

    const items: { slot: LayoutSlot; slotIndex: number }[] = []
    for (let i = minSlot; i <= maxSlot; i++) {
      const slot = layoutSlots[i]
      if (!slot) continue
      items.push({ slot, slotIndex: i })
    }
    return items
  }, [layoutSlots, mountMin, mountMax, nearEnd])

  const groupSpans = useMemo(
    () => buildGroupSpans(cards, groups),
    [cards, groups]
  )

  const themeByGroupId = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groups) map.set(g.id, g.theme)
    return map
  }, [groups])

  // Which group owns the currently active hero (if any).
  const activeGroupId = useMemo(() => {
    if (!activeCardId) return null
    const card = cards.find((c) => c.id === activeCardId)
    const gid = card?.groupId?.trim()
    return gid || null
  }, [activeCardId, cards])

  return (
    <>
      {/* Themed group strokes sit under cards, above the stage. */}
      {groupSpans.map((span) => {
        const isActiveGroup = activeGroupId === span.id
        const isInactiveGroup = hasActiveSelection && !isActiveGroup
        return (
          <div
            key={span.id}
            ref={(node) => {
              if (node) groupRefs.current.set(span.id, node)
              else groupRefs.current.delete(span.id)
            }}
            className={`card-group${
              isActiveGroup ? ' is-active-group' : ''
            }${isInactiveGroup ? ' is-inactive-group' : ''}`}
            data-group-id={span.id}
            aria-label={`${span.theme} group`}
          >
            <span className="card-group__label">
              <img
                className="card-group__avatar"
                src={getGroupAvatarUrl(
                  span.theme,
                  span.id,
                  catalog.byGroupId,
                  span.avatarUrl,
                )}
                alt=""
                width={49}
                height={49}
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget
                  if (img.dataset.fallback === '1') return
                  img.dataset.fallback = '1'
                  img.src = DEFAULT_GROUP_AVATAR_URL
                }}
              />
              <span className="card-group__theme">
                {cards.some(
                  (c) =>
                    c.groupId === span.id && faceReadyByCardId[c.id],
                )
                  ? span.theme
                  : 'LOADING'}
              </span>
            </span>
          </div>
        )
      })}

      {mountedSlots.map(({ slot, slotIndex }) => {
        if (slot.kind === 'placeholder') {
          // All placeholders blur when any card is active.
          const isInactiveGroupItem = hasActiveSelection
          return (
            <PlaceholderItem
              key={slot.key}
              slotKey={slot.key}
              groupTheme={themeByGroupId.get(slot.groupId) ?? 'Group'}
              isInactiveGroupItem={isInactiveGroupItem}
              registerNode={registerNode}
            />
          )
        }

        const card = cards[slot.cardIndex]
        if (!card) return null

        const isActiveItem = activeCardId === card.id
        // Every non-active card gets the dimmed blur, including same-group mates.
        const isInactiveGroupItem = hasActiveSelection && !isActiveItem
        const isDimmed = hasActiveSelection && !isActiveItem
        return (
          <DeckItem
            key={card.id}
            card={card}
            index={slot.cardIndex}
            slotIndex={slotIndex}
            expandable={slotIndex === focusIndex}
            isDimmed={isDimmed}
            isActiveItem={isActiveItem}
            isInactiveGroupItem={isInactiveGroupItem}
            pinHolo={pinHolo}
            holoTransform={holoTransform}
            onFocusChange={onFocusChange}
            onSelectCard={onSelectCard}
            onFlipAngleChange={onFlipAngleChange}
            onCloseActive={() => setActiveCardId(null)}
            registerNode={registerNode}
            onFaceMediaReady={handleFaceMediaReady}
          />
        )
      })}
    </>
  )
}
