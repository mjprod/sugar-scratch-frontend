/**
 * Matches `.coverflow__item` / --card-width in prototype.css.
 * Aspect 251:475 (width/height ≈ 0.528).
 */
export const CARD_WIDTH = 251
/** Horizontal gap between cards in the flat slide row. */
export const CARD_GAP = 28
/** Distance between adjacent card left edges. */
export const CARD_STEP = CARD_WIDTH + CARD_GAP
/** Design aspect ratio: width / height. */
export const CARD_ASPECT = 251 / 475

/** Live layout sizes (desktop defaults; mobile overrides via CSS vars). */
export type LayoutMetrics = {
  cardWidth: number
  cardGap: number
  cardStep: number
}

export const DESKTOP_LAYOUT: LayoutMetrics = {
  cardWidth: CARD_WIDTH,
  cardGap: CARD_GAP,
  cardStep: CARD_STEP,
}

export function makeLayoutMetrics(
  cardWidth = CARD_WIDTH,
  cardGap = CARD_GAP
): LayoutMetrics {
  const width = Math.max(1, cardWidth)
  const gap = Math.max(0, cardGap)
  return {
    cardWidth: width,
    cardGap: gap,
    cardStep: width + gap,
  }
}

/** Hard cap: max cards mounted/loaded in the stage at once. */
export const MAX_CARDS_LOADED = 20
/** Desktop uses the full load window. */
export const DESKTOP_MAX_VISIBLE = MAX_CARDS_LOADED
/**
 * Mobile / coarse pointer: keep a lighter window than desktop, but wide enough
 * that fast right-scrubs still mount end-of-deck cards (Gym/Firefighter) before
 * they hit the hero slot. 5 was too tight — cards arrived blank mid-scrub.
 */
export const MOBILE_MAX_VISIBLE = 9

/**
 * Cover-flow settle spring for card-to-card moves.
 * Middle ground: quicker than the soft ease, still less bouncy than 120/16.
 */
export const SPRING_STIFFNESS = 95
export const SPRING_DAMPING = 20

export const CHEVRON_SIZE = 40
export const CHEVRON_GUTTER = 8

/** Wheel / swipe thresholds from sugar-scracth3dpack. */
export const WHEEL_DELTA_THRESHOLD = 12
/**
 * Horizontal mouse/trackpad wheel ticks are usually much smaller than vertical.
 * Scale |deltaX| so side-scroll accelerates as aggressively as vertical scroll.
 */
export const WHEEL_HORIZONTAL_GAIN = 1.85
/** Base cooldown between wheel steps when scrolling slowly. */
export const WHEEL_LOCK_MS = 220
/** Fastest cooldown when the user is scrolling hard / often. */
export const WHEEL_LOCK_MS_FAST = 55
/** Recent wheel events window used to estimate scroll intensity. */
export const WHEEL_BURST_WINDOW_MS = 280
/** Accumulated |delta| in the burst window that counts as "full speed". */
export const WHEEL_BURST_DELTA_FULL = 420
/** Max cards advanced by a single intense wheel pulse. */
export const WHEEL_MAX_STEPS = 4
/**
 * After wheel scrolling stops, re-enable hover on the card under the pointer.
 * Slow scrolls settle sooner; intense bursts wait a bit longer for motion to calm.
 */
export const WHEEL_HOVER_SETTLE_MS_MIN = 40
export const WHEEL_HOVER_SETTLE_MS_MAX = 160
export const SWIPE_DISTANCE_PX = 50
export const TAP_MAX_MOVE_PX = 12
export const DRAG_AXIS_LOCK_RATIO = 1.15
/**
   * Mobile browse scrub gain: finger drag is multiplied so the row moves a bit
   * faster than 1:1. Desktop / fine-pointer stays 1.0.
   * Live tracking only — mobile release is hard-capped to ±1 card per swipe.
   */
  export const MOBILE_DRAG_GAIN = 1.0
  /** Peak finger speed (px/ms) treated as a full multi-card flick on mobile. */
  export const MOBILE_FLICK_SPEED_FULL = 2.45
  /**
   * Max cards advanced by a single hard mobile flick.
   * Stage swipes stay 1-card; multi-card jogging is the nav-dot scrub path.
   */
  export const MOBILE_FLICK_MAX_STEPS = 1
  /**
   * Rapid stage-swipe intensity window. More commits in this span → snappier
   * settle springs (still 1 card per swipe).
   */
  export const SWIPE_BURST_WINDOW_MS = 700
  /** How many stage pages in the burst window count as full intensity. */
  export const SWIPE_BURST_FULL_COUNT = 4
  /** Spring stiffness at full swipe burst (base is SPRING_STIFFNESS). */
  export const SPRING_STIFFNESS_FAST = 210
  /** Spring damping at full swipe burst (base is SPRING_DAMPING). */
  export const SPRING_DAMPING_FAST = 28

/** Chevron hold/hover timings from sugar-scracth3dpack (exact). */
export const CHEVRON_HOLD_INITIAL_MS = 180
export const CHEVRON_HOLD_REPEAT_MS = 90
export const CHEVRON_HOVER_HOLD_MS = 500

export type VisibilityLimits = {
  /** How many cards can sit left of focus (usually sliding off). */
  maxLeft: number
  /** How many cards show to the right of the focused card. */
  maxRight: number
}

/**
 * Focused card is the main hero; a few previous cards stay mounted to the
 * left (dimmed background), and the rest extend right. Finite — no wrap.
 * Total mounted window still hard-capped at MAX_CARDS_LOADED.
 */
export function getVisibilityLimits(maxVisible: number): VisibilityLimits {
  const safe = Math.min(
    MAX_CARDS_LOADED,
    Math.max(1, Math.floor(maxVisible))
  )
  // Keep up to 2 previous cards on the left as darkened background.
  const maxLeft = safe > 3 ? 2 : safe > 1 ? 1 : 0
  const maxRight = Math.max(0, safe - 1 - maxLeft)
  return { maxLeft, maxRight }
}

export const DESKTOP_VISIBILITY = getVisibilityLimits(DESKTOP_MAX_VISIBLE)
export const MOBILE_VISIBILITY = getVisibilityLimits(MOBILE_MAX_VISIBLE)

export type SlideTarget = {
  /** Horizontal offset from the left-anchored origin (px). */
  x: number
  scale: number
  opacity: number
  /** CSS brightness multiplier — left/background cards go dark, not invisible. */
  brightness: number
  zIndex: number
}

/**
 * Discrete focus pose (flat 2D analogue of getPackTarget).
 * offset 0 = focused, - = previous cards (left, dimmed), + = next (right).
 * `x` may be overridden by callers that use variable group gaps.
 *
 * On mobile only ~2 cards fit on screen, so the first card to the right of
 * the left hero is dimmed ~30% for depth until it becomes the focus.
 */
export function getSlideTarget(
  offset: number,
  limits: VisibilityLimits = DESKTOP_VISIBILITY,
  xOverride?: number
): SlideTarget {
  const absOffset = Math.abs(offset)
  const isMobileWindow = limits.maxRight <= MOBILE_VISIBILITY.maxRight
  const fadePerStep = limits.maxRight > 6 ? 0.02 : 0.08
  const offStageLeft = offset < -limits.maxLeft - 0.001
  const offStageRight = offset > limits.maxRight + 0.001
  const offStage = offStageLeft || offStageRight

  // Previous cards sit to the left with the same soft treatment as unhovered cards.
  let brightness = 1
  let opacity = 1
  let scale = 1

  if (offStage) {
    opacity = 0
    brightness = 0.25
    scale = 0.9
  } else if (offset < 0) {
    // Match hover "unhovered" dim: bright 0.88 / fade 0.92.
    brightness = 0.88
    opacity = 0.92
    scale = Math.max(0.96, 0.99 + offset * 0.01)
  } else if (offset > 0) {
    if (isMobileWindow) {
      // Depth cue for the 2-card mobile view: next card ~40% dimmer.
      // Interpolates through fractional offsets while scrubbing so the
      // dim lifts as that card slides into the left hero slot.
      const t = Math.min(1, absOffset)
      brightness = 1 - 0.4 * t
      opacity = 1 - 0.16 * t
      scale = 1 - 0.04 * t
    } else {
      brightness = Math.max(0.7, 1 - absOffset * 0.03)
      opacity = Math.max(1 - absOffset * fadePerStep, 0.55)
      scale = Math.max(0.92, 1 - absOffset * 0.01)
    }
  }

  return {
    // Same structural idea as 3dpack: x = offset * spacing
    x: typeof xOverride === 'number' ? xOverride : offset * CARD_STEP,
    scale,
    opacity,
    brightness,
    zIndex: Math.round(200 - absOffset * 10),
  }
}

/** @deprecated Prefer getSlideTarget. */
export const getSlideTransform = getSlideTarget
/** @deprecated Prefer getSlideTarget. */
export const getCoverflowTransform = getSlideTarget

/**
 * Absolute index range that may be loaded for the current focus.
 * Finite — clamped to [0, count-1], never wraps, never > MAX_CARDS_LOADED.
 */
export function getLoadedIndexRange(
  focusIndex: number,
  count: number,
  limits: VisibilityLimits = DESKTOP_VISIBILITY
): { min: number; max: number } {
  if (count <= 0) return { min: 0, max: -1 }

  const focus = clampIndex(focusIndex, count)
  const windowSize = Math.min(
    MAX_CARDS_LOADED,
    limits.maxLeft + 1 + limits.maxRight,
    count
  )

  let min = focus - limits.maxLeft
  let max = min + windowSize - 1

  // Near the end of a finite deck, slide the window left (no wrap).
  if (max > count - 1) {
    max = count - 1
    min = Math.max(0, max - windowSize + 1)
  }
  if (min < 0) {
    min = 0
    max = Math.min(count - 1, min + windowSize - 1)
  }

  return { min, max }
}

export function getVisibleCardRange(
  focusIndex: number,
  count: number,
  limits: VisibilityLimits = DESKTOP_VISIBILITY
): { min: number; max: number } {
  return getLoadedIndexRange(focusIndex, count, limits)
}

/**
 * Width of the on-screen card row (px).
 * Used for horizontal centering.
 */
export function getVisibleStackWidth(
  focusIndex: number,
  count: number,
  limits: VisibilityLimits = DESKTOP_VISIBILITY
): number {
  if (count <= 0) return CARD_WIDTH

  const { min, max } = getLoadedIndexRange(focusIndex, count, limits)
  const leftOffset = min - focusIndex
  const rightOffset = max - focusIndex
  const leftPose = getSlideTarget(leftOffset, limits)
  const rightPose = getSlideTarget(rightOffset, limits)

  const leftEdge = leftPose.x
  const rightEdge = rightPose.x + CARD_WIDTH * rightPose.scale
  const span = rightEdge - leftEdge

  return Math.ceil(Math.max(span, CARD_WIDTH) + 24)
}

export function getCarouselFrameWidth(stackWidth: number): number {
  return stackWidth + 2 * (CHEVRON_SIZE + CHEVRON_GUTTER)
}

export function isCardVisibleInStack(
  offset: number,
  limits: VisibilityLimits = DESKTOP_VISIBILITY
): boolean {
  return (
    offset >= -limits.maxLeft - 0.001 && offset <= limits.maxRight + 0.001
  )
}

export function isCardRenderedInStack(
  offset: number,
  limits: VisibilityLimits = DESKTOP_VISIBILITY
): boolean {
  return isCardVisibleInStack(offset, limits)
}

/**
 * Soft rubber-band when continuous scrub would leave the finite deck.
 *
 * The carousel is left-anchored: focus stays the left hero, and `dragOffset`
 * slides the whole row. Card X during drag is:
 *   x = getRelativeCardX(focus → card) + dragOffset
 * so the free drag range is exactly the real pixel span from the first card
 * to the last card (group gaps included).
 *
 * Optional `edgeSpan` is that real pixel distance from focus to the edge
 * card (positive). When omitted, falls back to |focus - edge| * cardStep.
 *
 * dragOffset > 0 → row followed pointer right → previous cards
 * dragOffset < 0 → row followed pointer left  → next cards
 *
 * `mode`:
 *   - 'browse' (default): HARD clamp at both ends. No overshoot while browsing
 *     so the row can't fly past the last card then snap back.
 *   - 'active': soft rubber only — used when a hero is open and we need a little
 *     give (e.g. room for the photo grid on the right).
 */
export function rubberBandDragOffset(
  dragOffset: number,
  focusIndex: number,
  count: number,
  cardStep: number = CARD_STEP,
  edgeSpan?: { toFirstPx?: number; toLastPx?: number },
  mode: 'browse' | 'active' = 'browse'
): number {
  if (count <= 1) return 0
  const step = Math.max(1, cardStep)
  const RUBBER = mode === 'active' ? 0.28 : 0

  // Max free drag right (toward previous / first card).
  // Bringing card 0 under the left hero requires +distance(focus → 0).
  let freeRight =
    typeof edgeSpan?.toFirstPx === 'number'
      ? Math.max(0, edgeSpan.toFirstPx)
      : Math.max(0, focusIndex) * step

  // Max free drag left (toward next / last card).
  // Bringing the last card under the left hero requires -distance(focus → last).
  let freeLeft =
    typeof edgeSpan?.toLastPx === 'number'
      ? -Math.max(0, edgeSpan.toLastPx)
      : -Math.max(0, count - 1 - focusIndex) * step

  // Hard stop when already on an end card — never allow overshoot there.
  if (focusIndex <= 0) freeRight = 0
  if (focusIndex >= count - 1) freeLeft = 0

  if (dragOffset > freeRight) {
    if (RUBBER <= 0) return freeRight
    const excess = dragOffset - freeRight
    return freeRight + excess * RUBBER
  }

  if (dragOffset < freeLeft) {
    if (RUBBER <= 0) return freeLeft
    const excess = dragOffset - freeLeft
    return freeLeft + excess * RUBBER
  }

  return dragOffset
}

/**
 * Snap a continuous drag to the nearest card index.
 * dragOffset > 0 means the row followed the pointer right → previous cards.
 */
export function snapFocusIndex(
  focusIndex: number,
  dragOffset: number,
  count: number,
  cardStep: number = CARD_STEP,
  edgeSpan?: { toFirstPx?: number; toLastPx?: number },
  mode: 'browse' | 'active' = 'browse'
): number {
  if (count <= 0) return 0
  const step = Math.max(1, cardStep)
  const effective = rubberBandDragOffset(
    dragOffset,
    focusIndex,
    count,
    step,
    edgeSpan,
    mode
  )
  const virtual = focusIndex - effective / step
  return clampIndex(Math.round(virtual), count)
}

/**
 * Exact semi-implicit damped spring step from sugar-scracth3dpack:
 *
 *   v = (v + (target - value) * stiff * dt) * exp(-damping * dt)
 *   value += v * dt
 *
 * with dt = min(frameDelta, 1/30).
 */
export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  dt: number,
  stiffness: number = SPRING_STIFFNESS,
  damping: number = SPRING_DAMPING
): { value: number; velocity: number } {
  const damp = Math.exp(-damping * dt)
  const nextVelocity = (velocity + (target - value) * stiffness * dt) * damp
  const nextValue = value + nextVelocity * dt
  return { value: nextValue, velocity: nextVelocity }
}

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.min(Math.max(Math.round(index), 0), count - 1)
}
