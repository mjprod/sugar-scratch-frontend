import { animated, to, useSpring, useSprings } from '@react-spring/web'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RevealCard } from '../lib/cards'
import {
  DEFAULT_FAN_DRAG,
  cardUpAxis,
  clampLift,
  isMobileTiltPointer,
  liftProgress,
  scaleMulFromLift,
  tiltYFromScrub,
  underPassAmount,
  underPassOffsetX,
  underPassReturning,
  type FanDragConfig,
} from '../lib/fanDrag'
import {
  DEFAULT_FAN_LAYOUT,
  FAN_OPEN_FROM,
  fanPose,
  type FanLayout,
} from '../lib/fanLayout'
import {
  CARD_STAGGER_MS,
  CARDS_FAN_START_DELAY_MS,
  FAN_CARD_HEIGHT,
  FAN_CARD_WIDTH,
  FAN_GROUP_SYNC_ANTICIPATION_MS,
  FAN_GROUP_SYNC_ANTICIPATION_Y,
  FAN_GROUP_SYNC_DROP_PX,
  FAN_GROUP_SYNC_MOVE_MS,
  PLAY_CTA_EARLY_MS,
} from '../lib/revealTiming'
import { FanCard } from './FanCard'

type CardFanProps = {
  cards: RevealCard[]
  active: boolean
  layout?: FanLayout
  dragConfig?: FanDragConfig
  /** When true, snap to final fan poses (for live debug spacing). */
  liveEdit?: boolean
  /**
   * When true, ease the whole fan group down with the pack's post-shake tuck.
   */
  syncDrop?: boolean
  onComplete?: () => void
}

function easeInCubic(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x
}

/** Slower settle — ease-out cubic (fast start, long soft landing). */
function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 3)
}

/** Slow start + soft finish — better for fade-ins than ease-out. */
function easeInOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Scale dip during anticipation (relative to open-from scale). */
const FAN_ANTICIPATION_SCALE_MUL = 0.9
/** Slight inward tuck on outer cards during anticipation. */
const FAN_ANTICIPATION_X_MUL = 0.35
const FAN_ANTICIPATION_Y = 10

/** Overshoot past the final open pose, then settle. */
const FAN_OVERSHOOT_SPREAD_X_MUL = 1.14
const FAN_OVERSHOOT_SPREAD_DEG_MUL = 1.12
const FAN_OVERSHOOT_LIFT_MUL = 1.1
const FAN_OVERSHOOT_SCALE_MUL = 1.06

/**
 * Whole-group rise out of the foil pack mouth:
 * starts lower + faded, eases up into the original fan anchor.
 */
const FAN_GROUP_FROM_Y = 56
const FAN_GROUP_TO_Y = 0
const FAN_GROUP_OVERSHOOT_Y = -8
/** Slow group opacity ramp so cards ease in instead of popping. */
const FAN_GROUP_FADE_MS = 720
/** Delay before fade begins once the fan group is active. */
const FAN_GROUP_FADE_DELAY_MS = 40

function closedLayout(layout: FanLayout): FanLayout {
  return {
    ...layout,
    spreadX: FAN_OPEN_FROM.spreadX,
    spreadDeg: FAN_OPEN_FROM.spreadDeg,
    liftY: FAN_OPEN_FROM.liftY,
    cardScale: FAN_OPEN_FROM.cardScale,
    outerDrop: 0,
  }
}

function anticipationLayout(layout: FanLayout): FanLayout {
  // Tiny reverse: cards tuck tighter/lower and shrink before bursting open.
  return {
    ...layout,
    spreadX: FAN_OPEN_FROM.spreadX,
    spreadDeg: FAN_OPEN_FROM.spreadDeg,
    liftY: Math.max(0, FAN_OPEN_FROM.liftY - FAN_ANTICIPATION_Y),
    cardScale: FAN_OPEN_FROM.cardScale * FAN_ANTICIPATION_SCALE_MUL,
    outerDrop: 0,
  }
}

function overshootLayout(layout: FanLayout): FanLayout {
  return {
    ...layout,
    spreadX: layout.spreadX * FAN_OVERSHOOT_SPREAD_X_MUL,
    spreadDeg: layout.spreadDeg * FAN_OVERSHOOT_SPREAD_DEG_MUL,
    liftY: layout.liftY * FAN_OVERSHOOT_LIFT_MUL,
    cardScale: layout.cardScale * FAN_OVERSHOOT_SCALE_MUL,
  }
}

/**
 * Widen the hand so a covered card can be seen while lifted.
 * progress 0 = rest layout, 1 = full clear spread.
 */
function clearLayout(
  layout: FanLayout,
  progress: number,
  cfg: FanDragConfig,
): FanLayout {
  const t = Math.min(1, Math.max(0, progress))
  if (t <= 0) return layout
  return {
    ...layout,
    spreadX: layout.spreadX + cfg.clearSpreadX * t,
    spreadDeg: layout.spreadDeg + cfg.clearSpreadDeg * t,
    outerDrop: layout.outerDrop + cfg.clearOuterDrop * t,
  }
}

function poseValues(
  index: number,
  total: number,
  layout: FanLayout,
  opacity = 1,
) {
  const pose = fanPose(index, total, layout)
  // Keep closed/anticipation cards optically stacked even if spread is 0.
  const x =
    layout.spreadX === 0 ? pose.x * FAN_ANTICIPATION_X_MUL : pose.x
  return {
    x,
    y: pose.y,
    rot: pose.rot,
    scale: layout.cardScale,
    opacity,
  }
}

export function CardFan({
  cards,
  active,
  layout = DEFAULT_FAN_LAYOUT,
  dragConfig = DEFAULT_FAN_DRAG,
  liveEdit = false,
  syncDrop = false,
  onComplete,
}: CardFanProps) {
  const completedRef = useRef(false)
  const [dragReady, setDragReady] = useState(liveEdit)
  const timersRef = useRef<number[]>([])
  const syncDropTimersRef = useRef<number[]>([])
  const dragConfigRef = useRef(dragConfig)
  const layoutRef = useRef(layout)
  const dragSessionRef = useRef<{
    index: number
    pointerId: number
    pointerType: string
    startClientX: number
    startClientY: number
    /** Fan pose rotation (deg) — drag travels along this axis. */
    rot: number
    active: boolean
    /** True once lift crossed the near-top threshold this gesture. */
    elevated: boolean
    /**
     * Client X locked the moment tilt becomes available (near full lift).
     * Scrub is measured from here so earlier lift travel doesn't pre-tilt.
     */
    tiltOriginX: number | null
  } | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  /**
   * Raised at the under-pass peak (mid-lift) while cards above are fully
   * aside — not on pointer-down, and not at the top of the drag.
   * Cleared instantly on release so the card springs home in natural order.
   */
  const [elevatedIndex, setElevatedIndex] = useState<number | null>(null)

  useEffect(() => {
    dragConfigRef.current = dragConfig
  }, [dragConfig])

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const clearTimers = () => {
    for (const id of timersRef.current) {
      window.clearTimeout(id)
      window.cancelAnimationFrame(id)
    }
    timersRef.current = []
  }

  const clearSyncDropTimers = () => {
    for (const id of syncDropTimersRef.current) {
      window.clearTimeout(id)
    }
    syncDropTimersRef.current = []
  }

  const [groupSpring, groupApi] = useSpring(() => ({
    y: liveEdit ? FAN_GROUP_TO_Y : FAN_GROUP_FROM_Y,
    opacity: liveEdit ? 1 : 0,
    config: { tension: 210, friction: 24 },
  }))

  const [springs, api] = useSprings(cards.length, (index) => {
    if (liveEdit) {
      const values = poseValues(index, cards.length, layout, 1)
      return {
        ...values,
        // Positive = distance along the card's local up (fan angle).
        dragLift: 0,
        // Progressive grow while lifted (1 = rest size).
        dragScaleMul: 1,
        // Mobile-only peek tilt (rotateY deg) while held at full lift.
        dragTiltY: 0,
        // Sibling dim while another card is lifted (1 = full, filter brightness).
        brightness: 1,
        config: { tension: 220, friction: 22 },
      }
    }

    const values = poseValues(index, cards.length, closedLayout(layout), 1)
    return {
      ...values,
      dragLift: 0,
      dragScaleMul: 1,
      dragTiltY: 0,
      brightness: 1,
      config: { tension: 220, friction: 22 },
    }
  })

  useEffect(() => {
    completedRef.current = false
    setDragReady(liveEdit)
    setDraggingIndex(null)
    setElevatedIndex(null)
    dragSessionRef.current = null
    clearTimers()

    if (!active && !liveEdit) {
      groupApi.start({
        y: FAN_GROUP_FROM_Y,
        opacity: 0,
        immediate: true,
      })
      api.start((index) => ({
        ...poseValues(index, cards.length, closedLayout(layout), 1),
        dragLift: 0,
        dragScaleMul: 1,
        dragTiltY: 0,
        brightness: 1,
        immediate: true,
      }))
      return clearTimers
    }

    // Live spacing edit: snap to final open layout without replay animation.
    if (liveEdit) {
      groupApi.start({
        y: FAN_GROUP_TO_Y,
        opacity: 1,
        immediate: true,
      })
      api.start((index) => ({
        ...poseValues(index, cards.length, layout, 1),
        dragLift: 0,
        dragScaleMul: 1,
        dragTiltY: 0,
        brightness: 1,
        immediate: true,
      }))
      setDragReady(true)
      return clearTimers
    }

    // Group: start low + faded at the pack mouth.
    groupApi.start({
      y: FAN_GROUP_FROM_Y,
      opacity: 0,
      immediate: true,
    })

    // Cards: closed stacked pose (group handles overall fade).
    api.start((index) => ({
      ...poseValues(index, cards.length, closedLayout(layout), 1),
      dragLift: 0,
      dragScaleMul: 1,
      dragTiltY: 0,
      brightness: 1,
      immediate: true,
    }))

    // Slow opacity fade first — cards stay fully hidden until this begins.
    const fadeId = window.setTimeout(() => {
      groupApi.start({
        opacity: 1,
        config: {
          duration: FAN_GROUP_FADE_MS,
          easing: easeInOutCubic,
        },
      })
    }, FAN_GROUP_FADE_DELAY_MS)
    timersRef.current.push(fadeId)

    // Fan-out starts just before the bounce-up, then continues through the rise.
    const riseStartMs = FAN_GROUP_FADE_DELAY_MS + 80
    /** How early fan-out begins before the group bounce-up (ms). */
    const FAN_OPEN_BEFORE_BOUNCE_MS = 200
    const anticStartMs = Math.max(0, riseStartMs - FAN_OPEN_BEFORE_BOUNCE_MS - 30)
    const openStartMs = Math.max(0, riseStartMs - FAN_OPEN_BEFORE_BOUNCE_MS)

    const riseId = window.setTimeout(() => {
      groupApi.start({
        y: FAN_GROUP_OVERSHOOT_Y,
        config: { tension: 210, friction: 24 },
      })
    }, riseStartMs)
    timersRef.current.push(riseId)

    // Group settles back down after the open is already underway.
    const settleGroupId = window.setTimeout(() => {
      groupApi.start({
        y: FAN_GROUP_TO_Y,
        config: { tension: 180, friction: 28 },
      })
    }, riseStartMs + 220)
    timersRef.current.push(settleGroupId)

    // Tiny tuck just before fan-out / bounce.
    const anticId = window.setTimeout(() => {
      api.start((index) => ({
        ...poseValues(index, cards.length, anticipationLayout(layout), 1),
        delay: index * Math.max(6, CARD_STAGGER_MS * 0.25),
        config: { tension: 340, friction: 30 },
      }))
    }, anticStartMs)
    timersRef.current.push(anticId)

    // Fan-out begins before bounce-up.
    const openId = window.setTimeout(() => {
      api.start((index) => ({
        ...poseValues(index, cards.length, overshootLayout(layout), 1),
        delay: CARDS_FAN_START_DELAY_MS + index * Math.round(CARD_STAGGER_MS * 1.05),
        config: { tension: 240, friction: 22, clamp: false },
      }))
    }, openStartMs)
    timersRef.current.push(openId)

    // Settle onto final layout while/after the bounce lands.
    let finished = 0
    const settleStartMs =
      openStartMs +
      CARDS_FAN_START_DELAY_MS +
      cards.length * Math.round(CARD_STAGGER_MS * 1.05) +
      120
    const settleStaggerMs = Math.max(12, CARD_STAGGER_MS * 0.55)
    // Approximate when the last settle spring is visually home.
    const settleRestEstimateMs = 520
    const settleCompleteMs =
      settleStartMs +
      (cards.length - 1) * settleStaggerMs +
      settleRestEstimateMs

    // Play CTA can appear slightly before the last spring fully rests.
    const ctaId = window.setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onComplete?.()
    }, Math.max(0, settleCompleteMs - PLAY_CTA_EARLY_MS))
    timersRef.current.push(ctaId)

    const settleId = window.setTimeout(() => {
      api.start((index) => ({
        ...poseValues(index, cards.length, layout, 1),
        delay: index * settleStaggerMs,
        config: { tension: 190, friction: 28 },
        onRest: () => {
          finished += 1
          if (finished >= cards.length) {
            // Drag unlocks on true settle; CTA may already be visible.
            setDragReady(true)
            if (!completedRef.current) {
              completedRef.current = true
              onComplete?.()
            }
          }
        },
      }))
    }, settleStartMs)
    timersRef.current.push(settleId)

    return clearTimers
  }, [active, api, cards.length, groupApi, layout, liveEdit, onComplete])

  // When the pack starts its post-shake tuck, ease the fan group down
  // with a stronger anticipation and a slower ease-out settle.
  useEffect(() => {
    clearSyncDropTimers()
    if (!syncDrop || liveEdit || !active) return

    // Anticipation: clear lift (opposite of the drop) before settling down.
    groupApi.start({
      y: FAN_GROUP_SYNC_ANTICIPATION_Y,
      opacity: 1,
      config: {
        duration: FAN_GROUP_SYNC_ANTICIPATION_MS,
        easing: easeInCubic,
      },
    })

    const dropId = window.setTimeout(() => {
      groupApi.start({
        y: FAN_GROUP_SYNC_DROP_PX,
        opacity: 1,
        config: {
          duration: FAN_GROUP_SYNC_MOVE_MS,
          easing: easeOutCubic,
        },
      })
    }, FAN_GROUP_SYNC_ANTICIPATION_MS)
    syncDropTimersRef.current.push(dropId)

    return clearSyncDropTimers
  }, [active, groupApi, liveEdit, syncDrop])

  const endCardDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      const cfg = dragConfigRef.current
      dragSessionRef.current = null
      setDraggingIndex(null)

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const restLayout = layoutRef.current
      const releasedIndex = session.index

      // Restore natural stack order immediately on release — the card keeps
      // springing home underneath (or above) its neighbors without a late z pop.
      setElevatedIndex((current) =>
        current === releasedIndex ? null : current,
      )

      // Lift snaps home; scale eases down softer for a floaty settle.
      // Tilt springs flat; siblings ease back from clear pose + dim.
      api.start((i) => {
        if (i === releasedIndex) {
          return {
            brightness: 1,
            dragLift: 0,
            dragScaleMul: 1,
            dragTiltY: 0,
            immediate: false,
            config: (key) =>
              key === 'dragScaleMul'
                ? {
                    tension: cfg.scaleReturnTension,
                    friction: cfg.scaleReturnFriction,
                  }
                : key === 'dragTiltY'
                  ? {
                      // Slightly softer than lift return so tilt unwinds smoothly.
                      tension: Math.max(80, cfg.returnTension * 0.7),
                      friction: cfg.returnFriction + 4,
                    }
                  : {
                      tension: cfg.returnTension,
                      friction: cfg.returnFriction,
                    },
          }
        }

        // Rest pose + full brightness (covers clear / under-pass / dim restore).
        return {
          ...poseValues(i, cards.length, restLayout, 1),
          brightness: 1,
          dragTiltY: 0,
          immediate: false,
          config: {
            tension: cfg.clearTension,
            friction: cfg.clearFriction,
          },
        }
      })
    },
    [api, cards.length],
  )

  const onCardPointerDown = useCallback(
    (index: number, event: React.PointerEvent<HTMLDivElement>) => {
      // Only after fan settle (or live spacing edit, where poses are already final).
      if (!dragReady) return
      // Only primary button / touch.
      if (event.button !== 0 && event.pointerType === 'mouse') return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      // Lift travels along each card's fan rotation (center = straight up).
      const pose = fanPose(index, cards.length, layoutRef.current)

      dragSessionRef.current = {
        index,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startClientX: event.clientX,
        startClientY: event.clientY,
        rot: pose.rot,
        active: false,
        elevated: false,
        tiltOriginX: null,
      }
      // Track drag for cursor only — z-index stays natural until near full lift.
      setDraggingIndex(index)
    },
    [cards.length, dragReady],
  )

  const onCardPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      const cfg = dragConfigRef.current
      const restLayout = layoutRef.current
      // Stack is reverse of array order: card 0 (first) is top-most.
      const topIndex = 0
      // Top-most card already sits above the hand — no sibling clear / under-pass.
      const shouldClearSiblings = session.index > topIndex
      const shouldUnderPass = session.index > topIndex

      const dx = (event.clientX - session.startClientX) * cfg.dragScale
      const dy = (event.clientY - session.startClientY) * cfg.dragScale

      if (!session.active) {
        if (Math.hypot(dx, dy) < cfg.activateThreshold) return
        session.active = true
      }

      // Project pointer travel onto the card's local up axis.
      // Center card (rot 0): up = (0, -1). Outer cards lean with fan angle.
      const axis = cardUpAxis(session.rot)
      const projected = dx * axis.x + dy * axis.y
      // Unclamped lift from the finger — used for z-index thresholds so
      // rubber-band / eased visuals can't make promote fire early.
      const rawLift = Math.max(0, projected)
      const nextLift = clampLift(projected, cfg.maxLift, cfg.rubberBand)
      // Linear 0..1 from finger travel (not eased) — drives under-pass + z flip.
      const rawProgress =
        cfg.maxLift > 0 ? Math.min(1, rawLift / cfg.maxLift) : 0
      // Eased progress still used for clear-out / dim / scale feel.
      const progress = liftProgress(nextLift, cfg.maxLift)
      const nextScaleMul = scaleMulFromLift(
        nextLift,
        cfg.maxLift,
        cfg.scaleBoost,
      )
      const clearT = shouldClearSiblings ? progress : 0
      const cleared =
        clearT > 0 ? clearLayout(restLayout, clearT, cfg) : restLayout
      // Siblings darken via brightness (not opacity — keeps cards solid).
      const dimTarget = Math.min(1, Math.max(0, cfg.dimBrightness))
      const siblingBrightness = 1 + (dimTarget - 1) * progress

      // Covered cards: promote z only once under-pass has peaked (cards fully
      // aside). Top card has nothing to pass under — promote near full lift.
      if (!session.elevated && cfg.maxLift > 0) {
        const elevateAt = shouldUnderPass
          ? cfg.underPassPeak
          : 0.99
        if (rawProgress >= elevateAt) {
          session.elevated = true
          setElevatedIndex(session.index)
        }
      }

      // Lift-driven under-pass: slide right → peak (z flips) → ease home.
      // Target finishes at underPassEnd; soft spring trails for a smooth land.
      const passAmount = shouldUnderPass
        ? underPassAmount(
            rawProgress,
            cfg.underPassStart,
            cfg.underPassPeak,
            cfg.underPassEnd,
          )
        : 0
      const passReturning =
        shouldUnderPass &&
        underPassReturning(rawProgress, cfg.underPassPeak, session.elevated)

      // Mobile-only: once near full lift, lock a scrub origin and map left/right
      // finger travel to rotateY (±tiltMaxDeg). Mouse never tilts.
      let nextTiltY = 0
      const canTilt =
        isMobileTiltPointer(session.pointerType) && cfg.tiltMaxDeg > 0
      if (canTilt && rawProgress >= cfg.tiltStartProgress) {
        if (session.tiltOriginX == null) {
          session.tiltOriginX = event.clientX
        }
        nextTiltY = tiltYFromScrub(
          event.clientX - session.tiltOriginX,
          cfg.tiltScrubPx,
          cfg.tiltMaxDeg,
        )
      } else if (session.tiltOriginX != null && rawProgress < cfg.tiltStartProgress) {
        // Dropped back below the tilt band — clear origin + flatten.
        session.tiltOriginX = null
        nextTiltY = 0
      }

      api.start((i) => {
        if (i === session.index) {
          // Dragged card keeps its rest fan pose; lift + scale + optional tilt.
          // (Avoid following the widened layout so it doesn't slide sideways.)
          return {
            ...poseValues(i, cards.length, restLayout, 1),
            brightness: 1,
            dragLift: nextLift,
            dragScaleMul: nextScaleMul,
            dragTiltY: nextTiltY,
            // Lift tracks the finger tightly; scale eases in for float;
            // tilt follows scrub with a light spring so it isn't jittery.
            immediate: (key) => key === 'dragLift',
            config: (key) =>
              key === 'dragScaleMul'
                ? {
                    tension: cfg.scaleFollowTension,
                    friction: cfg.scaleFollowFriction,
                  }
                : key === 'dragLift'
                  ? {
                      tension: 500,
                      friction: 40,
                    }
                  : key === 'dragTiltY'
                    ? {
                        // Snappy follow so scrub feels immediate on mobile.
                        tension: 420,
                        friction: 28,
                      }
                    : {
                        tension: cfg.clearTension,
                        friction: cfg.clearFriction,
                      },
          }
        }

        const passX = underPassOffsetX(
          i,
          session.index,
          passAmount,
          cfg.underPassX,
          cfg.underPassStaggerX,
        )
        // Cards left of the drag can fan clear for readability; cards on the
        // right stay on the rest fan and only take the temporary under-pass.
        // That keeps the right side tighter instead of double-spreading.
        const useClear =
          shouldClearSiblings && clearT > 0 && i < session.index
        const basePose = poseValues(
          i,
          cards.length,
          useClear ? cleared : restLayout,
          1,
        )
        // Cards stacked above the drag (lower index = higher in the hand).
        const isPassingCard = shouldUnderPass && i < session.index

        // Everyone else dims via brightness; covered lifts clear left siblings.
        // Cards above the drag: snappy slide-out, then a slower eased spring
        // home after z promotes so the return doesn't feel mechanical.
        return {
          ...basePose,
          x: basePose.x + passX,
          brightness: siblingBrightness,
          immediate: false,
          config: (key) => {
            if (key === 'x' && isPassingCard && passReturning) {
              return {
                tension: cfg.underPassReturnTension,
                friction: cfg.underPassReturnFriction,
              }
            }
            if (key === 'x' && isPassingCard) {
              // Snappy outbound so cards are fully aside before z flips.
              return { tension: 320, friction: 28 }
            }
            return {
              tension: cfg.clearTension,
              friction: cfg.clearFriction,
            }
          },
        }
      })
    },
    [api, cards.length],
  )

  return (
    <animated.div
      className={`card-fan${dragReady ? ' is-drag-ready' : ''}`}
      style={{
        // CSS vars for card slot sizing.
        ['--fan-card-w' as string]: `${FAN_CARD_WIDTH}px`,
        ['--fan-card-h' as string]: `${FAN_CARD_HEIGHT}px`,
        opacity: groupSpring.opacity,
        transform: groupSpring.y.to((y) => `translate3d(0, ${y}px, 0)`),
      }}
      aria-hidden={!active && !liveEdit}
    >
      {springs.map((style, index) => {
        const card = cards[index]
        if (!card) return null

        const isDragging = draggingIndex === index
        const isElevated = elevatedIndex === index

        return (
          <animated.div
            key={card.id}
            className={`card-fan__slot${isDragging ? ' is-dragging' : ''}${
              isElevated ? ' is-elevated' : ''
            }${dragReady ? ' is-draggable' : ''}`}
            style={{
              opacity: style.opacity,
              // Dim siblings with brightness so stacked cards stay solid (not see-through).
              filter: style.brightness.to((b) => `brightness(${b})`),
              // Natural stack: card 01 (index 0) on top, each next card under the previous.
              // Elevated drag still jumps above the whole hand.
              zIndex: isElevated
                ? cards.length + 10
                : cards.length - index,
              // Needed so rotateY reads with depth on mobile.
              transformStyle: 'preserve-3d',
              touchAction: dragReady ? 'none' : undefined,
              cursor: dragReady ? (isDragging ? 'grabbing' : 'grab') : undefined,
              transform: to(
                [
                  style.x,
                  style.y,
                  style.dragLift,
                  style.rot,
                  style.scale,
                  style.dragScaleMul,
                  style.dragTiltY,
                ],
                (x, y, dragLift, rot, scale, dragScaleMul, dragTiltY) => {
                  // Move along the card's local up so outer cards slide on their fan angle.
                  const axis = cardUpAxis(rot)
                  const ox = axis.x * dragLift
                  const oy = axis.y * dragLift
                  const s = scale * dragScaleMul
                  // rotateY after fan rotate so the peek is relative to the card face.
                  return `translate3d(${x + ox}px, ${y + oy}px, 0) rotate(${rot}deg) rotateY(${dragTiltY}deg) scale(${s})`
                },
              ),
            }}
            onPointerDown={(event) => onCardPointerDown(index, event)}
            onPointerMove={onCardPointerMove}
            onPointerUp={endCardDrag}
            onPointerCancel={endCardDrag}
          >
            <FanCard card={card} playing={active || liveEdit} />
          </animated.div>
        )
      })}
    </animated.div>
  )
}
