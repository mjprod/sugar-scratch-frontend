// @ts-nocheck
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
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
    subscribeDragOffset,
    isDragging,
    setCarouselDragging,
    setCarouselScrubbing,
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
  const dotsRef = useRef<HTMLDivElement>(null)
  const dotsTrackRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  // Resting geometry for every nav-dot (relative to the dots track).
  const dotMetricsRef = useRef<
    Array<{ left: number; top: number; width: number; height: number }>
  >([])
  const activeDotSizeRef = useRef({ width: 0, height: 0 })
  // Coalesce scrub paints to one rAF so pointermove never forces style thrash.
  const pillRafRef = useRef(0)
  const pillAnimateRef = useRef(false)
  // Keep the active pill inside the ~8-dot viewport after focus changes.
  const dotsScrollRafRef = useRef(0)
  const lastPillPaintRef = useRef({
    left: Number.NaN,
    top: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
  })
  // Live virtual-focus samples for progressive pill anticipation.
  const lastVirtualFocusRef = useRef(0)
  // Smoothed signed scrub direction: +1 = toward next (pill ends right), -1 = previous.
  const pillTravelDirRef = useRef(0)
  // Nearest-dot index we last buzzed for — fire only when the pill passes a new one.
  const lastPillHapticIndexRef = useRef<number | null>(null)
  // Dots hold-scrub: live flag + coalesced React focus commits (declared early
  // so the focusIndex sync effect can read them safely).
  const isDotScrubbingRef = useRef(false)
  const pendingFocusCommitRef = useRef<number | null>(null)
  const pendingFocusCommitRafRef = useRef(0)

  // One dot per layout slot (filled card or empty placeholder).
  const navDotSlots = useMemo(
    () => buildNavDotSlots(cards, groups, count),
    [cards, groups, count]
  )
  const navDotSlotsRef = useRef(navDotSlots)

  useEffect(() => {
    // While dots scrub drives focusIndexRef imperatively (and may have a
    // pending rAF React commit), don't clobber the live index with a lagged prop.
    if (isDotScrubbingRef.current || pendingFocusCommitRef.current != null) {
      return
    }
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
    navDotSlotsRef.current = navDotSlots
  }, [navDotSlots])
  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  /**
   * Stretchy page-control pill between two resting dots.
   * t=0 → fully on `from`, t=1 → fully on `to`. Midway it grows toward the
   * neighbor so the indicator feels tied to the carousel scrub.
   * Writes DOM styles only — never React state.
   *
   * Progressive anticipation (live scrub only):
   * swipe left (carousel → next / pill ultimately right) → pill first dips a
   * little left, then continues its trajectory right as the scroll progresses.
   * The reverse swipe anticipates right, then travels left.
   */
  const paintDotPill = useCallback(
    (fromIndex: number, toIndex: number, t: number, animate: boolean) => {
      const pill = pillRef.current
      const metrics = dotMetricsRef.current
      if (!pill || metrics.length === 0) return

      const clampIdx = (i: number) =>
        Math.max(0, Math.min(metrics.length - 1, i))
      const from = metrics[clampIdx(fromIndex)]
      const to = metrics[clampIdx(toIndex)]
      if (!from || !to) return

      // Rest marks are circles; active indicator is a short stadium pill over them.
      const restW = from.width
      const restH = from.height
      const aw = activeDotSizeRef.current.width || restW * 2.15
      const ah = activeDotSizeRef.current.height || restH
      // Center the pill on each rest-dot.
      const fromLeft = from.left + (restW - aw) / 2
      const toLeft = to.left + (to.width - aw) / 2
      const fromRight = fromLeft + aw
      const toRight = toLeft + aw
      const p = Math.max(0, Math.min(1, t))

      // Leading edge tracks scrub first; trailing edge lags so the pill grows
      // toward the neighbor, then snaps/settles onto the next card.
      const lead = p
      const trail = p * p
      let left: number
      let right: number
      if (toLeft >= fromLeft) {
        // Moving toward a higher index (next card).
        left = fromLeft + (toLeft - fromLeft) * trail
        right = fromRight + (toRight - fromRight) * lead
      } else {
        // Moving toward a lower index (previous card).
        left = fromLeft + (toLeft - fromLeft) * lead
        right = fromRight + (toRight - fromRight) * trail
      }
      // Mid-scrub bulge: more of the gap fills as you drag halfway.
      const span = Math.abs(toLeft - fromLeft)
      const bulge = span * 0.28 * Math.sin(Math.PI * p)
      if (toLeft >= fromLeft) {
        right += bulge
      } else {
        left -= bulge
      }

      // Live progressive anticipation: opposite dip early, then resume travel.
      // dir +1 = virtual focus increasing (next / pill ends right after swipe-left).
      if (!animate) {
        const dir = pillTravelDirRef.current
        if (dir !== 0 && span > 0) {
          // How far we are into this step in the travel direction (0 at rest start).
          const into = dir > 0 ? p : 1 - p
          // Slower windup: peaks ~mid-step, then eases off over most of the travel
          // so the reverse dip feels smooth rather than snappy.
          const peakAt = 0.38
          const fadeBy = 0.95
          // Ease into the peak (smoothstep) instead of a hard sin kick.
          const u = Math.max(0, Math.min(1, into / peakAt))
          const rise = u * u * (3 - 2 * u)
          // Soft cosine fade after the peak so the resume feels gradual.
          const fadeT = Math.max(
            0,
            Math.min(1, (into - peakAt) / Math.max(0.001, fadeBy - peakAt))
          )
          const fall = 0.5 + 0.5 * Math.cos(Math.PI * fadeT)
          const wind = into <= peakAt ? rise : fall
          // Opposite the eventual travel; slightly softer amplitude.
          const anticipPx = -dir * (3.8 + span * 0.12) * wind
          left += anticipPx
          right += anticipPx
        }
      }

      const width = Math.max(ah, right - left)
      const top = from.top + (restH - ah) / 2
      const last = lastPillPaintRef.current
      // Skip no-op style writes while the finger is still.
      if (
        !animate &&
        Math.abs(last.left - left) < 0.15 &&
        Math.abs(last.top - top) < 0.15 &&
        Math.abs(last.width - width) < 0.15 &&
        Math.abs(last.height - ah) < 0.15
      ) {
        return
      }
      last.left = left
      last.top = top
      last.width = width
      last.height = ah

      // Floaty settle: short delay + soft overshoot bounce after release.
      // Keep geometry transition off while scrubbing so the pill tracks the finger.
      // Rim light lives on ::after (CSS-owned), so no box-shadow transition here.
      if (pillAnimateRef.current !== animate) {
        pillAnimateRef.current = animate
        pill.style.transition = animate
          ? [
              'transform 0.58s cubic-bezier(0.34, 1.45, 0.52, 1) 0.05s',
              'width 0.58s cubic-bezier(0.34, 1.45, 0.52, 1) 0.05s',
              'height 0.5s cubic-bezier(0.34, 1.35, 0.52, 1) 0.05s',
              'opacity 0.2s ease',
            ].join(', ')
          : 'none'
      }

      pill.style.transform = `translate3d(${left}px, ${top}px, 0)`
      pill.style.width = `${width}px`
      pill.style.height = `${ah}px`
      pill.classList.add('is-ready')
    },
    []
  )

  /**
   * Tap-only haptic for nav dots.
   * Continuous scrub / swipe gestures do not buzz (iOS web only trusts clicks).
   */
  const hapticForDotTap = useCallback((index: number) => {
    if (!Number.isFinite(index)) return
    const next = Math.max(0, Math.round(index))
    lastPillHapticIndexRef.current = next
    try {
      unlockHaptics()
      triggerHaptic()
    } catch {
      // Best-effort — never break carousel interaction.
    }
  }, [])

  /**
   * Rest-dot opacity by distance from the active pill:
   *   0 → 1.0 (under pill)
   *   1 → 0.8
   *   2 → 0.6
   *   3 → 0.4
   *   4 → 0.2
   *   5+ → 0.15 floor
   */
  const opacityForDotDistance = useCallback((distance: number) => {
    const d = Math.max(0, Math.abs(distance))
    if (d <= 0) return 1
    return Math.max(0.15, 1 - d * 0.2)
  }, [])

  /**
   * Filled slots: white at 0.5 opacity.
   * Empty slots: full opacity so the inset gray chip reads correctly.
   */
  const baseOpacityForDot = useCallback((dotIndex: number) => {
    const slot = navDotSlotsRef.current[dotIndex]
    return slot && !slot.filled ? 1 : 0.5
  }, [])

  /** Focus is already a layout-slot index, so dots map 1:1. */
  const slotIndexToDotIndex = useCallback((slotIndex: number) => {
    const total = navDotSlotsRef.current.length
    if (total <= 0) return 0
    return Math.max(0, Math.min(total - 1, Math.round(slotIndex)))
  }, [])

  /** Live virtual focus from current scrub offset (same math as the pill). */
  const getVirtualFocusIndex = useCallback(() => {
    const total = countRef.current
    if (total <= 1) return 0
    const step = Math.max(1, layoutMetricsRef.current.cardStep)
    const virtual = focusIndexRef.current - getDragOffsetPx() / step
    return Math.max(0, Math.min(total - 1, virtual))
  }, [getDragOffsetPx])

  /**
   * Rest-dot opacities:
   * - filled slots: base 1.0
   * - empty slots: base 0.5
   * - while scrubbing: base × distance falloff from the active pill
   */
  const paintDotOpacities = useCallback(
    (pillDotIndex: number, scrubbing: boolean) => {
      const track = dotsTrackRef.current ?? dotsRef.current
      if (!track) return
      const buttons = track.querySelectorAll<HTMLElement>('.coverflow__dot')
      if (!scrubbing) {
        buttons.forEach((btn, index) => {
          btn.style.opacity = String(baseOpacityForDot(index))
        })
        return
      }
      const origin = Math.max(0, Math.round(pillDotIndex))
      buttons.forEach((btn, index) => {
        const base = baseOpacityForDot(index)
        btn.style.opacity = String(
          base * opacityForDotDistance(index - origin)
        )
      })
    },
    [baseOpacityForDot, opacityForDotDistance]
  )

  /**
   * Keep the active pill inside the ~8-dot viewport.
   * Uses the scroller only (strip swipe still free; pill scrub stays independent).
   */
  const ensureActiveDotVisible = useCallback(
    (dotIndex: number, behavior: ScrollBehavior = 'smooth') => {
      const scroller = dotsRef.current
      const metrics = dotMetricsRef.current
      if (!scroller || metrics.length === 0) return
      const sample = metrics[Math.max(0, Math.min(metrics.length - 1, Math.round(dotIndex)))]
      if (!sample) return

      const viewW = scroller.clientWidth
      const maxScroll = Math.max(0, scroller.scrollWidth - viewW)
      if (maxScroll <= 0) return

      const pad = Math.max(8, sample.width * 0.75)
      const left = sample.left
      const right = sample.left + sample.width
      const viewLeft = scroller.scrollLeft
      const viewRight = viewLeft + viewW

      let next = viewLeft
      if (left < viewLeft + pad) {
        next = left - pad
      } else if (right > viewRight - pad) {
        next = right - viewW + pad
      } else {
        return
      }

      scroller.scrollTo({
        left: Math.max(0, Math.min(maxScroll, next)),
        behavior,
      })
    },
    []
  )

  /** Map live scrub → pill geometry (same virtual-focus math as SlideDeck). */
  const updateDotPillFromScrub = useCallback(
    (animate: boolean) => {
      const metrics = dotMetricsRef.current
      const totalCards = countRef.current
      const totalDots = metrics.length
      if (totalDots === 0 || totalCards <= 1) return

      // Virtual layout-slot focus (fractional). Dots map 1:1 with slots,
      // including empty placeholders, so scrubbing lands on every mark.
      const virtualSlot = getVirtualFocusIndex()
      const fromSlot = Math.floor(virtualSlot + 1e-6)
      const toSlot = Math.min(totalCards - 1, fromSlot + 1)
      const slotT =
        fromSlot === toSlot
          ? 0
          : Math.max(0, Math.min(1, virtualSlot - fromSlot))

      const fromDot = slotIndexToDotIndex(fromSlot)
      const toDot = slotIndexToDotIndex(toSlot)
      // Fractional pill position across the layout-slot strip.
      const virtualDot = fromDot + (toDot - fromDot) * slotT
      const clampedDot = Math.max(0, Math.min(totalDots - 1, virtualDot))

      // Signed travel direction from virtual-dot delta (heavier EMA = smoother).
      // +1 → next / pill ends right (finger swipe left on stage)
      // -1 → previous / pill ends left (finger swipe right on stage)
      const prevV = lastVirtualFocusRef.current
      const dV = clampedDot - prevV
      if (!animate && Math.abs(dV) > 0.0005) {
        const sampleDir = dV > 0 ? 1 : -1
        pillTravelDirRef.current =
          pillTravelDirRef.current === 0
            ? sampleDir * 0.55
            : pillTravelDirRef.current * 0.82 + sampleDir * 0.18
        // Soft-clamp once we have a clear lean (no hard ±1 snap).
        if (Math.abs(pillTravelDirRef.current) > 1) {
          pillTravelDirRef.current = pillTravelDirRef.current > 0 ? 1 : -1
        }
      }
      if (animate) {
        // Resting settle — ease direction out so the last frames aren't abrupt.
        pillTravelDirRef.current *= 0.35
        if (Math.abs(pillTravelDirRef.current) < 0.08) {
          pillTravelDirRef.current = 0
        }
      }
      lastVirtualFocusRef.current = clampedDot

      const fromIndex = Math.floor(clampedDot + 1e-6)
      const toIndex = Math.min(totalDots - 1, fromIndex + 1)
      const t =
        fromIndex === toIndex
          ? 0
          : Math.max(0, Math.min(1, clampedDot - fromIndex))
      paintDotPill(fromIndex, toIndex, t, animate)
      // Falloff only while scrubbing; otherwise restore filled/empty base opacity.
      paintDotOpacities(clampedDot, isDotScrubbingRef.current)
    },
    [
      getVirtualFocusIndex,
      paintDotOpacities,
      paintDotPill,
      slotIndexToDotIndex,
    ]
  )

  // Measure every nav-dot after layout / resize / slot / active-margin change.
  // Metrics are relative to the track so the pill stays glued while the strip scrolls.
  // focusIndex is included because .active opens side margin around the pill.
  useLayoutEffect(() => {
    const measure = () => {
      const track = dotsTrackRef.current
      if (!track || navDotSlots.length <= 1) {
        dotMetricsRef.current = []
        return
      }
      const trackBox = track.getBoundingClientRect()
      const buttons = [
        ...track.querySelectorAll<HTMLElement>('.coverflow__dot'),
      ]
      if (buttons.length === 0) return

      dotMetricsRef.current = buttons.map((btn) => {
        const box = btn.getBoundingClientRect()
        return {
          left: box.left - trackBox.left + track.scrollLeft,
          top: box.top - trackBox.top + track.scrollTop,
          width: box.width,
          height: box.height,
        }
      })

      // Resting dots are equal circles; active pill is wider + 3px taller.
      const sample = buttons[0]
      if (sample) {
        const scrollerStyle = dotsRef.current
          ? getComputedStyle(dotsRef.current)
          : null
        const cssPillW = Number.parseFloat(
          scrollerStyle?.getPropertyValue('--dot-pill-w') || ''
        )
        const cssPillH = Number.parseFloat(
          scrollerStyle?.getPropertyValue('--dot-pill-h') || ''
        )
        activeDotSizeRef.current = {
          width:
            Number.isFinite(cssPillW) && cssPillW > 0
              ? cssPillW
              : sample.offsetWidth * 2.15,
          height:
            Number.isFinite(cssPillH) && cssPillH > 0
              ? cssPillH
              : sample.offsetHeight + 3,
        }
      }

      updateDotPillFromScrub(false)
      // Keep the focused mark in the strip viewport after remeasure.
      ensureActiveDotVisible(slotIndexToDotIndex(focusIndexRef.current), 'auto')
    }

    measure()
    // Margin eases open on the active dot — remeasure mid-transition so the
    // pill stays centered while neighbors push out.
    const t1 = window.setTimeout(measure, 40)
    const t2 = window.setTimeout(measure, 120)
    const t3 = window.setTimeout(measure, 360)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      window.removeEventListener('resize', measure)
    }
  }, [
    ensureActiveDotVisible,
    focusIndex,
    slotIndexToDotIndex,
    navDotSlots,
    updateDotPillFromScrub,
  ])

  // After focus settles (tap / carousel swipe / scrub end), scroll the strip
  // so the active pill is visible inside the ~8-dot viewport.
  useEffect(() => {
    if (isDotScrubbingRef.current) return
    if (dotsScrollRafRef.current) cancelAnimationFrame(dotsScrollRafRef.current)
    dotsScrollRafRef.current = requestAnimationFrame(() => {
      dotsScrollRafRef.current = 0
      ensureActiveDotVisible(slotIndexToDotIndex(focusIndex), 'smooth')
    })
    return () => {
      if (dotsScrollRafRef.current) {
        cancelAnimationFrame(dotsScrollRafRef.current)
        dotsScrollRafRef.current = 0
      }
    }
  }, [ensureActiveDotVisible, focusIndex, navDotSlots.length, slotIndexToDotIndex])

  // Imperative scrub listener: paint pill without React re-renders.
  useEffect(() => {
    const schedule = (animate: boolean) => {
      if (pillRafRef.current) cancelAnimationFrame(pillRafRef.current)
      pillRafRef.current = requestAnimationFrame(() => {
        pillRafRef.current = 0
        updateDotPillFromScrub(animate)
      })
    }

    // Live finger tracking (no CSS transition).
    const unsub = subscribeDragOffset(() => schedule(false))
    return () => {
      unsub()
      if (pillRafRef.current) cancelAnimationFrame(pillRafRef.current)
    }
  }, [subscribeDragOffset, updateDotPillFromScrub])

  // Focus settle / drag end → floaty bounce into the resting slot.
  // Skip bounce while the user is jogging via the dots strip.
  useEffect(() => {
    if (isDotScrubbingRef.current) {
      updateDotPillFromScrub(false)
      return
    }
    updateDotPillFromScrub(!isDragging)
  }, [focusIndex, isDragging, updateDotPillFromScrub])

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
   * Mobile-only: swipe+hold on the nav dots to jog long decks.
   * Direction + base speed come from finger velocity (not strip position):
   *   left→right swipe+hold → next (forward)
   *   right→left swipe+hold → previous (backward)
   * Fast swipe = higher base rate; slow scrub = lower base rate.
   * While holding still after a swipe, rate accelerates with hold duration.
   * Dead zone is velocity-based (near-zero motion), not the strip center.
   * Taps still jump to a specific dot — scrub only engages after intentional drag.
   */
  const dotScrubRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastT: number
    /** Recent signed finger velocity in px/ms (right = +, left = -). */
    velocity: number
    /**
     * Signed hold velocity (px/ms) locked from the last meaningful swipe.
     * Keeps paging while the finger is still after a scrub/flick.
     */
    holdVelocity: number
    /** Signed cards/sec currently driving the continuous pager. */
    rate: number
    /** Seconds the finger has been still since the last meaningful move. */
    holdIdleSec: number
    /** True only after we cross the scrub-activation threshold. */
    active: boolean
    moved: boolean
    /** Fractional card progress for continuous rAF paging. */
    accum: number
  } | null>(null)
  // Survives pointerup → click so a real scrub doesn't also jump to the start dot.
  const suppressDotClickRef = useRef(false)
  const dotScrubRafRef = useRef(0)
  const dotScrubLastTRef = useRef(0)
  const [isDotScrubbing, setIsDotScrubbing] = useState(false)

  // Coalesce React focus commits while dots hold-scrub is live. Imperative
  // consumers (pill, advanceDotScrub) read focusIndexRef every step; the React
  // tree only needs the latest index once per frame (and always on scrub end).
  const flushFocusCommit = useCallback(() => {
    if (pendingFocusCommitRafRef.current) {
      cancelAnimationFrame(pendingFocusCommitRafRef.current)
      pendingFocusCommitRafRef.current = 0
    }
    const next = pendingFocusCommitRef.current
    pendingFocusCommitRef.current = null
    if (next == null) return
    onFocusChangeRef.current(next)
  }, [])

  const scheduleFocusCommit = useCallback((index: number) => {
    pendingFocusCommitRef.current = index
    if (pendingFocusCommitRafRef.current) return
    pendingFocusCommitRafRef.current = requestAnimationFrame(() => {
      pendingFocusCommitRafRef.current = 0
      const next = pendingFocusCommitRef.current
      pendingFocusCommitRef.current = null
      if (next == null) return
      onFocusChangeRef.current(next)
    })
  }, [])

  /**
   * Discrete finite pager — same model as sugar-scracth3dpack `moveFocus`.
   * One step at a time, hard-clamped to [0, count-1]. Never wraps / infinite.
   * While active, App transfers selection to the new center pack.
   * Haptics stay tap-only (dot click) — continuous scrub/flicks do not buzz.
   * During dots hold-scrub, React focus is rAF-coalesced to avoid remount storms.
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
      // Update the ref immediately so same-frame scrub consumers see the index.
      focusIndexRef.current = next
      setDragOffsetPx(0)
      // Dots scrub can page many cards/sec — don't force a React commit per step.
      if (isDotScrubbingRef.current) {
        scheduleFocusCommit(next)
        return
      }
      onFocusChangeRef.current(next)
    },
    [scheduleFocusCommit, setDragOffsetPx]
  )

  /** Below this |px/ms| we treat motion as idle (velocity dead zone). */
  const DOT_SCRUB_VEL_DEAD = 0.045
  /** Horizontal travel before a touch becomes a scrub (keeps taps free). */
  const DOT_SCRUB_ACTIVATE_PX = 12
  /** Hold-acceleration: full ramp after this many still seconds. */
  const DOT_SCRUB_HOLD_RAMP_SEC = 0.2
  /** Max multiplier applied to base rate after a long hold. */
  const DOT_SCRUB_HOLD_MAX_MULT = 3.4

  const stopDotScrubLoop = useCallback(() => {
    if (dotScrubRafRef.current) {
      cancelAnimationFrame(dotScrubRafRef.current)
      dotScrubRafRef.current = 0
    }
  }, [])

  /**
   * Map signed finger velocity (px/ms) → signed cards/sec.
   * Finger right (positive) → next cards; finger left (negative) → previous.
   * Slow scrub ~2–6 cards/sec, fast swipe ~45+ cards/sec (before hold ramp).
   */
  const velocityToCardsPerSec = useCallback((velocityPxPerMs: number) => {
    const abs = Math.abs(velocityPxPerMs)
    if (abs < DOT_SCRUB_VEL_DEAD) return 0
    // 0.05 px/ms ≈ gentle drift, 1.8+ px/ms ≈ hard flick.
    const t = Math.max(0, Math.min(1, (abs - DOT_SCRUB_VEL_DEAD) / 1.75))
    // Ease-in so slow scrubs stay precise and flicks jump hard.
    const eased = t * t
    // 2× previous top speed so long-deck jogging can really fly.
    const mag = 2.2 + eased * 44
    // Finger right = +velocity → next; finger left = previous.
    return (velocityPxPerMs < 0 ? -1 : 1) * mag
  }, [])

  /** Advance the dots scrub by elapsed time (no haptics — tap-only path). */
  const advanceDotScrub = useCallback(() => {
    const state = dotScrubRef.current
    if (!state?.active) return 0

    const now = performance.now()
    const lastT = dotScrubLastTRef.current || now
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000))
    dotScrubLastTRef.current = now
    if (dt <= 0) return 0

    // Prefer live velocity while moving; fall back to hold velocity when still.
    const liveAbs = Math.abs(state.velocity)
    const holdAbs = Math.abs(state.holdVelocity)
    const isHoldingStill = liveAbs <= DOT_SCRUB_VEL_DEAD
    const driving = isHoldingStill
      ? state.holdVelocity
      : Math.abs(state.velocity) >= holdAbs * 0.35
        ? state.velocity
        : state.holdVelocity * 0.35 + state.velocity * 0.65

    // Longer still-hold after a swipe → faster continuous scroll.
    if (isHoldingStill && Math.abs(driving) > DOT_SCRUB_VEL_DEAD) {
      state.holdIdleSec = Math.min(
        DOT_SCRUB_HOLD_RAMP_SEC,
        state.holdIdleSec + dt
      )
    } else if (!isHoldingStill) {
      state.holdIdleSec = 0
    }

    const holdT = Math.max(
      0,
      Math.min(1, state.holdIdleSec / DOT_SCRUB_HOLD_RAMP_SEC)
    )
    const holdMult = 1 + (DOT_SCRUB_HOLD_MAX_MULT - 1) * (holdT * holdT)
    const baseRate = velocityToCardsPerSec(driving)
    state.rate = baseRate * (baseRate !== 0 ? holdMult : 1)

    let steps = 0
    if (state.rate !== 0) {
      state.accum += state.rate * dt
      if (Math.abs(state.accum) > 0.12) state.moved = true

      const maxSteps = holdMult > 2 ? 24 : 16
      while (Math.abs(state.accum) >= 1 && steps < maxSteps) {
        const stepDir = state.accum > 0 ? 1 : -1
        const before = focusIndexRef.current
        moveFocus(stepDir)
        if (focusIndexRef.current === before) {
          state.accum = 0
          break
        }
        state.accum -= stepDir
        steps += 1
      }

      if (steps > 0) updateDotPillFromScrub(false)
    }

    // Decay instantaneous velocity so "still" is detected quickly after a flick.
    state.velocity *= Math.pow(0.5, dt * 18)
    return steps
  }, [moveFocus, updateDotPillFromScrub, velocityToCardsPerSec])

  const tickDotScrub = useCallback(() => {
    const state = dotScrubRef.current
    if (!state) {
      stopDotScrubLoop()
      return
    }
    if (!state.active) {
      stopDotScrubLoop()
      return
    }

    advanceDotScrub()
    // Keep haptic tracker in sync with focus so a later tap starts clean.
    lastPillHapticIndexRef.current = focusIndexRef.current

    dotScrubRafRef.current = requestAnimationFrame(tickDotScrub)
  }, [advanceDotScrub, stopDotScrubLoop])

  const startDotScrubLoop = useCallback(() => {
    if (dotScrubRafRef.current) return
    dotScrubLastTRef.current = performance.now()
    dotScrubRafRef.current = requestAnimationFrame(tickDotScrub)
  }, [tickDotScrub])

  const endDotScrub = useCallback(
    (target?: HTMLElement | null, pointerId?: number) => {
      const state = dotScrubRef.current
      if (!state) return
      if (pointerId != null && state.pointerId !== pointerId) return

      if (
        target &&
        pointerId != null &&
        target.hasPointerCapture?.(pointerId)
      ) {
        try {
          target.releasePointerCapture(pointerId)
        } catch {
          // ignore
        }
      }

      // Shrink the under-finger pill back to resting size.
      const pill = target ?? pillRef.current
      pill?.classList.remove('is-held')

      // Only suppress the synthetic click after a real scrub, not a tap.
      if (state.active || state.moved) suppressDotClickRef.current = true
      const wasActive = state.active
      stopDotScrubLoop()
      dotScrubRef.current = null
      isDotScrubbingRef.current = false
      setIsDotScrubbing(false)
      // Push the final imperative index into React before resuming media.
      flushFocusCommit()
      // Resume video decode once dots scrub ends.
      setCarouselScrubbing(false)
      // Soft settle the pill only if we actually scrubbed.
      if (wasActive) {
        lastPillHapticIndexRef.current = focusIndexRef.current
        // Restore filled/empty base opacity with the floaty ease.
        paintDotOpacities(slotIndexToDotIndex(focusIndexRef.current), false)
        updateDotPillFromScrub(true)
        ensureActiveDotVisible(
          slotIndexToDotIndex(focusIndexRef.current),
          'smooth'
        )
      }
    },
    [
      ensureActiveDotVisible,
      flushFocusCommit,
      paintDotOpacities,
      setCarouselScrubbing,
      slotIndexToDotIndex,
      stopDotScrubLoop,
      updateDotPillFromScrub,
    ]
  )

  /**
   * Hold/drag the active pill to scrub cards (same velocity + hold ramp as before).
   * Swiping the surrounding strip only pans the ~8-dot viewport.
   */
  const handlePillPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLSpanElement>) => {
      if (expandedRef.current) return
      if (countRef.current <= 1) return
      // Don't let the strip scroller steal this gesture.
      e.preventDefault()
      e.stopPropagation()

      // Mobile: grow the pill under the finger as soon as contact starts.
      e.currentTarget.classList.add('is-held')

      const now = performance.now()
      dotScrubRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastT: now,
        velocity: 0,
        holdVelocity: 0,
        rate: 0,
        holdIdleSec: 0,
        active: false,
        moved: false,
        accum: 0,
      }

      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    },
    []
  )

  const handlePillPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLSpanElement>) => {
      const state = dotScrubRef.current
      if (!state || state.pointerId !== e.pointerId) return

      const now = performance.now()
      const dtMs = Math.max(now - state.lastT, 1)
      const dx = e.clientX - state.lastX
      const totalX = e.clientX - state.startX
      const totalY = e.clientY - state.startY
      state.lastX = e.clientX
      state.lastT = now

      // Activate scrub only after intentional horizontal travel.
      if (!state.active) {
        if (
          Math.abs(totalX) >= DOT_SCRUB_ACTIVATE_PX &&
          Math.abs(totalX) >= Math.abs(totalY) * 1.05
        ) {
          state.active = true
          state.moved = true
          isDotScrubbingRef.current = true
          setIsDotScrubbing(true)
          // Pause card videos while the pill scrub is live.
          setCarouselScrubbing(true)
          // Kill any leftover card-row scrub so focus jumps stay clean.
          setDragOffsetPx(0)
          startDotScrubLoop()
        } else {
          // Still a short press / tiny wobble — don't scrub yet.
          return
        }
      }

      // Signed instantaneous velocity (px/ms): right +, left -.
      const inst = dx / dtMs
      state.velocity = state.velocity * 0.35 + inst * 0.65

      const absVel = Math.abs(state.velocity)
      if (absVel > DOT_SCRUB_VEL_DEAD) {
        // Meaningful swipe — lock direction + energy for hold-to-continue.
        // Any intentional re-scrub restarts the hold-acceleration ramp.
        state.holdIdleSec = 0
        if (absVel >= Math.abs(state.holdVelocity)) {
          state.holdVelocity = state.velocity
        } else if (Math.sign(state.velocity) === Math.sign(state.holdVelocity)) {
          // Same direction, slower: ease hold rate down so slow scrubs stay slow.
          state.holdVelocity = state.holdVelocity * 0.88 + state.velocity * 0.12
        } else {
          // Reversed direction — take the new signed velocity as the hold.
          state.holdVelocity = state.velocity
        }
      }

      if (Math.abs(dx) > 2) state.moved = true

      // Advance while the finger moves; strip pan is locked via is-dot-scrubbing.
      advanceDotScrub()
      // Keep the moving pill inside the 8-dot window without fighting the finger.
      ensureActiveDotVisible(
        slotIndexToDotIndex(focusIndexRef.current),
        'auto'
      )
      e.preventDefault()
    },
    [
      advanceDotScrub,
      ensureActiveDotVisible,
      setCarouselScrubbing,
      setDragOffsetPx,
      slotIndexToDotIndex,
      startDotScrubLoop,
    ]
  )

  const handlePillPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLSpanElement>) => {
      // Always drop the grow state on release/cancel, even if scrub never armed.
      e.currentTarget.classList.remove('is-held')
      endDotScrub(e.currentTarget, e.pointerId)
    },
    [endDotScrub]
  )

  const handleDotClick = useCallback(
    (dotIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
      // After a real scrub, suppress the synthetic click on the start dot.
      // Plain taps fall through and jump focus as usual.
      if (suppressDotClickRef.current) {
        e.preventDefault()
        e.stopPropagation()
        suppressDotClickRef.current = false
        return
      }
      // Safety: if a scrub is still live, ignore the click.
      if (isDotScrubbingRef.current || dotScrubRef.current?.active) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      const slot = navDotSlotsRef.current[dotIndex]
      if (!slot) {
        e.preventDefault()
        return
      }

      // Empty placeholders are valid scroll targets — same as filled cards.
      onFocusChange(slot.slotIndex)
      // Tap-only haptic.
      hapticForDotTap(slot.slotIndex)
    },
    [hapticForDotTap, onFocusChange]
  )

  // Ensure the continuous scrub loop + pending focus commit are torn down on unmount.
  useEffect(
    () => () => {
      stopDotScrubLoop()
      if (pendingFocusCommitRafRef.current) {
        cancelAnimationFrame(pendingFocusCommitRafRef.current)
        pendingFocusCommitRafRef.current = 0
      }
      pendingFocusCommitRef.current = null
      isDotScrubbingRef.current = false
    },
    [stopDotScrubLoop]
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
    if (expanded) return
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

  // --- Wheel: discrete steps with intensity-based acceleration ---
  // Slow scrolls stay 1-step with a longer lock; dense/fast bursts step farther
  // and reduce the cooldown so the carousel cycles quicker.
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
      // Always capture wheel over the stage so the page doesn't also scroll.
      event.preventDefault()
      event.stopPropagation()

      // Keep pointer sample even while expanded (for when we leave active).
      lastPointerPosRef.current = { x: event.clientX, y: event.clientY }

      if (expandedRef.current) return
      if (countRef.current <= 1) return

      // Prefer true horizontal wheel input when present; boost it so mouse
      // horizontal wheels match vertical scroll speed through the carousel.
      const absX = Math.abs(event.deltaX)
      const absY = Math.abs(event.deltaY)
      const usingHorizontal = absX > absY * 0.85 && absX > 0
      const rawDelta = usingHorizontal ? event.deltaX : event.deltaY
      const scaledDelta = usingHorizontal
        ? rawDelta * WHEEL_HORIZONTAL_GAIN
        : rawDelta

      const absDelta = Math.abs(scaledDelta)
      // Horizontal wheels often emit smaller ticks — slightly lower threshold.
      const threshold = usingHorizontal
        ? WHEEL_DELTA_THRESHOLD * 0.7
        : WHEEL_DELTA_THRESHOLD
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
      // Horizontal bursts usually accumulate less energy; ease the full-scale.
      const burstFull = usingHorizontal
        ? WHEEL_BURST_DELTA_FULL * 0.7
        : WHEEL_BURST_DELTA_FULL
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
      // Horizontal gets a slightly snappier floor so side-scroll keeps up.
      const lockFloor = usingHorizontal
        ? Math.max(40, WHEEL_LOCK_MS_FAST - 10)
        : WHEEL_LOCK_MS_FAST
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
        '.coverflow__chevron, .coverflow__dots, .active-card-panel'
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
          lastPillHapticIndexRef.current = next
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
        }${isDotScrubbing ? ' is-dot-scrubbing' : ''}${hoverSuppressed || wheelHoverSuppressed ? ' is-hover-suppressed' : ''
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
          className="coverflow__chevron coverflow__chevron--left"
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
          ‹
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
          className="coverflow__chevron coverflow__chevron--right"
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
          ›
        </button>

        {navDotSlots.length > 1 && (
          <div className="coverflow__dots" role="tablist" aria-label="Cards">
            {/* Outer shell stays fixed; this scroller owns horizontal pan. */}
            <div ref={dotsRef} className="coverflow__dots-scroller">
              <div ref={dotsTrackRef} className="coverflow__dots-track">
                <span
                  ref={pillRef}
                  className="coverflow__dot-pill"
                  aria-hidden="true"
                  onPointerDown={handlePillPointerDown}
                  onPointerMove={handlePillPointerMove}
                  onPointerUp={handlePillPointerUp}
                  onPointerCancel={handlePillPointerUp}
                >
                  {/* Face owns the pink fill + grow animation (outer pill keeps hit-pad + JS geometry). */}
                  <span className="coverflow__dot-pill-face" />
                </span>
                {navDotSlots.map((slot, index) => {
                  const active = slot.slotIndex === focusIndex
                  // Filled = white @ 0.5; empty = full opacity for inset chip.
                  const base = slot.filled ? 0.5 : 1
                  const activeDot = slotIndexToDotIndex(focusIndex)
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`coverflow__dot${active ? ' active' : ''}${
                        slot.filled ? '' : ' is-empty'
                      }`}
                      style={{
                        // Scrub multiplies distance falloff on top of the base look.
                        opacity: isDotScrubbing
                          ? base * opacityForDotDistance(index - activeDot)
                          : base,
                      }}
                      onClick={(e) => handleDotClick(index, e)}
                      aria-label={
                        slot.filled
                          ? `Go to card slot ${slot.slotIndex + 1}`
                          : `Go to empty slot ${slot.slotIndex + 1}`
                      }
                    />
                  )
                })}
              </div>
            </div>
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
