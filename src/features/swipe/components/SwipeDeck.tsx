import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import {
  STACK_BACK_VISIBLE,
  STACK_DISSOLVE_SCALE,
  STACK_DISSOLVE_SPRING,
  SWIPE_DESKTOP_MIN_WIDTH,
  SWIPE_EXIT_OVERSHOOT_VW,
  SWIPE_NOPE_EXTRA_ROTATION,
  SWIPE_NOPE_SCALE_MOBILE,
  SWIPE_REST_ROTATION,
  SWIPE_ROTATION,
  VISIBLE_STACK,
  isSwipeDesktop,
  SWIPE_CLAMP_COMMIT_T,
  swipeDragMaxVw,
  swipeDownDragMaxPx,
  swipeFlickMinPx,
  swipeFlickVelocity,
  swipeHeroRestYPx,
  swipeLeftDragMaxPx,
  swipeNopeProgressPx,
  swipeThresholdPx,
  type SwipeCardData,
} from '../constants/cards'
import { useSwipeCircleLivePublisher } from '../context/SwipeCircleDebugContext'
import { StackBacks } from './StackBacks'
import { StackSlot } from './StackSlot'
import { SwipeStamp } from './SwipeStamp'
import {
  fingerDragToStampSequence,
  loadSwipeFeedbackByDevice,
  mapDragToLottie,
  mapDragToTransform,
  STAMP_DRAG_SEQUENCE_MAX,
  stampVelocityT,
  velocityToStampFinishMs,
  velocityToStampPlayheadRate,
  type SwipeFeedbackTune,
} from '../constants/swipeFeedback'

/** Viewport-active stamp tune (desktop/mobile lanes from localStorage defaults). */
function useSwipeFeedbackTune(): SwipeFeedbackTune {
  const [tune, setTune] = useState<SwipeFeedbackTune>(() => {
    const byDevice = loadSwipeFeedbackByDevice()
    return isSwipeDesktop() ? byDevice.desktop : byDevice.mobile
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(`(min-width: ${SWIPE_DESKTOP_MIN_WIDTH}px)`)
    const apply = () => {
      const byDevice = loadSwipeFeedbackByDevice()
      setTune(mql.matches ? byDevice.desktop : byDevice.mobile)
    }
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  return tune
}

type SwipeDeckProps = {
  initialCards: SwipeCardData[]
  onEmpty?: () => void
  /** Called when a card is committed. dir 1 = LIKE, -1 = NOPE. */
  onSwipe?: (card: SwipeCardData, dir: 1 | -1) => void
  /** Primary empty CTA — e.g. take me to my packs. */
  onContinue?: () => void
  continueLabel?: string
  /** Secondary empty CTA — e.g. swipe again. */
  onRestart?: () => void
  restartLabel?: string
  /**
   * When true, play a one-shot gentle yes/nope swipe teaser after load.
   * Typically gated on media-ready so the stage is already visible.
   */
  playSwipeHint?: boolean
}

/** Session-scoped: only auto-demo the swipe gesture once per tab session. */
const SWIPE_HINT_STORAGE_KEY = 'sugar-scratch.swipeHint.v1'

/**
 * Peak teaser travel as a fraction of the commit threshold.
 * YES stays a light peek; NOPE goes further so more of the left timeline shows.
 */
const SWIPE_HINT_LIKE_FRACTION = 1 / 3
const SWIPE_HINT_NOPE_FRACTION = 0.58
/** Snappy first-load demo — ~30% faster moves; start delay stays readable. */
const SWIPE_HINT_START_DELAY_MS = 380
const SWIPE_HINT_MOVE_MS = 265
/** Soft settle home after the NOPE peek — kept short so scale snaps back cleanly. */
const SWIPE_HINT_RETURN_MS = 180
const SWIPE_HINT_HOLD_MS = 155

function easeInOutCubic(t: number) {
  const u = Math.min(1, Math.max(0, t))
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

/** Soft landing for the return-to-center — decelerates more than cubic out. */
function easeOutQuart(t: number) {
  const u = 1 - Math.min(1, Math.max(0, t))
  return 1 - u * u * u * u
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function hasSeenSwipeHint() {
  if (typeof window === 'undefined') return true
  try {
    return window.sessionStorage.getItem(SWIPE_HINT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markSwipeHintSeen() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SWIPE_HINT_STORAGE_KEY, '1')
  } catch {
    // Ignore quota / private-mode failures — hint simply may replay.
  }
}

type LeavingCard = {
  card: SwipeCardData
  dir: 1 | -1
  /** Monotonic id so an older fly-away cannot clear a newer leave. */
  gen: number
}

type StampFinish = {
  type: 'like' | 'nope'
  /** Monotonic id so SwipeStamp can restart finish/reset cleanly. */
  key: number
  /** Lottie playhead captured at commit so finish continues from the drag frame. */
  from: number
  /** Transform pose at commit — finish animation continues from here. */
  transformY: number
  transformRot: number
  transformScale: number
  transformOpacity: number
  transformBlur: number
  /** NOPE: CSS fall duration after the remaining sequence plays out. */
  fallMs?: number
}

/** Render one extra under-card so its face is warm before it peeks in. */
const MOUNTED_STACK = VISIBLE_STACK + 1
/**
 * Max concurrent <video> mounts (front + one warm neighbor).
 * Deeper stack cards stay on API posters — iOS chokes on a full video pile.
 * Only the live front (and a leaving flyer) actually call play().
 */
const MAX_MOUNTED_VIDEOS = 2

const dragFollow = { tension: 500, friction: 40, precision: 0.01 }
const settle = { tension: 240, friction: 22, mass: 1.05 }
const flyAway = { tension: 150, friction: 26, mass: 1.1 }
/** Keyboard yes/no — snappier leave flight than finger drag. */
const flyAwayKeyboard = { tension: 280, friction: 24, mass: 0.9 }
/** Mobile fast-flick leave — snaps cards out so spam swipes feel free. */
const flyAwayMobileFast = { tension: 340, friction: 22, mass: 0.8 }

type FlyConfig = typeof flyAway

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Mobile only: scale leave spring with swipe speed.
 * Desktop always keeps the original flyAway config.
 */
function leaveFlyConfigForVelocity(vxAbs: number): FlyConfig {
  if (isSwipeDesktop()) return flyAway
  const t = stampVelocityT(vxAbs)
  return {
    tension: lerp(flyAway.tension, flyAwayMobileFast.tension, t),
    friction: lerp(flyAway.friction, flyAwayMobileFast.friction, t),
    mass: lerp(flyAway.mass, flyAwayMobileFast.mass, t),
  }
}

/**
 * Mobile only: fast flicks unlock immediately (spam-friendly).
 * Slow mobile swipes + all desktop finger swipes keep the leave lock.
 */
function shouldUnlockEarlyOnMobile(vxAbs: number): boolean {
  if (isSwipeDesktop()) return false
  return stampVelocityT(vxAbs) >= 0.55
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** Horizontal travel cap: per-side mobile/desktop vw caps. */
function dragMaxPx(direction: 'left' | 'right') {
  if (typeof window === 'undefined') return 240
  const width = window.innerWidth
  // Left uses shared helper so NOPE progress keys off the same clamp.
  if (direction === 'left') return swipeLeftDragMaxPx(width)
  // Mobile right: vw cap, floored past the commit gate.
  // Desktop right: pure vw cap.
  const byVw = width * swipeDragMaxVw('right', width)
  if (width >= SWIPE_DESKTOP_MIN_WIDTH) return byVw
  const commitClearance = swipeThresholdPx(width) * 1.12
  return Math.max(commitClearance, byVw)
}

/** Commit fly target: side clamp + overshoot (not full viewport). */
function leaveFlyDistancePx(direction: 'left' | 'right') {
  if (typeof window === 'undefined') return dragMaxPx(direction) + 40
  return dragMaxPx(direction) + window.innerWidth * SWIPE_EXIT_OVERSHOOT_VW
}

/** Clamp finger movement with per-side desktop caps. */
function clampDragX(mx: number) {
  const leftMax = dragMaxPx('left')
  const rightMax = dragMaxPx('right')
  return Math.min(rightMax, Math.max(-leftMax, mx))
}

/**
 * Project 2D finger movement onto the signed YES(+)/NOPE(−) axis used by
 * stamps / glow / StackSlot. Dominant axis wins.
 *
 * Vertical down is capped at ~5dvh on desktop; progress is then remapped into
 * the left-drag NOPE space so full down still peaks the red tint.
 */
function projectDragIntent(mx: number, my: number) {
  const verticalLed = Math.abs(my) > Math.abs(mx)
  const leftMax = dragMaxPx('left')
  const rightMax = dragMaxPx('right')
  const downMax = swipeDownDragMaxPx()
  const nopeProgressMax = swipeNopeProgressPx()

  if (verticalLed) {
    if (my > 0) {
      // Down → NOPE. Clamp travel, then map t into left NOPE progress space.
      const t = Math.min(1, my / downMax)
      return {
        intent: -t * nopeProgressMax,
        progressT: t,
        direction: 'left' as const,
        verticalLed: true,
        // Visual Y follows the clamped down travel.
        visualY: Math.min(my, downMax) * 0.55,
      }
    }
    // Up → YES. Reuse right horizontal max as the up travel gate.
    const t = Math.min(1, -my / rightMax)
    return {
      intent: t * rightMax,
      progressT: t,
      direction: 'right' as const,
      verticalLed: true,
      visualY: Math.max(my, -rightMax) * 0.55,
    }
  }

  const clamped = clampDragX(mx)
  const sideMax = clamped >= 0 ? rightMax : leftMax
  const progressT =
    sideMax > 0 ? Math.min(1, Math.abs(clamped) / sideMax) : 0
  return {
    intent: clamped,
    progressT,
    direction: (clamped >= 0 ? 'right' : 'left') as 'left' | 'right',
    verticalLed: false,
    visualY: my * 0.32,
  }
}

/** Same axis pick for velocity: up flick → +YES, down → −NOPE. */
function intentVelocity(mx: number, my: number, vx: number, vy: number) {
  if (Math.abs(my) > Math.abs(mx)) return -vy
  return vx
}

/**
 * Distance-commit when the finger clears the px threshold OR reaches most of
 * the active side's clamp (desktop left/down clamps are under the threshold).
 */
function shouldCommitByDistance(progressT: number, intentAbs: number) {
  return (
    intentAbs > swipeThresholdPx() || progressT >= SWIPE_CLAMP_COMMIT_T
  )
}

/** Active-drag lift; mobile NOPE eases down to SWIPE_NOPE_SCALE_MOBILE. */
const DRAG_PRESS_SCALE = 1.03

function leftProgressFromX(mx: number) {
  if (mx >= 0) return 0
  // Match StackSlot: peak NOPE scale/rot at left drag clamp, not commit threshold.
  return Math.min(1, Math.max(0, -mx / swipeNopeProgressPx()))
}

function dragScaleForX(mx: number) {
  if (mx >= 0 || isSwipeDesktop()) return DRAG_PRESS_SCALE
  const t = leftProgressFromX(mx)
  return DRAG_PRESS_SCALE * (1 - t) + SWIPE_NOPE_SCALE_MOBILE * t
}

/** Finger rotation + rest cancel; NOPE adds a little extra tilt. */
function dragRotForX(mx: number, restRot: number) {
  return (
    mx * SWIPE_ROTATION -
    restRot -
    SWIPE_NOPE_EXTRA_ROTATION * leftProgressFromX(mx)
  )
}

function easeOutCubic(t: number) {
  const u = 1 - clamp(t, 0, 1)
  return 1 - u * u * u
}

export function SwipeDeck({
  initialCards,
  onEmpty,
  onSwipe,
  onContinue,
  continueLabel = 'Take me to my packs',
  onRestart,
  restartLabel = 'Swipe again',
  playSwipeHint = false,
}: SwipeDeckProps) {
  const [cards, setCards] = useState(initialCards)
  const [leaving, setLeaving] = useState<LeavingCard | null>(null)
  const [dragX, setDragX] = useState(0)
  /** Lottie/transform trail the finger by feedback.*.dragLagMs (ref-only). */
  /**
   * Per-side sequence playheads (0–1 of threshold). Rate-limited while dragging
   * so fast flicks don't burn the whole timeline; finishes 0→1 on commit.
   * Finger only drives 0→75%; reserved 75→100% plays on swipe-away.
   */
  const [likeSequence01, setLikeSequence01] = useState(0)
  const [nopeSequence01, setNopeSequence01] = useState(0)
  const [busy, setBusy] = useState(false)
  const [stampFinish, setStampFinish] = useState<StampFinish | null>(null)
  /** Finish gate: false while remaining sequence tweens; true runs CSS exit. */
  const [stampExiting, setStampExiting] = useState(false)
  /** True while the first-load teaser owns the front card transform. */
  const [hintPlaying, setHintPlaying] = useState(false)
  const finishKeyRef = useRef(0)
  const leaveGenRef = useRef(0)
  const feedback = useSwipeFeedbackTune()
  const publishCircleLive = useSwipeCircleLivePublisher()
  /**
   * Keyboard commits set kickX and zero drag in the same tick, so the glow
   * never sees a painted peak. While this timer is live, drag-based publish
   * is skipped and a full-side pulse owns the circle.
   */
  const keyboardGlowTimerRef = useRef<number | null>(null)

  /**
   * Finger drag latches busy through leave flight.
   * Keyboard commits use a brief handoff only so arrows can chain quickly.
   */
  const busyRef = useRef(false)
  const cardsRef = useRef(cards)
  const dragXRef = useRef(0)
  const laggedDragXRef = useRef(0)
  const likeSequence01Ref = useRef(0)
  const nopeSequence01Ref = useRef(0)
  const dragVxRef = useRef(0)
  const stampFinishActiveRef = useRef(false)
  const stampFinishRafRef = useRef<number | null>(null)
  const lagRafRef = useRef<number | null>(null)
  const lagLastTsRef = useRef<number | null>(null)
  /** First-load yes/nope teaser — cancelled the moment the user takes over. */
  const hintActiveRef = useRef(false)
  const hintCancelledRef = useRef(false)
  const hintRafRef = useRef<number | null>(null)
  const hintTimerRefs = useRef<number[]>([])
  const hintGenRef = useRef(0)

  useEffect(() => {
    cardsRef.current = cards
  }, [cards])

  useEffect(() => {
    dragXRef.current = dragX
  }, [dragX])

  const stopStampFinishTween = useCallback(() => {
    stampFinishActiveRef.current = false
    if (stampFinishRafRef.current != null) {
      window.cancelAnimationFrame(stampFinishRafRef.current)
      stampFinishRafRef.current = null
    }
  }, [])

  const setLikeSequence = useCallback((value: number) => {
    const next = clamp(value, 0, 1)
    likeSequence01Ref.current = next
    setLikeSequence01((prev) => (Math.abs(prev - next) < 0.0008 ? prev : next))
  }, [])

  const setNopeSequence = useCallback((value: number) => {
    const next = clamp(value, 0, 1)
    nopeSequence01Ref.current = next
    setNopeSequence01((prev) => (Math.abs(prev - next) < 0.0008 ? prev : next))
  }, [])

  // Continuous exponential lag + LIKE/NOPE playhead rate limits.
  useEffect(() => {
    let alive = true

    const tick = (ts: number) => {
      if (!alive) return

      const last = lagLastTsRef.current ?? ts
      lagLastTsRef.current = ts
      const dt = Math.min(48, Math.max(0, ts - last))

      const target = dragXRef.current
      const current = laggedDragXRef.current
      // Side lag from the finger direction (or last finish side if centered).
      const activeSide =
        target > 0.5
          ? feedback.like
          : target < -0.5
            ? feedback.nope
            : current >= 0
              ? feedback.like
              : feedback.nope
      const lagMs = Math.max(0, activeSide.dragLagMs || 0)

      // dragLagMs 0 = glued to finger (no trail).
      let value = target
      if (lagMs > 0) {
        const tau = Math.max(1, lagMs)
        const alpha = 1 - Math.exp(-dt / tau)
        const next = current + (target - current) * alpha
        const settled = Math.abs(target - next) < 0.12
        value = settled ? target : next
      }

      laggedDragXRef.current = value

      // Sequence chase (skipped during post-commit tween).
      // Finger only drives 0→75%; reserved 75→100% plays on swipe-away.
      if (!stampFinishActiveRef.current) {
        const rate = velocityToStampPlayheadRate(dragVxRef.current)
        const maxStep = rate * (dt / 1000)
        const thresh = swipeThresholdPx()

        const fingerLike = clamp(value / thresh, 0, 1)
        const targetLike = fingerDragToStampSequence(fingerLike)
        const currentLike = likeSequence01Ref.current

        if (targetLike <= currentLike + 1e-6) {
          if (Math.abs(targetLike - currentLike) > 0.0008) {
            setLikeSequence(targetLike)
          }
        } else {
          const nextLike = Math.min(
            targetLike,
            STAMP_DRAG_SEQUENCE_MAX,
            currentLike + maxStep,
          )
          setLikeSequence(nextLike)
        }

        const fingerNope = clamp(-value / thresh, 0, 1)
        const targetNope = fingerDragToStampSequence(fingerNope)
        const currentNope = nopeSequence01Ref.current

        if (targetNope <= currentNope + 1e-6) {
          // Free retreat so cancel/settle doesn't feel sticky.
          if (Math.abs(targetNope - currentNope) > 0.0008) {
            setNopeSequence(targetNope)
          }
        } else {
          const nextNope = Math.min(
            targetNope,
            STAMP_DRAG_SEQUENCE_MAX,
            currentNope + maxStep,
          )
          setNopeSequence(nextNope)
        }
      }

      lagRafRef.current = window.requestAnimationFrame(tick)
    }

    lagLastTsRef.current = null
    lagRafRef.current = window.requestAnimationFrame(tick)

    return () => {
      alive = false
      if (lagRafRef.current != null) window.cancelAnimationFrame(lagRafRef.current)
      lagRafRef.current = null
      lagLastTsRef.current = null
    }
  }, [feedback.like, feedback.nope, setLikeSequence, setNopeSequence])

  // Active deck (already excludes a card once commit slices it).
  const mounted = useMemo(() => cards.slice(0, MOUNTED_STACK), [cards])
  /**
   * Keep the departing card in the SAME list slot/key position through fly-away.
   * Moving it to a sibling branch remounts <video> and flashes opacity on commit.
   */
  const displayCards = useMemo(() => {
    if (!leaving) return mounted
    return [leaving.card, ...mounted].slice(0, MOUNTED_STACK + 1)
  }, [leaving, mounted])
  // Live deck head — stays interactive even while a previous card is flying away.
  const interactiveFront = mounted[0] ?? null

  // Hero idle tilt alternates each promote: first +6°, next -6°, then +6°…
  // Behind cards stay flat; only depth-0 stack pose uses this value.
  const [heroRestRot, setHeroRestRot] = useState(SWIPE_REST_ROTATION)
  // Capture at commit before flipping so leave flight keeps the outgoing angle.
  const heroRestRotRef = useRef(heroRestRot)
  heroRestRotRef.current = heroRestRot

  // Drag rot is delta on top of stack pose rest tilt (depth-0 = heroRestRot).
  // Rest/cancel → 0 so total = rest tilt; active drag subtracts rest so grab un-tilts
  // into the finger-linked rotation without double-counting.
  const [{ x, y, rot, scale }, dragApi] = useSpring(() => ({
    x: 0,
    y: 0,
    rot: 0,
    scale: 1,
    config: settle,
  }))

  // Leave flight is a separate layer so the stack never inherits fly offsets.
  // Filter (brightness/saturate) is derived from lx in StackSlot — same mapping
  // as drag.x — so commit does not hand off to a second spring pair mid-frame.
  const [{ lx, ly, lrot, lscale, lopacity }, leaveApi] = useSpring(() => ({
    lx: 0,
    ly: 0,
    lrot: 0,
    lscale: 1,
    lopacity: 1,
    config: flyAway,
  }))

  useEffect(() => {
    setCards(initialCards)
    setLeaving(null)
    setHeroRestRot(SWIPE_REST_ROTATION)
    setDragX(0)
    dragXRef.current = 0
    laggedDragXRef.current = 0
    stopStampFinishTween()
    setLikeSequence(0)
    setNopeSequence(0)
    setStampExiting(false)
    dragVxRef.current = 0
    setBusy(false)
    setStampFinish(null)
    busyRef.current = false
    void dragApi.start({ x: 0, y: 0, rot: 0, scale: 1, immediate: true })
    void leaveApi.start({
      lx: 0,
      ly: 0,
      lrot: 0,
      lscale: 1,
      lopacity: 1,
      immediate: true,
    })
  }, [
    initialCards,
    dragApi,
    leaveApi,
    setLikeSequence,
    setNopeSequence,
    stopStampFinishTween,
  ])

  const clearStampFinish = useCallback(() => {
    stopStampFinishTween()
    setStampFinish(null)
    setStampExiting(false)
    setLikeSequence(0)
    setNopeSequence(0)
    dragVxRef.current = 0
  }, [setLikeSequence, setNopeSequence, stopStampFinishTween])

  // Raw drag drives visibility; rate-limited sequence drives pose/lottie.
  const thresholdPx = swipeThresholdPx()
  const likeDrag01Raw = clamp(dragX / thresholdPx, 0, 1)
  const nopeDrag01Raw = clamp(-dragX / thresholdPx, 0, 1)
  const likeDrag01 = likeSequence01
  const nopeDrag01 = nopeSequence01

  const likeProgress =
    stampFinish?.type === 'like'
      ? mapDragToLottie(likeSequence01, feedback.like)
      : mapDragToLottie(likeDrag01, feedback.like)
  const nopeProgress =
    stampFinish?.type === 'nope'
      ? mapDragToLottie(nopeSequence01, feedback.nope)
      : mapDragToLottie(nopeDrag01, feedback.nope)

  const likeTransform =
    stampFinish?.type === 'like'
      ? mapDragToTransform(likeSequence01, feedback.like)
      : mapDragToTransform(likeDrag01, feedback.like)
  const nopeTransform =
    stampFinish?.type === 'nope'
      ? mapDragToTransform(nopeSequence01, feedback.nope)
      : mapDragToTransform(nopeDrag01, feedback.nope)

  const likeMode =
    stampFinish?.type === 'like'
      ? 'finish'
      : likeDrag01Raw > 0.01 || likeSequence01 > 0.01 || likeDrag01 > 0.01
        ? 'scrub'
        : 'hidden'
  const nopeMode =
    stampFinish?.type === 'nope'
      ? 'finish'
      : nopeDrag01Raw > 0.01 || nopeSequence01 > 0.01 || nopeDrag01 > 0.01
        ? 'scrub'
        : 'hidden'

  const resetDrag = useCallback(() => {
    setDragX(0)
    dragVxRef.current = 0
    void dragApi.start({
      x: 0,
      y: 0,
      rot: 0,
      scale: 1,
      config: settle,
    })
  }, [dragApi])

  const clearHintTimers = useCallback(() => {
    if (hintRafRef.current != null) {
      window.cancelAnimationFrame(hintRafRef.current)
      hintRafRef.current = null
    }
    for (const id of hintTimerRefs.current) {
      window.clearTimeout(id)
    }
    hintTimerRefs.current = []
  }, [])

  const applyHintDrag = useCallback(
    (mx: number) => {
      const clamped = clampDragX(mx)
      setDragX(clamped)
      dragXRef.current = clamped
      // Keep lag + playhead glued so the teaser feels intentional, not delayed.
      laggedDragXRef.current = clamped
      dragVxRef.current = 0
      if (clamped > 0.5) {
        setLikeSequence(fingerDragToStampSequence(clamped / swipeThresholdPx()))
        setNopeSequence(0)
      } else if (clamped < -0.5) {
        setNopeSequence(fingerDragToStampSequence(-clamped / swipeThresholdPx()))
        setLikeSequence(0)
      } else {
        setLikeSequence(0)
        setNopeSequence(0)
      }
      void dragApi.start({
        x: clamped,
        y: 0,
        rot: dragRotForX(clamped, heroRestRotRef.current),
        scale: dragScaleForX(clamped),
        immediate: true,
      })
    },
    [dragApi, setLikeSequence, setNopeSequence],
  )

  /**
   * Abort the first-load teaser so real input owns the card immediately.
   * Optionally settle back to rest (user pointer-down) or leave pose as-is
   * (drag already driving springs).
   */
  const cancelSwipeHint = useCallback(
    (options?: { settle?: boolean }) => {
      if (!hintActiveRef.current && !hintCancelledRef.current) {
        // Still waiting on the delayed start — mark cancelled so it never begins.
        if (hintTimerRefs.current.length > 0 || hintRafRef.current != null) {
          hintCancelledRef.current = true
          clearHintTimers()
          markSwipeHintSeen()
          setHintPlaying(false)
        }
        return
      }

      hintCancelledRef.current = true
      hintActiveRef.current = false
      hintGenRef.current += 1
      clearHintTimers()
      markSwipeHintSeen()
      setHintPlaying(false)

      if (options?.settle !== false) {
        setDragX(0)
        dragXRef.current = 0
        laggedDragXRef.current = 0
        dragVxRef.current = 0
        setLikeSequence(0)
        setNopeSequence(0)
        void dragApi.start({
          x: 0,
          y: 0,
          rot: 0,
          scale: 1,
          config: settle,
        })
      }
    },
    [clearHintTimers, dragApi, setLikeSequence, setNopeSequence],
  )

  const animateHintTo = useCallback(
    (
      toX: number,
      durationMs: number,
      gen: number,
      ease: (t: number) => number = easeInOutCubic,
    ) =>
      new Promise<void>((resolve) => {
        if (hintCancelledRef.current || hintGenRef.current !== gen) {
          resolve()
          return
        }

        const fromX = dragXRef.current
        const t0 = performance.now()

        const tick = (now: number) => {
          if (hintCancelledRef.current || hintGenRef.current !== gen) {
            resolve()
            return
          }

          const u = durationMs <= 0 ? 1 : Math.min(1, (now - t0) / durationMs)
          const next = fromX + (toX - fromX) * ease(u)
          applyHintDrag(next)

          if (u >= 1) {
            hintRafRef.current = null
            resolve()
            return
          }

          hintRafRef.current = window.requestAnimationFrame(tick)
        }

        hintRafRef.current = window.requestAnimationFrame(tick)
      }),
    [applyHintDrag],
  )

  const waitHint = useCallback((ms: number, gen: number) => {
    return new Promise<void>((resolve) => {
      if (hintCancelledRef.current || hintGenRef.current !== gen) {
        resolve()
        return
      }
      const id = window.setTimeout(() => {
        hintTimerRefs.current = hintTimerRefs.current.filter((t) => t !== id)
        resolve()
      }, ms)
      hintTimerRefs.current.push(id)
    })
  }, [])

  // First paint teaser: gentle ~1/3 swipe right (YES), then left (NOPE).
  // Any real pointer/keyboard interaction cancels immediately.
  useEffect(() => {
    if (!playSwipeHint) return
    if (hasSeenSwipeHint() || prefersReducedMotion()) return
    if (cardsRef.current.length === 0) return

    const gen = ++hintGenRef.current
    hintCancelledRef.current = false

    const run = async () => {
      await waitHint(SWIPE_HINT_START_DELAY_MS, gen)
      if (hintCancelledRef.current || hintGenRef.current !== gen) return
      if (!cardsRef.current[0] || busyRef.current) return

      hintActiveRef.current = true
      setHintPlaying(true)
      markSwipeHintSeen()

      const likePeak = swipeThresholdPx() * SWIPE_HINT_LIKE_FRACTION
      const nopePeak = swipeThresholdPx() * SWIPE_HINT_NOPE_FRACTION

      // Continuous arc: YES peek → straight across to a deeper NOPE → soft settle.
      // No center stop between sides so it reads as one smooth demo gesture.
      await animateHintTo(likePeak, SWIPE_HINT_MOVE_MS, gen)
      await waitHint(SWIPE_HINT_HOLD_MS, gen)
      await animateHintTo(-nopePeak, SWIPE_HINT_MOVE_MS * 1.45, gen, easeInOutCubic)
      await waitHint(SWIPE_HINT_HOLD_MS, gen)
      await animateHintTo(0, SWIPE_HINT_RETURN_MS, gen, easeOutQuart)

      if (hintCancelledRef.current || hintGenRef.current !== gen) return
      hintActiveRef.current = false
      setHintPlaying(false)
      setDragX(0)
      dragXRef.current = 0
      laggedDragXRef.current = 0
      dragVxRef.current = 0
      setLikeSequence(0)
      setNopeSequence(0)
      void dragApi.start({
        x: 0,
        y: 0,
        rot: 0,
        scale: 1,
        config: settle,
      })
    }

    void run()

    return () => {
      hintGenRef.current += 1
      hintActiveRef.current = false
      setHintPlaying(false)
      clearHintTimers()
      // Don't force-settle on unmount — page may be tearing down.
    }
  }, [
    animateHintTo,
    clearHintTimers,
    dragApi,
    playSwipeHint,
    setLikeSequence,
    setNopeSequence,
    waitHint,
  ])

  const startStampFinishTween = useCallback(
    (
      side: 'like' | 'nope',
      fromDrag01: number,
      sequenceMs: number,
      onDone: () => void,
    ) => {
      stopStampFinishTween()
      stampFinishActiveRef.current = true
      const start = clamp(fromDrag01, 0, 1)
      const setSequence = side === 'like' ? setLikeSequence : setNopeSequence

      if (sequenceMs <= 0 || start >= 0.995) {
        setSequence(1)
        stampFinishActiveRef.current = false
        onDone()
        return
      }

      const t0 = performance.now()

      const tick = (now: number) => {
        if (!stampFinishActiveRef.current) return
        const u = clamp((now - t0) / sequenceMs, 0, 1)
        const eased = easeOutCubic(u)
        const next = start + (1 - start) * eased
        setSequence(next)

        if (u >= 1) {
          stampFinishActiveRef.current = false
          stampFinishRafRef.current = null
          setSequence(1)
          onDone()
          return
        }

        stampFinishRafRef.current = window.requestAnimationFrame(tick)
      }

      stampFinishRafRef.current = window.requestAnimationFrame(tick)
    },
    [setLikeSequence, setNopeSequence, stopStampFinishTween],
  )

  const commitSwipe = useCallback(
    async (
      direction: 'left' | 'right',
      vxAbs = 0,
      options?: {
        flyConfig?: FlyConfig
        /** Keyboard / fast mobile: unlock immediately; leave/stamp finish never block. */
        nonBlocking?: boolean
      },
    ) => {
      const active = interactiveFront
      // Mobile fast flicks skip the leave lock so users can spam through cards.
      const nonBlocking =
        Boolean(options?.nonBlocking) || shouldUnlockEarlyOnMobile(vxAbs)
      // Blocking finger path still waits out leave. Non-blocking only needs a free head.
      if (!active || busyRef.current) return
      if (!nonBlocking && leaving) return

      busyRef.current = true
      setBusy(true)

      const dir: 1 | -1 = direction === 'right' ? 1 : -1
      // Short exit: clamp + 5vw, not all the way off the viewport edge.
      const flyX = dir * leaveFlyDistancePx(direction)
      const leaveConfig = options?.flyConfig ?? leaveFlyConfigForVelocity(vxAbs)

      const fromX = x.get()
      // Leave replaces stack+drag — seed full on-screen pose (hero sink + drag y).
      const fromY = y.get() + swipeHeroRestYPx()
      // Leave owns the full visual pose (current hero rest tilt + drag delta).
      // Read before flipping heroRestRot for the incoming card.
      const restAtCommit = heroRestRotRef.current
      const fromRot = rot.get() + restAtCommit
      const fromScale = scale.get()

      leaveGenRef.current += 1
      const leaveGen = leaveGenRef.current

      // Seed leave springs at the exact on-screen pose. Filter continues from lx
      // with the same brightness/saturate mapping as drag.x (no spring handoff).
      void leaveApi.start({
        lx: fromX,
        ly: fromY,
        lrot: fromRot,
        lscale: fromScale,
        lopacity: 1,
        immediate: true,
      })

      // Capture side-mapped sequence progress from what the user currently sees.
      const side = direction === 'right' ? 'like' : 'nope'
      const seqAtCommit =
        side === 'like' ? likeSequence01Ref.current : nopeSequence01Ref.current
      // Exact release pose — do not bump playhead via finishMin/finishMax.
      const pose = mapDragToTransform(seqAtCommit, feedback[side])
      const releaseProgress = mapDragToLottie(seqAtCommit, feedback[side])

      finishKeyRef.current += 1
      const finishKey = finishKeyRef.current

      // Drag tops out at 75%; swipe-away always finishes 75→100 (or whatever remains).
      // LIKE uses the same timing/position model as NOPE — only like.lottie differs.
      const releaseSeq = Math.min(seqAtCommit, STAMP_DRAG_SEQUENCE_MAX)
      const { sequenceMs, fallMs } = velocityToStampFinishMs(vxAbs, releaseSeq)
      setStampExiting(false)
      if (side === 'like') {
        setNopeSequence(0)
      } else {
        setLikeSequence(0)
      }
      setStampFinish({
        type: side,
        key: finishKey,
        from: releaseProgress,
        transformY: pose.y,
        transformRot: pose.rot,
        transformScale: pose.scale,
        transformOpacity: pose.opacity,
        transformBlur: pose.blur,
        fallMs,
      })
      // Auto-play reserved tail (and any unreached drag portion), then CSS exit.
      startStampFinishTween(side, releaseSeq, sequenceMs, () => {
        setStampExiting(true)
      })

      // Mark leave + promote in one render. displayCards keeps this card keyed
      // while the next deck head can already accept another keyboard commit.
      setLeaving({ card: active, dir, gen: leaveGen })
      onSwipe?.(active, dir)
      setCards((prev) => prev.slice(1))
      // Next hero idles the opposite way (+6 → -6 → +6…).
      setHeroRestRot((prev) => -prev)

      // Drop finger springs only after leave owns transform/filter.
      setDragX(0)
      dragXRef.current = 0
      laggedDragXRef.current = 0
      dragVxRef.current = 0
      void dragApi.start({
        x: 0,
        y: 0,
        rot: 0,
        scale: 1,
        immediate: true,
      })

      // One frame for leave handoff composite.
      await wait(32)

      if (nonBlocking) {
        // Keyboard: free the next arrow immediately. Leave + stamp finish async.
        busyRef.current = false
        setBusy(false)

        void (async () => {
          await Promise.all(
            leaveApi.start({
              lx: flyX,
              ly: fromY + dir * 14,
              lrot: fromRot + dir * 12,
              lscale: fromScale * 1.04,
              lopacity: 0,
              config: leaveConfig,
            }),
          )

          if (leaveGenRef.current !== leaveGen) return

          setLeaving(null)
          void leaveApi.start({
            lx: 0,
            ly: 0,
            lrot: 0,
            lscale: 1,
            lopacity: 1,
            immediate: true,
          })

          if (cardsRef.current.length === 0) onEmpty?.()
        })()
        return
      }

      // Finger drag: wait out leave flight before unlocking (original feel).
      await Promise.all(
        leaveApi.start({
          lx: flyX,
          ly: fromY + dir * 14,
          lrot: fromRot + dir * 12,
          lscale: fromScale * 1.04,
          lopacity: 0,
          // Keep lx past threshold on NOPE so desat/dim stay latched while fading.
          config: leaveConfig,
        }),
      )

      if (leaveGenRef.current === leaveGen) {
        setLeaving(null)
        void leaveApi.start({
          lx: 0,
          ly: 0,
          lrot: 0,
          lscale: 1,
          lopacity: 1,
          immediate: true,
        })
      }

      if (cardsRef.current.length === 0) onEmpty?.()

      await wait(160)
      busyRef.current = false
      setBusy(false)
    },
    [
      dragApi,
      feedback,
      interactiveFront,
      leaveApi,
      leaving,
      onEmpty,
      onSwipe,
      rot,
      scale,
      setLikeSequence,
      setNopeSequence,
      startStampFinishTween,
      x,
      y,
    ],
  )

  // Desktop: ←/↓ = NOPE, →/↑ = LIKE. Ignore while typing.
  // Does NOT wait on leave/stamp finish — arrows can chain through the deck.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typeof window !== 'undefined' && window.innerWidth < SWIPE_DESKTOP_MIN_WIDTH) {
        return
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (event.repeat) return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }

      let direction: 'left' | 'right' | null = null
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = 'right'
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = 'left'
      if (!direction) return

      // Use live deck head — not `front`, which is null while a flyer is leaving.
      // Only a brief keyboard handoff latches busyRef (~32ms).
      if (!interactiveFront || busyRef.current) return

      event.preventDefault()

      // Real input always wins over the first-load teaser.
      cancelSwipeHint({ settle: false })

      // Drop any leftover stamp so the new key owns feedback immediately.
      if (stampFinishActiveRef.current) {
        stopStampFinishTween()
        setStampFinish(null)
        setStampExiting(false)
      }

      // Seed a decisive flick pose so leave flight starts near the edge.
      const dir = direction === 'right' ? 1 : -1
      const kickX = clampDragX(dir * swipeThresholdPx() * 1.15)
      // High synthetic velocity → shorter stamp finish + snappier keyboard leave.
      const keyVx = 1.55
      setDragX(kickX)
      dragXRef.current = kickX
      laggedDragXRef.current = kickX
      dragVxRef.current = keyVx
      if (direction === 'right') {
        setLikeSequence(STAMP_DRAG_SEQUENCE_MAX * 0.72)
        setNopeSequence(0)
      } else {
        setNopeSequence(STAMP_DRAG_SEQUENCE_MAX * 0.72)
        setLikeSequence(0)
      }
      void dragApi.start({
        x: kickX,
        y: 0,
        rot: dragRotForX(kickX, heroRestRotRef.current),
        scale: 1.03,
        immediate: true,
      })

      // Full-side glow pulse — kickX is wiped by commit before React paints,
      // and desktop left clamp never reaches threshold intensity on its own.
      if (keyboardGlowTimerRef.current != null) {
        window.clearTimeout(keyboardGlowTimerRef.current)
        keyboardGlowTimerRef.current = null
      }
      publishCircleLive(
        direction === 'right' ? 1 : 0,
        direction === 'left' ? 1 : 0,
      )
      keyboardGlowTimerRef.current = window.setTimeout(() => {
        keyboardGlowTimerRef.current = null
        publishCircleLive(0, 0)
      }, 160)

      void commitSwipe(direction, keyVx, {
        flyConfig: flyAwayKeyboard,
        nonBlocking: true,
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    cancelSwipeHint,
    commitSwipe,
    dragApi,
    interactiveFront,
    publishCircleLive,
    setLikeSequence,
    setNopeSequence,
    stopStampFinishTween,
  ])

  const bind = useDrag(
    ({
      active,
      first,
      movement: [mx, my],
      velocity: [vx, vy],
      cancel,
    }) => {
      // Use live deck head so mobile fast flicks can chain while a flyer is leaving.
      // Only busy blocks input (cleared early on fast mobile / keyboard).
      if (!interactiveFront || busyRef.current) {
        cancel?.()
        return
      }

      // Any real touch/drag immediately owns the card and aborts the teaser.
      // Don't settle — the user's movement takes over from the current pose.
      if (first || hintActiveRef.current) {
        cancelSwipeHint({ settle: false })
      }

      // Up→YES / down→NOPE project onto the same signed axis as left/right.
      // Down is capped at ~5dvh on desktop; progress remaps into left NOPE space.
      const projected = projectDragIntent(mx, my)
      const clampedIntent = projected.intent
      const intentV = intentVelocity(mx, my, vx, vy)
      dragVxRef.current = Math.abs(intentV)

      if (active) {
        setDragX(clampedIntent)
        void dragApi.start({
          // Intent drives X so vertical swipes still tilt/glow like left/right.
          x: clampedIntent,
          y: projected.visualY,
          // Subtract current hero rest so total (stack + drag) matches finger rotation
          // and the first frame eases from idle ±rest into the drag timeline start.
          // NOPE adds SWIPE_NOPE_EXTRA_ROTATION at full left progress.
          rot: dragRotForX(clampedIntent, heroRestRotRef.current),
          // Mobile NOPE: shrink with dim/desat progress; YES keeps the press lift.
          scale: dragScaleForX(clampedIntent),
          config: dragFollow,
        })
        return
      }

      // Distance: px threshold OR ~90% of the active side clamp (desktop left/down).
      const shouldCommit =
        shouldCommitByDistance(projected.progressT, Math.abs(clampedIntent)) ||
        (Math.abs(intentV) > swipeFlickVelocity() &&
          Math.abs(clampedIntent) > swipeFlickMinPx())

      if (shouldCommit) {
        const finalDir: 'left' | 'right' =
          clampedIntent === 0
            ? intentV >= 0
              ? 'right'
              : 'left'
            : projected.direction
        void commitSwipe(finalDir, Math.abs(intentV))
        return
      }

      resetDrag()
    },
    {
      filterTaps: true,
      pointer: { touch: true },
      from: () => [x.get(), y.get()],
      enabled: Boolean(interactiveFront) && !busy,
    },
  )

  const burst = (
    <div
      className={`swipe-deck__burst${stampFinish ? ' is-finishing' : ''}`}
      aria-hidden="true"
    >
      <SwipeStamp
        type="like"
        progress={likeProgress}
        transform={likeTransform}
        mode={likeMode}
        finishKey={stampFinish?.type === 'like' ? stampFinish.key : 0}
        falling={stampFinish?.type === 'like' ? stampExiting : true}
        finishMs={stampFinish?.type === 'like' ? stampFinish.fallMs : undefined}
        onComplete={stampFinish?.type === 'like' ? clearStampFinish : undefined}
      />
      <SwipeStamp
        type="nope"
        progress={nopeProgress}
        transform={nopeTransform}
        mode={nopeMode}
        finishKey={stampFinish?.type === 'nope' ? stampFinish.key : 0}
        falling={stampFinish?.type === 'nope' ? stampExiting : true}
        finishMs={stampFinish?.type === 'nope' ? stampFinish.fallMs : undefined}
        onComplete={stampFinish?.type === 'nope' ? clearStampFinish : undefined}
      />
    </div>
  )

  // Gray lips behind the 2nd card: remaining−1, capped at 4.
  // 5+ → 4, 4 → 3, 3 → 2, 2 → 1, 1 → 0.
  // Drive off live deck size so the rearmost lip starts its Time Machine
  // dissolve on commit (spring fade), not after leave flight ends.
  const stackBackCount = Math.max(
    0,
    Math.min(STACK_BACK_VISIBLE, cards.length - 1),
  )

  // Empty card: inverse of lip dissolve (fade + scale up) on the same spring.
  // Starts on last-card commit (cards.length === 0), while flyer may still leave.
  const deckEmpty = cards.length === 0
  const emptyStyle = useSpring({
    opacity: deckEmpty ? 1 : 0,
    scale: deckEmpty ? 1 : STACK_DISSOLVE_SCALE,
    config: STACK_DISSOLVE_SPRING,
    immediate: false,
  })

  // Page-level glow follows live finger only — drops on commit so it fades
  // out before the promoted card finishes its bounce-up.
  // Skip while a keyboard pulse owns the circle (same-tick drag zero would
  // otherwise wipe the peak before paint).
  const circleLike01 = likeDrag01Raw
  const circleNope01 = nopeDrag01Raw

  useEffect(() => {
    if (keyboardGlowTimerRef.current != null) return
    publishCircleLive(circleLike01, circleNope01)
  }, [circleLike01, circleNope01, publishCircleLive])

  // Clear glow if this deck unmounts (reset / leave page).
  useEffect(() => {
    return () => {
      if (keyboardGlowTimerRef.current != null) {
        window.clearTimeout(keyboardGlowTimerRef.current)
        keyboardGlowTimerRef.current = null
      }
      publishCircleLive(0, 0)
    }
  }, [publishCircleLive])

  return (
    <div className="swipe-deck-root">
    <div
      className={`swipe-deck${busy ? ' is-busy' : ''}${hintPlaying ? ' is-hinting' : ''}`}
    >
      {/*
        z=0 — always under every real slot (slots use z ≥ 1).
        Same-z paint fights with depth-2/3 cards were flashing the gray pack.
      */}
      <StackBacks visibleCount={stackBackCount} zIndex={0} />
      {/*
        Empty interstitial only when the caller wants CTAs (onContinue / onRestart).
        When onEmpty is provided, skip this screen and let the parent advance.
      */}
      {!onEmpty ? (
      <animated.div
        className="swipe-deck swipe-deck--empty"
        style={{
          opacity: emptyStyle.opacity,
          transform: emptyStyle.scale.to(
            (s) => `translate3d(0, 0, 0) scale3d(${s}, ${s}, 1)`,
          ),
          // Keep offscreen empty from intercepting hit-tests while hidden.
          pointerEvents: deckEmpty ? 'auto' : 'none',
          visibility: deckEmpty || displayCards.length === 0 ? 'visible' : 'hidden',
          zIndex: 0,
        }}
        aria-hidden={deckEmpty ? undefined : true}
      >
        <p className="swipe-deck__empty-title">No more cards</p>
        <p className="swipe-deck__empty-sub">You’ve gone through the stack.</p>
        <div className="swipe-deck__empty-actions">
          {onContinue ? (
            <button
              type="button"
              className="swipe-deck__start-again swipe-deck__continue"
              onClick={onContinue}
              disabled={!deckEmpty}
            >
              {continueLabel}
            </button>
          ) : null}
          {onRestart ? (
            <button
              type="button"
              className={`swipe-deck__start-again${onContinue ? ' swipe-deck__start-again--secondary' : ''}`}
              onClick={onRestart}
              disabled={!deckEmpty}
            >
              {restartLabel}
            </button>
          ) : null}
        </div>
      </animated.div>
      ) : null}
      {displayCards
        .map((card, index) => {
          const isLeaving = leaving?.card.id === card.id
          // Live deck head stays interactive even while a flyer is leaving
          // (mobile fast flicks / keyboard chain). Flyer keeps display index 0.
          const stackIndex = isLeaving ? 0 : leaving ? index - 1 : index
          const isFront = !isLeaving && stackIndex === 0 && interactiveFront?.id === card.id
          // Depth 3+ stays mounted for preload but sits fully covered.
          const depth = isLeaving ? 0 : Math.min(stackIndex, VISIBLE_STACK)
          // +1 so the deepest mounted slot stays above StackBacks (z=0).
          const z = isLeaving
            ? VISIBLE_STACK + 30
            : VISIBLE_STACK - stackIndex + 1 + (isFront ? 5 : 0)
          // Lift shadows:
          // - flyer follows leave.x through the exit
          // - live stack always follows finger x (0 while idle / after commit)
          // Never feed leave.x to under-cards — past-threshold lx made the pack
          // carry a full directional drop-shadow, then snap off when leave cleared.
          const tiltX = isLeaving ? lx : stackIndex <= 2 ? x : undefined
          // Second-card brighten follows LIVE finger X only (never leave.x).
          // On commit finger X resets to 0, so the new second stays at rest dim
          // and fades via its brightness spring — no full-bright→0.62 snap.
          const brightenX = stackIndex === 1 ? x : undefined

          return (
            <StackSlot
              key={card.id}
              card={card}
              depth={depth}
              isFront={isFront}
              // Only depth 0 uses this; behind cards stay flat until promote.
              restRot={heroRestRot}
              // Mount ≤2 decoders (front + warm next). Only the live front and a
              // leaving flyer actually play — avoids iOS dual-autoplay first-land fails.
              // When leave flight ends the flyer unmounts and SwipeCard hard-releases
              // its decoder (src cleared + load) so swiped clips don't keep iOS buffers.
              mountVideo={
                isLeaving ||
                (stackIndex >= 0 &&
                  stackIndex <
                    (leaving ? MAX_MOUNTED_VIDEOS - 1 : MAX_MOUNTED_VIDEOS))
              }
              playing={isLeaving || isFront}
              drag={isFront ? { x, y, rot, scale } : undefined}
              leave={
                isLeaving
                  ? {
                      x: lx,
                      y: ly,
                      rot: lrot,
                      scale: lscale,
                      opacity: lopacity,
                    }
                  : undefined
              }
              tiltX={tiltX}
              brightenX={brightenX}
              bind={isFront ? () => bind() : undefined}
              zIndex={z}
            />
          )
        })
        .reverse()}

    </div>
    {/*
      Stage-level feedback layer (fills home__stage via .swipe-deck-root)
      so dislike can start at the stage top-center, not card-local coords.
    */}
    {burst}
    </div>
  )
}
