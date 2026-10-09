// @ts-nocheck
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { CoverflowStatusPager } from '@/components/home/CoverflowStatusPager'
import { CarouselProvider, useCarousel } from '../context/CarouselContext'
import { useActiveCard } from '../context/ActiveCardContext'
import {
  CARD_GAP,
  CARD_WIDTH,
  CHEVRON_HOLD_INITIAL_MS,
  CHEVRON_HOLD_REPEAT_MS,
  CHEVRON_HOVER_HOLD_MS,
  DESKTOP_LAYOUT,
  DESKTOP_VISIBILITY,
  DRAG_AXIS_LOCK_RATIO,
  MOBILE_DRAG_GAIN,
  MOBILE_FLICK_MAX_STEPS,
  MOBILE_FLICK_SPEED_FULL,
  SWIPE_DISTANCE_PX,
  TAP_MAX_MOVE_PX,
  WHEEL_BURST_DELTA_FULL,
  WHEEL_BURST_WINDOW_MS,
  WHEEL_DELTA_THRESHOLD,
  WHEEL_HORIZONTAL_GAIN,
  WHEEL_HOVER_SETTLE_MS_MAX,
  WHEEL_HOVER_SETTLE_MS_MIN,
  WHEEL_LOCK_MS,
  WHEEL_LOCK_MS_FAST,
  WHEEL_MAX_STEPS,
  clampIndex,
  getVisibleStackWidth,
  makeLayoutMetrics,
  rubberBandDragOffset,
  snapFocusIndex,
  type LayoutMetrics,
  type VisibilityLimits,
} from '../lib/carouselLayout'
import {
  buildLayoutSlots,
  clampSlotIndex,
  getRelativeSlotX,
  type DeckGroup,
  type LayoutSlot,
} from '../lib/cardGroups'
import type { CardConfig } from '../lib/cards'
import { triggerHaptic, unlockHaptics } from '../lib/haptics'

/** One nav-dot per layout slot (real card or empty placeholder). */
type NavDotSlot = {
  key: string
  filled: boolean
  /** Layout-slot index this dot represents (always focusable for scrolling). */
  slotIndex: number
}

function buildNavDotSlots(
  cards: CardConfig[] | undefined,
  groups: DeckGroup[] | undefined,
  count: number
): NavDotSlot[] {
  if (cards && groups?.length) {
    const slots = buildLayoutSlots(cards, groups)
    if (slots.length > 0) {
      return slots.map((slot: LayoutSlot, slotIndex) => ({
        key: slot.key,
        filled: slot.kind === 'card',
        slotIndex,
      }))
    }
  }

  // Fallback: one filled dot per focusable slot.
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    key: `card-dot-${index}`,
    filled: true,
    slotIndex: index,
  }))
}

type ScrollDirection = -1 | 1

type CardCarouselProps = {
  /** Layout-slot count (real cards + empty placeholders). */
  count: number
  /** Focused layout-slot index (empty slots are valid). */
  focusIndex: number
  onFocusChange: (index: number) => void
  /** Visible-card window (desktop 20 / mobile 5). */
  limits?: VisibilityLimits
  /** Needed to measure real pixel span to first/last (group gaps). */
  cards?: CardConfig[]
  groups?: DeckGroup[]
  children: ReactNode
}

function isDesktopHoverDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/**
 * Real pixel distances from the focused layout slot to the first/last slots,
 * including empty placeholders + double inter-group gaps.
 * Used so rubber-band matches the left-anchored layout instead of a uniform step.
 */
function getEdgeSpanPx(
  cards: CardConfig[] | undefined,
  groups: DeckGroup[] | undefined,
  focusIndex: number,
  count: number,
  metrics: LayoutMetrics
): { toFirstPx: number; toLastPx: number } {
  const step = Math.max(1, metrics.cardStep)
  const fallback = {
    toFirstPx: Math.max(0, focusIndex) * step,
    toLastPx: Math.max(0, count - 1 - focusIndex) * step,
  }
  if (!groups || count <= 0) return fallback

  try {
    const slots = buildLayoutSlots(cards ?? [], groups)
    if (slots.length === 0) return fallback
    const origin = clampSlotIndex(focusIndex, slots.length)
    const first = 0
    const last = slots.length - 1

    // Distances are absolute; first is left of focus (negative x), last is right.
    const toFirstPx = Math.abs(
      getRelativeSlotX(slots, origin, first, metrics)
    )
    const toLastPx = Math.abs(getRelativeSlotX(slots, origin, last, metrics))
    return {
      toFirstPx: Number.isFinite(toFirstPx) ? toFirstPx : fallback.toFirstPx,
      toLastPx: Number.isFinite(toLastPx) ? toLastPx : fallback.toLastPx,
    }
  } catch {
    return fallback
  }
}

function CardCarouselInner({
  count,
  focusIndex,
  onFocusChange,
  limits = DESKTOP_VISIBILITY,
  cards,
  groups,
  children,
}: CardCarouselProps) {
  const { activeCardId } = useActiveCard()
  const {
    getDragOffsetPx,
    isDragging,
    setCarouselDragging,
    setDragOffsetPx,
    markCarouselDragged,
    registerStagePage,
  } = useCarousel()
  const expanded = activeCardId !== null
  const stageRef = useRef<HTMLDivElement>(null)
  // After deactivate, suppress :hover on the just-closed card so it doesn't
  // re-light under a sticky pointer. Clear when the pointer leaves the stage
  // or moves onto a different card (so other cards still get hover scale).
  const [hoverSuppressed, setHoverSuppressed] = useState(false)
  const hoverSuppressFocusRef = useRef<number | null>(null)
  const wasExpandedRef = useRef(expanded)
  const layoutMetricsRef = useRef<LayoutMetrics>(DESKTOP_LAYOUT)

  // Latest values for timers / native listeners (avoid stale closures).
  const focusIndexRef = useRef(focusIndex)
  const countRef = useRef(count)
  const expandedRef = useRef(expanded)
  const onFocusChangeRef = useRef(onFocusChange)
  const isDraggingRef = useRef(isDragging)

  // One status-pager mark per layout slot (filled card or empty placeholder).
  const navDotSlots = useMemo(
    () => buildNavDotSlots(cards, groups, count),
    [cards, groups, count]
  )
  const activePagerIndex = useMemo(() => {
    if (navDotSlots.length === 0) return 0
    const idx = navDotSlots.findIndex((slot) => slot.slotIndex === focusIndex)
    if (idx >= 0) return idx
    return Math.max(0, Math.min(navDotSlots.length - 1, focusIndex))
  }, [focusIndex, navDotSlots])

  useEffect(() => {
    focusIndexRef.current = focusIndex
  }, [focusIndex])
  useEffect(() => {
    countRef.current = count
  }, [count])
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])
  useEffect(() => {
    onFocusChangeRef.current = onFocusChange
  }, [onFocusChange])
  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  const handleStatusPagerSelect = useCallback(
    (dotIndex: number) => {
      if (expandedRef.current) return
      const slot = navDotSlots[dotIndex]
      if (!slot) return
      // Empty placeholders are valid scroll targets — same as filled cards.
      onFocusChange(slot.slotIndex)
      try {
        unlockHaptics()
        triggerHaptic()
      } catch {
        // Best-effort — never break carousel interaction.
      }
    },
    [navDotSlots, onFocusChange]
  )

  // Match CSS card width/gap so scrub snap uses the live mobile step.
  // offsetWidth ignores spring/hover scale (getBoundingClientRect does not).
  useEffect(() => {
    const sample = () => {
      const frame = stageRef.current?.querySelector(
        '.coverflow__frame'
      ) as HTMLElement | null
      if (!frame) return
      const item = frame.querySelector(
        '.coverflow__item:not(.coverflow__item--placeholder)'
      ) as HTMLElement | null
      const measuredWidth = item?.offsetWidth ?? 0
      const style = getComputedStyle(frame)
      const gapRaw = style.getPropertyValue('--card-gap').trim()
      const gap = Number.parseFloat(gapRaw)
      const root =
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
        16
      const cardWidth = measuredWidth > 0 ? measuredWidth : CARD_WIDTH
      const cardGap = Number.isFinite(gap)
        ? gapRaw.endsWith('rem')
          ? gap * root
          : gap
        : CARD_GAP
      layoutMetricsRef.current = makeLayoutMetrics(cardWidth, cardGap)
    }
    sample()
    const raf = requestAnimationFrame(sample)
    window.addEventListener('resize', sample)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', sample)
    }
  }, [count, focusIndex, expanded])

  useEffect(() => {
    if (wasExpandedRef.current && !expanded) {
      setHoverSuppressed(true)
      // Remember which focused card just closed — only that one is suppressed.
      hoverSuppressFocusRef.current = focusIndexRef.current
    }
    if (expanded) {
      setHoverSuppressed(false)
      hoverSuppressFocusRef.current = null
    }
    wasExpandedRef.current = expanded
  }, [expanded])

  const clearHoverSuppress = useCallback(() => {
    setHoverSuppressed(false)
    hoverSuppressFocusRef.current = null
  }, [])

  /** Clear suppress once the pointer is no longer stuck on the closed card. */
  const handleHoverSuppressPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!hoverSuppressed) return
      const target = e.target as HTMLElement | null
      const item = target?.closest?.('.coverflow__item') as HTMLElement | null
      if (!item) {
        // Over empty stage / chrome — safe to restore hover.
        clearHoverSuppress()
        return
      }
      // Focus is layout-slot based; prefer data-slot-index over card data-index.
      const slotIdx = Number(item.dataset.slotIndex)
      const cardIdx = Number(item.dataset.index)
      const idx = Number.isFinite(slotIdx) ? slotIdx : cardIdx
      const suppressedAt = hoverSuppressFocusRef.current
      // Different slot (or placeholder without indices) → allow hover again.
      if (
        suppressedAt === null ||
        !Number.isFinite(idx) ||
        idx !== suppressedAt
      ) {
        clearHoverSuppress()
      }
    },
    [clearHoverSuppress, hoverSuppressed]
  )

  // 3dpack: chevrons/wheel/swipe still work while a pack is active
  // (selection rides with focus via App.handleFocusChange).
  const canPrev = focusIndex > 0
  const canNext = focusIndex < count - 1

  /**
   * Discrete finite pager — same model as sugar-scracth3dpack `moveFocus`.
   * One step at a time, hard-clamped to [0, count-1]. Never wraps / infinite.
   * While active, App transfers selection to the new center pack.
   */
  const moveFocus = useCallback(
    (delta: number) => {
      const total = countRef.current
      if (total <= 0) return
      const current = focusIndexRef.current
      // Explicit end stops — no modulo, no looping.
      if (delta < 0 && current <= 0) return
      if (delta > 0 && current >= total - 1) return
      const next = clampIndex(current + delta, total)
      if (next === current) return
      // Update the ref immediately so same-frame consumers see the index.
      focusIndexRef.current = next
      setDragOffsetPx(0)
      onFocusChangeRef.current(next)
    },
    [setDragOffsetPx]
  )

  // --- Chevron hold / hover (ported timings from 3dpack) ---
  const chevronHoldDirectionRef = useRef<0 | ScrollDirection>(0)
  const chevronHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const chevronHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  )
  const chevronHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const chevronHoverDirectionRef = useRef<0 | ScrollDirection>(0)
  const chevronHoverSuppressedDirectionRef = useRef<0 | ScrollDirection>(0)
  const chevronPointerDownRef = useRef(false)

  const clearChevronHoverTimer = useCallback(() => {
    if (chevronHoverTimeoutRef.current !== null) {
      clearTimeout(chevronHoverTimeoutRef.current)
      chevronHoverTimeoutRef.current = null
    }
    chevronHoverDirectionRef.current = 0
  }, [])

  const stopChevronHold = useCallback(() => {
    if (chevronHoldTimeoutRef.current !== null) {
      clearTimeout(chevronHoldTimeoutRef.current)
      chevronHoldTimeoutRef.current = null
    }
    if (chevronHoldIntervalRef.current !== null) {
      clearInterval(chevronHoldIntervalRef.current)
      chevronHoldIntervalRef.current = null
    }
    chevronHoldDirectionRef.current = 0
    chevronPointerDownRef.current = false
  }, [])

  const startChevronHold = useCallback(
    (direction: ScrollDirection, options?: { immediate?: boolean }) => {
      const immediate = options?.immediate ?? true
      clearChevronHoverTimer()
      stopChevronHold()
      chevronHoldDirectionRef.current = direction

      // Immediate step on press, then keep cycling while held/hovered.
      if (immediate) {
        moveFocus(direction)
      }

      chevronHoldTimeoutRef.current = setTimeout(
        () => {
          chevronHoldIntervalRef.current = setInterval(() => {
            if (chevronHoldDirectionRef.current === 0) return

            const atStart =
              chevronHoldDirectionRef.current === -1 &&
              focusIndexRef.current <= 0
            const atEnd =
              chevronHoldDirectionRef.current === 1 &&
              focusIndexRef.current >= countRef.current - 1

            if (atStart || atEnd) {
              stopChevronHold()
              return
            }

            moveFocus(chevronHoldDirectionRef.current)
          }, CHEVRON_HOLD_REPEAT_MS)
        },
        immediate ? CHEVRON_HOLD_INITIAL_MS : 0
      )
    },
    [clearChevronHoverTimer, moveFocus, stopChevronHold]
  )

  const armChevronHoverHold = useCallback(
    (direction: ScrollDirection) => {
      if (!isDesktopHoverDevice()) return
      // Clicking cancels hover-auto-cycle for this chevron until re-entry.
      if (chevronHoverSuppressedDirectionRef.current === direction) return
      // Press-and-hold already owns cycling.
      if (
        chevronPointerDownRef.current ||
        chevronHoldDirectionRef.current !== 0
      ) {
        return
      }

      clearChevronHoverTimer()
      chevronHoverDirectionRef.current = direction
      chevronHoverTimeoutRef.current = setTimeout(() => {
        if (chevronHoverDirectionRef.current !== direction) return
        if (chevronHoverSuppressedDirectionRef.current === direction) return
        // Hovering for 500ms counts as a hold: start continuous cycling.
        startChevronHold(direction, { immediate: true })
      }, CHEVRON_HOVER_HOLD_MS)
    },
    [clearChevronHoverTimer, startChevronHold]
  )

  const handleChevronPointerEnter = (direction: ScrollDirection) => {
    if (chevronHoverSuppressedDirectionRef.current === direction) {
      chevronHoverSuppressedDirectionRef.current = 0
    }
    armChevronHoverHold(direction)
  }

  const handleChevronPointerDown = (
    direction: ScrollDirection,
    e: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()

    // A click cancels hover-auto-cycle for this chevron until re-entry.
    chevronHoverSuppressedDirectionRef.current = direction
    clearChevronHoverTimer()
    chevronPointerDownRef.current = true
    startChevronHold(direction)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const releaseChevronInteraction = useCallback(() => {
    clearChevronHoverTimer()
    stopChevronHold()
  }, [clearChevronHoverTimer, stopChevronHold])

  useEffect(() => {
    if (expanded) releaseChevronInteraction()
  }, [expanded, releaseChevronInteraction])

  useEffect(() => {
    return () => {
      releaseChevronInteraction()
      chevronHoverSuppressedDirectionRef.current = 0
    }
  }, [releaseChevronInteraction])

  // --- Wheel: horizontal-only discrete steps (vertical scrolls the page) ---
  // Side wheel / trackpad swipe / Shift+wheel page the carousel. Intensity
  // still scales step count + cooldown so dense horizontal bursts move faster.
  const wheelLockUntilRef = useRef(0)
  const wheelBurstRef = useRef<{ t: number; absDelta: number }[]>([])
  // While the wheel is spinning, suppress CSS :hover (it goes stale mid-scroll).
  // After a settle delay proportional to intensity, re-hit-test the pointer and
  // apply hover to the card currently under the cursor.
  const [wheelHoverSuppressed, setWheelHoverSuppressed] = useState(false)
  const [wheelHoverId, setWheelHoverId] = useState<string | null>(null)
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null)
  const wheelHoverSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const lastWheelIntensityRef = useRef(0)

  const clearWheelHoverSettleTimer = useCallback(() => {
    if (wheelHoverSettleTimerRef.current !== null) {
      clearTimeout(wheelHoverSettleTimerRef.current)
      wheelHoverSettleTimerRef.current = null
    }
  }, [])

  const clearWheelHoverClasses = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    stage
      .querySelectorAll('.coverflow__item.is-wheel-hover')
      .forEach((el) => el.classList.remove('is-wheel-hover'))
  }, [])

  const applyWheelHoverFromPoint = useCallback(
    (x: number, y: number) => {
      const stage = stageRef.current
      if (!stage) {
        setWheelHoverId(null)
        return
      }
      const stack = document.elementsFromPoint(x, y)
      for (const node of stack) {
        if (!(node instanceof Element)) continue
        // Prefer real cards; skip placeholders.
        const item = node.closest(
          '.coverflow__item:not(.coverflow__item--placeholder)'
        ) as HTMLElement | null
        if (!item || !stage.contains(item)) continue
        const id = item.dataset.cardId || item.dataset.index || null
        clearWheelHoverClasses()
        item.classList.add('is-wheel-hover')
        setWheelHoverId(id)
        return
      }
      clearWheelHoverClasses()
      setWheelHoverId(null)
    },
    [clearWheelHoverClasses]
  )

  const scheduleWheelHoverRestore = useCallback(
    (intensity: number) => {
      clearWheelHoverSettleTimer()
      // Faster scrolls settle a bit later; slow scrolls restore almost immediately.
      const settleMs = Math.round(
        WHEEL_HOVER_SETTLE_MS_MIN +
        intensity * (WHEEL_HOVER_SETTLE_MS_MAX - WHEEL_HOVER_SETTLE_MS_MIN)
      )
      wheelHoverSettleTimerRef.current = setTimeout(() => {
        wheelHoverSettleTimerRef.current = null
        setWheelHoverSuppressed(false)
        const pos = lastPointerPosRef.current
        if (pos) applyWheelHoverFromPoint(pos.x, pos.y)
      }, settleMs)
    },
    [applyWheelHoverFromPoint, clearWheelHoverSettleTimer]
  )

  useEffect(() => {
    return () => clearWheelHoverSettleTimer()
  }, [clearWheelHoverSettleTimer])

  // Keep a live pointer sample so we can re-hit-test after wheel settle without
  // needing the user to jiggle the mouse.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const onPointerMove = (event: PointerEvent) => {
      lastPointerPosRef.current = { x: event.clientX, y: event.clientY }
      // Once settled, keep the synthetic hover in sync with the cursor.
      if (!wheelHoverSuppressed && !expandedRef.current) {
        applyWheelHoverFromPoint(event.clientX, event.clientY)
      }
    }
    const onPointerLeave = () => {
      lastPointerPosRef.current = null
      setWheelHoverId(null)
    }

    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerleave', onPointerLeave)
    return () => {
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [applyWheelHoverFromPoint, wheelHoverSuppressed])

  // After a focus change from wheel, re-evaluate the card under the pointer once
  // the spring has had a frame to move (covers mid-scroll target shifts).
  useEffect(() => {
    if (wheelHoverSuppressed) return
    if (expanded) return
    const pos = lastPointerPosRef.current
    if (!pos) return
    const id = requestAnimationFrame(() => {
      applyWheelHoverFromPoint(pos.x, pos.y)
    })
    return () => cancelAnimationFrame(id)
  }, [applyWheelHoverFromPoint, expanded, focusIndex, wheelHoverSuppressed])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const handleWheel = (event: WheelEvent) => {
      // Keep pointer sample even while expanded (for when we leave active).
      lastPointerPosRef.current = { x: event.clientX, y: event.clientY }

      if (expandedRef.current) return
      if (countRef.current <= 1) return

      // Vertical wheel/trackpad → page scroll. Only horizontal intent pages
      // the carousel (side wheel, trackpad swipe, or Shift+wheel).
      const absX = Math.abs(event.deltaX)
      const absY = Math.abs(event.deltaY)
      const shiftAsHorizontal = event.shiftKey && absY > absX
      const usingHorizontal =
        (absX > absY && absX > 0) || shiftAsHorizontal
      if (!usingHorizontal) return

      event.preventDefault()
      event.stopPropagation()

      const rawDelta = shiftAsHorizontal ? event.deltaY : event.deltaX
      const scaledDelta = rawDelta * WHEEL_HORIZONTAL_GAIN

      const absDelta = Math.abs(scaledDelta)
      // Horizontal wheels often emit smaller ticks — slightly lower threshold.
      const threshold = WHEEL_DELTA_THRESHOLD * 0.7
      if (absDelta < threshold) return

      const now = performance.now()
      if (now < wheelLockUntilRef.current) return

      // Track recent wheel energy in a short window.
      const burst = wheelBurstRef.current.filter(
        (sample) => now - sample.t <= WHEEL_BURST_WINDOW_MS
      )
      burst.push({ t: now, absDelta })
      wheelBurstRef.current = burst

      const burstEnergy = burst.reduce((sum, sample) => sum + sample.absDelta, 0)
      const burstFull = WHEEL_BURST_DELTA_FULL * 0.7
      // 0 = slow single tick, 1 = hard continuous scroll in the burst window.
      const intensity = Math.min(
        1,
        Math.max(
          absDelta / (threshold * 8),
          burstEnergy / burstFull,
          // Many events in a short window also count as intensity.
          (burst.length - 1) / 6
        )
      )
      lastWheelIntensityRef.current = intensity

      // More scroll energy → more steps (1..WHEEL_MAX_STEPS).
      const steps = Math.min(
        WHEEL_MAX_STEPS,
        1 + Math.floor(intensity * (WHEEL_MAX_STEPS - 1) + 0.0001)
      )
      // More scroll energy → shorter cooldown between pulses.
      const lockFloor = Math.max(40, WHEEL_LOCK_MS_FAST - 10)
      const lockMs = Math.round(
        WHEEL_LOCK_MS - intensity * (WHEEL_LOCK_MS - lockFloor)
      )
      wheelLockUntilRef.current = now + lockMs

      // Suppress stale CSS :hover while the deck is moving; restore after settle.
      setWheelHoverSuppressed(true)
      clearWheelHoverClasses()
      setWheelHoverId(null)
      scheduleWheelHoverRestore(intensity)

      // Match 3dpack: positive delta pages forward (next / older to the left-focus).
      moveFocus((scaledDelta > 0 ? 1 : -1) * steps)
    }

    stage.addEventListener('wheel', handleWheel, { passive: false })
    return () => stage.removeEventListener('wheel', handleWheel)
  }, [clearWheelHoverClasses, moveFocus, scheduleWheelHoverRestore])

  /**
   * Stage drag — hybrid of 3dpack feel + continuous 2D scrub:
   * - While held (idle browse): row follows pointer (dragOffsetPx)
   * - On release: snap to nearest card; fast flick can force ±1
   * - While a pack is active: no continuous scrub; horizontal flick pages ±1
   *   and App transfers selection to the new center (3dpack)
   * - Vertical on the focused card is owned by the card (activate/deactivate)
   */
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastT: number
    peakSpeed: number
    axis: 'none' | 'horizontal' | 'vertical'
    dragging: boolean
  } | null>(null)

  const resetStageDrag = useCallback(() => {
    drag.current = null
    setCarouselDragging(false)
    setDragOffsetPx(0)
  }, [setCarouselDragging, setDragOffsetPx])

  const handleStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.target as HTMLElement | null
    if (
      target?.closest(
        '.coverflow__chevron, .coverflow__status-pager, .coverflow-status-pager, .active-card-panel'
      )
    ) {
      return
    }
    // When a card is active, freeze carousel browsing so taps/swipes on
    // neighboring cards can't page / transfer selection.
    if (expandedRef.current) {
      return
    }

    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: performance.now(),
      peakSpeed: 0,
      axis: 'none',
      dragging: false,
    }
  }

  const handleStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== e.pointerId) return

    const now = performance.now()
    const dt = Math.max((now - state.lastT) / 1000, 1 / 120)
    const frameDx = e.clientX - state.lastX
    // use-gesture-style peak speed in px/ms
    const speed = Math.abs(frameDx) / Math.max(now - state.lastT, 1)
    state.peakSpeed = Math.max(state.peakSpeed, speed)
    state.lastX = e.clientX
    state.lastT = now

    const mx = e.clientX - state.startX
    const my = e.clientY - state.startY
    const absX = Math.abs(mx)
    const absY = Math.abs(my)

    if (state.axis === 'none' && (absX > 8 || absY > 8)) {
      if (absX >= absY * DRAG_AXIS_LOCK_RATIO) {
        state.axis = 'horizontal'
        state.dragging = true
        setCarouselDragging(true)
        markCarouselDragged()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      } else if (absY > absX * DRAG_AXIS_LOCK_RATIO) {
        // Vertical: card handles activate/deactivate. Abort stage drag.
        state.axis = 'vertical'
        drag.current = null
        setDragOffsetPx(0)
        setCarouselDragging(false)
        return
      }
    }

    // Continuous scrub only while browsing (not while a pack is hero-selected).
    if (
      state.axis === 'horizontal' &&
      state.dragging &&
      !expandedRef.current
    ) {
      e.preventDefault()
      const metrics = layoutMetricsRef.current
      // Real pixel spans (group gaps included). Left-anchored focus means the
      // free drag range is exactly the distance from focus to first/last card.
      const edgeSpan = getEdgeSpanPx(
        cards,
        groups,
        focusIndexRef.current,
        countRef.current,
        metrics
      )
      // Touch / coarse-pointer: amplify finger drag so the row moves faster
      // than 1:1. Desktop fine-pointer stays 1:1.
      const isTouchish =
        e.pointerType === 'touch' || e.pointerType === 'pen' || !isDesktopHoverDevice()
      const dragGain = isTouchish ? MOBILE_DRAG_GAIN : 1
      // Browse mode: hard clamp — no overshoot past first/last.
      // (Active/open card freezes stage drag already; photo-grid room is CSS.)
      const rubber = rubberBandDragOffset(
        mx * dragGain,
        focusIndexRef.current,
        countRef.current,
        metrics.cardStep,
        edgeSpan,
        'browse'
      )
      setDragOffsetPx(rubber)
      }
  }

  const endStagePointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== e.pointerId) return

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    const mx = e.clientX - state.startX
    const absX = Math.abs(mx)
    const totalMove = Math.hypot(mx, e.clientY - state.startY)
    const wasHorizontalDrag =
      state.dragging && state.axis === 'horizontal' && totalMove > TAP_MAX_MOVE_PX

    if (wasHorizontalDrag) {
      markCarouselDragged()

      const isTouchish =
        e.pointerType === 'touch' ||
        e.pointerType === 'pen' ||
        !isDesktopHoverDevice()
      const dragGain = isTouchish ? MOBILE_DRAG_GAIN : 1
      const effectiveMx = mx * dragGain

      // Peak-speed flick (3dpack SWIPE_VELOCITY ≈ 1.15 px/ms) → force ±1.
      // Mobile needs a slightly higher bar so casual swipes stay 1-card.
      const flickSpeedMin = isTouchish ? 1.35 : 1.15
      const isFlick =
        absX >= SWIPE_DISTANCE_PX * 0.6 && state.peakSpeed >= flickSpeedMin

      if (expandedRef.current) {
        // Active: discrete page only (selection transfers in App).
        if (isFlick || absX >= SWIPE_DISTANCE_PX) {
          const flickSteps = isTouchish
            ? Math.max(
                1,
                Math.min(
                  MOBILE_FLICK_MAX_STEPS,
                  Math.round(
                    1 +
                      ((state.peakSpeed - flickSpeedMin) /
                        Math.max(0.01, MOBILE_FLICK_SPEED_FULL - flickSpeedMin)) *
                        (MOBILE_FLICK_MAX_STEPS - 1)
                  )
                )
              )
            : 1
          const before = focusIndexRef.current
          moveFocus((mx < 0 ? 1 : -1) * flickSteps)
          if (isTouchish && focusIndexRef.current !== before) {
            registerStagePage()
          }
        }
      } else {
        // Browse: continuous scrub → nearest, with flick override.
        const metrics = layoutMetricsRef.current
        const edgeSpan = getEdgeSpanPx(
          cards,
          groups,
          focusIndexRef.current,
          countRef.current,
          metrics
        )
        const current = focusIndexRef.current
        let next = snapFocusIndex(
          current,
          effectiveMx,
          countRef.current,
          metrics.cardStep,
          edgeSpan,
          'browse'
        )
        // Mobile stage swipes are always one card: short drags + gain can make
        // nearest-snap land 2+ away. Multi-card jogging is the nav-dot path.
        if (isTouchish && next !== current) {
          next = clampIndex(current + (next > current ? 1 : -1), countRef.current)
        } else if (isFlick && next === current) {
          // Fast flick that didn't cross a snap boundary still pages ±1.
          next = clampIndex(
            current + (mx < 0 ? 1 : -1),
            countRef.current
          )
        }
        if (next !== current) {
          focusIndexRef.current = next
          onFocusChangeRef.current(next)
          // Rapid successive stage pages raise settle intensity (still ±1 card).
          if (isTouchish) registerStagePage()
        }
      }
    }

    resetStageDrag()
  }

  const stackWidth = getVisibleStackWidth(focusIndex, count, limits)

  return (
    <div
      className={`coverflow${expanded ? ' is-expanded' : ''}${isDragging ? ' is-dragging' : ''
        }${hoverSuppressed || wheelHoverSuppressed ? ' is-hover-suppressed' : ''
        }${wheelHoverId ? ' has-wheel-hover' : ''}`}
      ref={stageRef}
      data-wheel-hover-id={wheelHoverId ?? undefined}
      onPointerMove={handleHoverSuppressPointerMove}
      onPointerLeave={() => {
        clearHoverSuppress()
        clearWheelHoverClasses()
        setWheelHoverId(null)
      }}
    >
      <div
        className="coverflow__frame"
        style={
          {
            ['--stack-width' as string]: `${stackWidth}px`,
          } as CSSProperties
        }
      >
        <button
          type="button"
          className="coverflow__chevron coverflow__chevron--left glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
          onClick={(e) => e.preventDefault()}
          onPointerDown={(e) => handleChevronPointerDown(-1, e)}
          onPointerUp={releaseChevronInteraction}
          onPointerCancel={releaseChevronInteraction}
          onPointerLeave={() => {
            // Stop hold if pointer leaves the button while pressed.
            if (chevronPointerDownRef.current) {
              releaseChevronInteraction()
            }
          }}
          onMouseEnter={() => handleChevronPointerEnter(-1)}
          onMouseLeave={() => {
            clearChevronHoverTimer()
            // If hover-started hold is running without a press, stop it.
            if (!chevronPointerDownRef.current) {
              stopChevronHold()
            }
          }}
          disabled={!canPrev}
          aria-label="Previous card"
        >
          <svg
            className="coverflow__chevron-icon"
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M14.5 5.5 8 12l6.5 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div
          className="coverflow__viewport"
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={endStagePointer}
          onPointerCancel={endStagePointer}
        >
          <div className="coverflow__hit-area" aria-hidden="true" />
          <div className="coverflow__track">{children}</div>
        </div>

        <button
          type="button"
          className="coverflow__chevron coverflow__chevron--right glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
          onClick={(e) => e.preventDefault()}
          onPointerDown={(e) => handleChevronPointerDown(1, e)}
          onPointerUp={releaseChevronInteraction}
          onPointerCancel={releaseChevronInteraction}
          onPointerLeave={() => {
            if (chevronPointerDownRef.current) {
              releaseChevronInteraction()
            }
          }}
          onMouseEnter={() => handleChevronPointerEnter(1)}
          onMouseLeave={() => {
            clearChevronHoverTimer()
            if (!chevronPointerDownRef.current) {
              stopChevronHold()
            }
          }}
          disabled={!canNext}
          aria-label="Next card"
        >
          <svg
            className="coverflow__chevron-icon"
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M9.5 5.5 16 12l-6.5 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {navDotSlots.length > 1 && (
          <div className="coverflow__status-pager">
            <CoverflowStatusPager
              className="coverflow__status-pager-control"
              count={navDotSlots.length}
              activeIndex={activePagerIndex}
              onSelectIndex={handleStatusPagerSelect}
              ariaLabel="Cards"
              itemLabel={(index, total) => {
                const slot = navDotSlots[index]
                if (!slot) return `Card ${index + 1} of ${total}`
                return slot.filled
                  ? `Go to card slot ${slot.slotIndex + 1}`
                  : `Go to empty slot ${slot.slotIndex + 1}`
              }}
            />
          </div>
        )}

        {/* Photo cards grid is anchored to the active card item in SlideDeck. */}
      </div>
    </div>
  )
}

export default function CardCarousel(props: CardCarouselProps) {
  return (
    <CarouselProvider>
      <CardCarouselInner {...props} />
    </CarouselProvider>
  )
}
