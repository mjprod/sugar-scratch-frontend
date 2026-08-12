import { isSwipeDesktop } from './cards'

export type SwipeSide = 'like' | 'nope'

/** One editable sample along the drag (0–1 of swipe threshold). */
export type FeedbackKeyframe = {
  /** Drag fraction of SWIPE_THRESHOLD (0–1). */
  drag: number
  /** Lottie playhead 0–1. */
  lottie: number
  /** Y in dvh (neg up / pos down). */
  y: number
  /** Rotation deg (neg = CCW). */
  rot: number
  /** Uniform scale. */
  scale: number
  /** Container opacity 0–1. */
  opacity: number
  /** CSS blur in px. */
  blur: number
}

/**
 * Side tune: keyframe timeline drives lottie + transform during drag.
 * Legacy envelope fields still used for lag / commit finish clamps.
 */
export type SideFeedbackTune = {
  /** Sorted keyframes spanning the drag. */
  keys: FeedbackKeyframe[]

  /** Minimum playhead when finishing on commit (fast flicks still animate). */
  finishMin: number
  /** Cap playhead at commit so some frames remain to play out. */
  finishMax: number
  /**
   * How far the lottie/transform trail the finger (ms).
   * Higher = more delayed behind the drag.
   */
  dragLagMs: number
  /**
   * How fast the sequence advances through its drag window after it starts.
   * 1 = normal, 0.5 = 2× slower (at full drag you're only halfway through).
   */
  sequenceSpeed: number
  /** When false, stamp stays put (no drag-linked translate). */
  transformEnabled: boolean

  // --- legacy envelope (used to seed defaults / optional fallbacks) ---
  dragIn: number
  dragOut: number
  lottieIn: number
  lottieOut: number
  transformDragIn: number
  transformDragOut: number
  transformFromY: number
  transformToY: number
  transformFromRot: number
  transformMidRot: number
  transformToRot: number
  transformFromScale: number
  transformMidScale: number
  transformMidAt: number
  transformToScale: number
}

export type SwipeFeedbackTune = {
  like: SideFeedbackTune
  nope: SideFeedbackTune
}

/** Device lane for stamp timeline values (matches SWIPE_DESKTOP_MIN_WIDTH). */
export type SwipeFeedbackDevice = 'desktop' | 'mobile'

export type SwipeFeedbackByDevice = {
  desktop: SwipeFeedbackTune
  mobile: SwipeFeedbackTune
}

export type StampTransform = {
  y: number
  rot: number
  scale: number
  opacity: number
  blur: number
}

export type TimelinePose = StampTransform & {
  lottie: number
  drag: number
}

/** Fixed timeline points: start · 25% · 50% · 75% · 100%. */
export const TIMELINE_DRAGS = [0, 0.25, 0.5, 0.75, 1] as const
export const TIMELINE_STEPS = TIMELINE_DRAGS.length

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function smoothstep(t: number) {
  const u = clamp01(t)
  return u * u * (3 - 2 * u)
}

/** from → mid peak @ peakAt → to, with smoothstep. */
export function peakFromTravel(
  travel01: number,
  from: number,
  mid: number,
  to: number,
  peakAtRaw: number,
): number {
  const t = clamp01(travel01)
  const peakAt = Math.min(0.95, Math.max(0.05, peakAtRaw))

  if (t <= peakAt) {
    return lerp(from, mid, smoothstep(t / peakAt))
  }
  return lerp(mid, to, smoothstep((t - peakAt) / (1 - peakAt)))
}

export function mapDragWindow(drag01: number, dragIn: number, dragOut: number): number {
  const d = clamp01(drag01)
  if (d <= dragIn) return 0
  if (d >= dragOut) return 1
  return (d - dragIn) / (dragOut - dragIn)
}

/** Sample legacy envelope into a pose (used to build default keyframes). */
export function sampleLegacyPose(drag01: number, side: Omit<SideFeedbackTune, 'keys'>): TimelinePose {
  const d = clamp01(drag01)
  const speed = Math.max(0.15, Math.min(2, side.sequenceSpeed || 1))

  const lottieT = clamp01(mapDragWindow(d, side.dragIn, side.dragOut) * speed)
  const lottie = lerp(side.lottieIn, side.lottieOut, lottieT)

  // Default visual envelope: fully sharp/opaque once the sequence is active.
  const active = lottie > 0.001 || d >= side.transformDragIn
  const opacity = active ? 1 : 0
  const blur = 0

  if (!side.transformEnabled) {
    return {
      drag: d,
      lottie,
      y: side.transformFromY,
      rot: side.transformFromRot,
      scale: side.transformFromScale,
      opacity,
      blur,
    }
  }

  const travel = clamp01(mapDragWindow(d, side.transformDragIn, side.transformDragOut) * speed)
  return {
    drag: d,
    lottie,
    y: lerp(side.transformFromY, side.transformToY, travel),
    rot: peakFromTravel(
      travel,
      side.transformFromRot,
      side.transformMidRot,
      side.transformToRot,
      side.transformMidAt,
    ),
    scale: peakFromTravel(
      travel,
      side.transformFromScale,
      side.transformMidScale,
      side.transformToScale,
      side.transformMidAt,
    ),
    opacity,
    blur,
  }
}

/** Build evenly spaced keyframes from the legacy envelope. */
export function buildKeysFromLegacy(
  side: Omit<SideFeedbackTune, 'keys'>,
  steps = TIMELINE_STEPS,
): FeedbackKeyframe[] {
  void steps
  return TIMELINE_DRAGS.map((drag) => {
    const pose = sampleLegacyPose(drag, side)
    return {
      drag: round4(drag),
      lottie: round4(pose.lottie),
      y: round3(pose.y),
      rot: round3(pose.rot),
      scale: round3(pose.scale),
      opacity: round3(pose.opacity),
      blur: round3(pose.blur),
    }
  })
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

export function sortKeys(keys: FeedbackKeyframe[]): FeedbackKeyframe[] {
  return [...keys]
    .map((k) => ({
      drag: clamp01(k.drag),
      lottie: clamp01(k.lottie),
      y: k.y,
      rot: k.rot,
      scale: Math.max(0.05, k.scale),
      opacity: clamp01(typeof k.opacity === 'number' ? k.opacity : 1),
      blur: Math.max(0, Math.min(40, typeof k.blur === 'number' ? k.blur : 0)),
    }))
    .sort((a, b) => a.drag - b.drag)
}

export function sampleKeys(drag01: number, keys: FeedbackKeyframe[]): TimelinePose {
  const d = clamp01(drag01)
  const sorted = sortKeys(keys)
  if (sorted.length === 0) {
    return { drag: d, lottie: 0, y: 0, rot: 0, scale: 1, opacity: 0, blur: 0 }
  }
  if (sorted.length === 1 || d <= sorted[0]!.drag) {
    const k = sorted[0]!
    return {
      drag: d,
      lottie: k.lottie,
      y: k.y,
      rot: k.rot,
      scale: k.scale,
      opacity: k.opacity,
      blur: k.blur,
    }
  }
  const last = sorted[sorted.length - 1]!
  if (d >= last.drag) {
    return {
      drag: d,
      lottie: last.lottie,
      y: last.y,
      rot: last.rot,
      scale: last.scale,
      opacity: last.opacity,
      blur: last.blur,
    }
  }

  let i = 1
  while (i < sorted.length && sorted[i]!.drag < d) i += 1
  const a = sorted[i - 1]!
  const b = sorted[i]!
  const span = Math.max(1e-6, b.drag - a.drag)
  const t = smoothstep((d - a.drag) / span)
  return {
    drag: d,
    lottie: lerp(a.lottie, b.lottie, t),
    y: lerp(a.y, b.y, t),
    rot: lerp(a.rot, b.rot, t),
    scale: lerp(a.scale, b.scale, t),
    opacity: lerp(a.opacity, b.opacity, t),
    blur: lerp(a.blur, b.blur, t),
  }
}

/** Current tuned values — frozen as the desktop baseline. */
export const DEFAULT_SWIPE_FEEDBACK_DESKTOP: SwipeFeedbackTune = {
  like: {
    // Same timing/position envelope as NOPE — only the lottie asset differs.
    dragIn: 0.5,
    dragOut: 1,
    lottieIn: 0,
    lottieOut: 1,
    finishMin: 0.18,
    finishMax: 1,
    dragLagMs: 0,
    sequenceSpeed: 1,
    transformEnabled: true,
    transformDragIn: 0.5,
    transformDragOut: 1,
    transformFromY: 1,
    transformToY: 70.5,
    transformFromRot: 6.5,
    transformMidRot: -13.5,
    transformToRot: -12.7,
    transformFromScale: 0.71,
    transformMidScale: 2.29,
    transformMidAt: 0.6,
    transformToScale: 1.15,
    keys: [
      {
        drag: 0,
        lottie: 0,
        y: 40.5,
        rot: 6.5,
        scale: 0.71,
        opacity: 0,
        blur: 5,
      },
      {
        drag: 0.25,
        lottie: 0,
        y: 36,
        rot: 1,
        scale: 1.31,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 0.5,
        lottie: 0.19,
        y: 15.5,
        rot: 0,
        scale: 2.33,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 0.75,
        lottie: 0.31,
        y: 7,
        rot: -12.019,
        scale: 2.4,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 1,
        lottie: 0.59,
        y: 0.5,
        rot: -12.7,
        scale: 1.12,
        opacity: 0,
        blur: 7.5,
      },
    ],
  },
  nope: {
    // Absolute drag anchors (threshold %):
    // 50% start · 80% mid · 100% end
    dragIn: 0.5,
    dragOut: 1,
    lottieIn: 0,
    lottieOut: 1,
    finishMin: 0.18,
    finishMax: 1,
    dragLagMs: 0,
    sequenceSpeed: 1,
    transformEnabled: true,
    transformDragIn: 0.5,
    transformDragOut: 1,
    transformFromY: 1,
    transformToY: 70.5,
    transformFromRot: 6.5,
    transformMidRot: -13.5,
    transformToRot: -12.7,
    transformFromScale: 0.71,
    transformMidScale: 2.29,
    transformMidAt: 0.6,
    transformToScale: 1.15,
    keys: [
      {
        drag: 0,
        lottie: 0,
        y: 24.5,
        rot: 6.5,
        scale: 0.71,
        opacity: 0,
        blur: 5,
      },
      {
        drag: 0.25,
        lottie: 0,
        y: 24,
        rot: 6.5,
        scale: 0.71,
        opacity: 0.49,
        blur: 0,
      },
      {
        drag: 0.5,
        lottie: 0.27,
        y: 36.5,
        rot: 6.5,
        scale: 2.33,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 0.75,
        lottie: 0.58,
        y: 39.5,
        rot: -12.019,
        scale: 1.82,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 1,
        lottie: 1,
        y: 49,
        rot: -12.7,
        scale: 1.06,
        opacity: 0,
        blur: 10.5,
      },
    ],
  },
}

/**
 * Mobile stamp timeline — desktop stays frozen in DEFAULT_SWIPE_FEEDBACK_DESKTOP.
 * LIKE starts from desktop; NOPE uses mobile-tuned Y peaks.
 */
export const DEFAULT_SWIPE_FEEDBACK_MOBILE: SwipeFeedbackTune = {
  like: {
    dragIn: 0.5,
    dragOut: 1,
    lottieIn: 0,
    lottieOut: 1,
    finishMin: 0.18,
    finishMax: 1,
    dragLagMs: 0,
    sequenceSpeed: 1,
    transformEnabled: true,
    transformDragIn: 0.5,
    transformDragOut: 1,
    transformFromY: 1,
    transformToY: 70.5,
    transformFromRot: 6.5,
    transformMidRot: -13.5,
    transformToRot: -12.7,
    transformFromScale: 0.71,
    transformMidScale: 2.29,
    transformMidAt: 0.6,
    transformToScale: 1.15,
    keys: [
      {
        drag: 0,
        lottie: 0,
        y: 40.5,
        rot: 6.5,
        scale: 0.71,
        opacity: 0,
        blur: 5,
      },
      {
        drag: 0.25,
        lottie: 0,
        y: 23.5,
        rot: 1,
        scale: 1.31,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 0.5,
        lottie: 0.19,
        y: 6.5,
        rot: 0,
        scale: 2.33,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 0.75,
        lottie: 0.31,
        y: 0,
        rot: -12.019,
        scale: 2.4,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 1,
        lottie: 0.59,
        y: -19.5,
        rot: -12.7,
        scale: 1.12,
        opacity: 0,
        blur: 5,
      },
    ],
  },
  nope: {
    dragIn: 0.5,
    dragOut: 1,
    lottieIn: 0,
    lottieOut: 1,
    finishMin: 0.18,
    finishMax: 1,
    dragLagMs: 0,
    sequenceSpeed: 1,
    transformEnabled: true,
    transformDragIn: 0.5,
    transformDragOut: 1,
    transformFromY: 1,
    transformToY: 70.5,
    transformFromRot: 6.5,
    transformMidRot: -13.5,
    transformToRot: -12.7,
    transformFromScale: 0.71,
    transformMidScale: 2.29,
    transformMidAt: 0.6,
    transformToScale: 1.15,
    keys: [
      {
        drag: 0,
        lottie: 0,
        y: 24.5,
        rot: 6.5,
        scale: 0.71,
        opacity: 0,
        blur: 5,
      },
      {
        drag: 0.25,
        lottie: 0,
        y: 24,
        rot: 6.5,
        scale: 0.71,
        opacity: 0.49,
        blur: 0,
      },
      {
        drag: 0.5,
        lottie: 0.27,
        y: 58,
        rot: 6.5,
        scale: 2.33,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 0.75,
        lottie: 0.58,
        y: 62.5,
        rot: -12.019,
        scale: 1.82,
        opacity: 1,
        blur: 0,
      },
      {
        drag: 1,
        lottie: 1,
        y: 49,
        rot: -12.7,
        scale: 1.06,
        opacity: 0,
        blur: 10.5,
      },
    ],
  },
}

export const DEFAULT_SWIPE_FEEDBACK_BY_DEVICE: SwipeFeedbackByDevice = {
  desktop: DEFAULT_SWIPE_FEEDBACK_DESKTOP,
  mobile: DEFAULT_SWIPE_FEEDBACK_MOBILE,
}

/** @deprecated Prefer DEFAULT_SWIPE_FEEDBACK_DESKTOP / BY_DEVICE. */
export const DEFAULT_SWIPE_FEEDBACK = DEFAULT_SWIPE_FEEDBACK_DESKTOP

export const SWIPE_FEEDBACK_STORAGE_KEY = 'sugar-scratch.swipeFeedback.v41'
/** Previous flat { like, nope } storage — migrated into desktop (+ mobile clone). */
const SWIPE_FEEDBACK_STORAGE_KEY_LEGACY = 'sugar-scratch.swipeFeedback.v40'

/** CSS commit travel durations (must match SwipeStamp / index.css). */
export const COMMIT_FINISH_MS = {
  like: 520,
  nope: 520,
} as const

/**
 * Shared LIKE/NOPE velocity → playback feel.
 * use-gesture `velocity` is roughly px/ms-scale; flick commit already uses ~0.45.
 *
 * Drag only drives the sequence through STAMP_DRAG_SEQUENCE_MAX (75%).
 * The reserved tail (75%→100%) always plays during the swipe-away finish.
 */
export const STAMP_DRAG_SEQUENCE_MAX = 0.75
/** @deprecated Use STAMP_DRAG_SEQUENCE_MAX — kept for existing imports. */
export const NOPE_DRAG_SEQUENCE_MAX = STAMP_DRAG_SEQUENCE_MAX

export type StampVelocityTune = {
  /** Below this, playhead tracks the finger almost 1:1. */
  slowVx: number
  /** At/above this, rate-limit + finish timing hit their fast extremes. */
  fastVx: number
  /**
   * Max drag01 units/sec the sequence may advance while dragging.
   * Desktop keeps a slow cap on fast flicks; mobile lets fast swipes run ahead.
   */
  maxRateSlow: number
  maxRateFast: number
  /**
   * Duration to play the reserved tail (0.75→1.0) on swipe-away.
   * Faster flicks use the min end of the range.
   */
  tailSequenceMsMin: number
  tailSequenceMsMax: number
  /** CSS exit after the sequence catches up. */
  fallMsMin: number
  fallMsMax: number
}

/** Desktop stamp velocity feel (unchanged). */
export const STAMP_VELOCITY_DESKTOP: StampVelocityTune = {
  slowVx: 0.2,
  fastVx: 1.6,
  maxRateSlow: 4.5,
  maxRateFast: 1.35,
  tailSequenceMsMin: 280,
  tailSequenceMsMax: 520,
  fallMsMin: 300,
  fallMsMax: 520,
}

/**
 * Mobile: faster swipe → faster timeline + snappier finish.
 * maxRateFast > maxRateSlow so velocity drives the playhead ahead, not holds it back.
 */
export const STAMP_VELOCITY_MOBILE: StampVelocityTune = {
  slowVx: 0.15,
  fastVx: 1.35,
  maxRateSlow: 5.5,
  maxRateFast: 14,
  tailSequenceMsMin: 140,
  tailSequenceMsMax: 420,
  fallMsMin: 180,
  fallMsMax: 460,
}

/** @deprecated Prefer stampVelocityForViewport() / STAMP_VELOCITY_DESKTOP. */
export const STAMP_VELOCITY = STAMP_VELOCITY_DESKTOP
/** @deprecated Use STAMP_VELOCITY. */
export const NOPE_VELOCITY = STAMP_VELOCITY

export function stampVelocityForViewport(
  viewportWidth?: number,
): StampVelocityTune {
  return isSwipeDesktop(viewportWidth)
    ? STAMP_VELOCITY_DESKTOP
    : STAMP_VELOCITY_MOBILE
}

/** 0 at slowVx, 1 at fastVx. */
export function stampVelocityT(
  vxAbs: number,
  tune: StampVelocityTune = stampVelocityForViewport(),
): number {
  const v = Number.isFinite(vxAbs) ? Math.abs(vxAbs) : 0
  const { slowVx, fastVx } = tune
  if (fastVx <= slowVx) return v >= fastVx ? 1 : 0
  return clamp01((v - slowVx) / (fastVx - slowVx))
}
/** @deprecated Use stampVelocityT. */
export function nopeVelocityT(vxAbs: number): number {
  return stampVelocityT(vxAbs)
}

/** Max stamp drag01 advance per second while the finger is down. */
export function velocityToStampPlayheadRate(
  vxAbs: number,
  tune: StampVelocityTune = stampVelocityForViewport(),
): number {
  const t = stampVelocityT(vxAbs, tune)
  return lerp(tune.maxRateSlow, tune.maxRateFast, t)
}
/** @deprecated Use velocityToStampPlayheadRate. */
export function velocityToNopePlayheadRate(vxAbs: number): number {
  return velocityToStampPlayheadRate(vxAbs)
}

/**
 * Map finger drag (0–1 of threshold) onto the interactive portion of the
 * stamp timeline (0–STAMP_DRAG_SEQUENCE_MAX). Full drag stops at the 75% key.
 */
export function fingerDragToStampSequence(fingerDrag01: number): number {
  return clamp01(fingerDrag01) * STAMP_DRAG_SEQUENCE_MAX
}
/** @deprecated Use fingerDragToStampSequence. */
export function fingerDragToNopeSequence(fingerDrag01: number): number {
  return fingerDragToStampSequence(fingerDrag01)
}

export type StampFinishTiming = {
  /** Scrub remaining timeline release→1 (includes reserved 75–100% tail). */
  sequenceMs: number
  /** CSS exit after sequence (or immediately if already at end). */
  fallMs: number
}
/** @deprecated Use StampFinishTiming. */
export type NopeFinishTiming = StampFinishTiming

/**
 * How long the unfinished stamp sequence should keep playing after commit,
 * plus the exit. Always covers through 100%, with the reserved tail
 * (75→100) paced for readability even on fast flicks.
 */
export function velocityToStampFinishMs(
  vxAbs: number,
  releaseDrag01: number,
  tune: StampVelocityTune = stampVelocityForViewport(),
): StampFinishTiming {
  const release = clamp01(releaseDrag01)
  const remaining = clamp01(1 - release)
  const t = stampVelocityT(vxAbs, tune)
  const fallMs = Math.round(lerp(tune.fallMsMax, tune.fallMsMin, t))

  if (remaining <= 0.02) {
    return { sequenceMs: 0, fallMs }
  }

  // Pace from the reserved tail duration so 0.75→1 always feels intentional.
  const tailMs = lerp(tune.tailSequenceMsMax, tune.tailSequenceMsMin, t)
  const tailSpan = Math.max(0.01, 1 - STAMP_DRAG_SEQUENCE_MAX)
  const sequenceMs = Math.round(
    Math.max(tune.tailSequenceMsMin * 0.75, (tailMs / tailSpan) * remaining),
  )

  return { sequenceMs, fallMs }
}
/** @deprecated Use velocityToStampFinishMs. */
export function velocityToNopeFinishMs(
  vxAbs: number,
  releaseDrag01: number,
): StampFinishTiming {
  return velocityToStampFinishMs(vxAbs, releaseDrag01)
}

export function describeSwipeTiming(tune: SwipeFeedbackTune): string {
  const t = normalizeTune(tune)
  return [
    `LIKE: keys=${t.like.keys.length} · lag=${t.like.dragLagMs}ms · speed=${t.like.sequenceSpeed}x · commit=${COMMIT_FINISH_MS.like}ms`,
    `NOPE: keys=${t.nope.keys.length} · lag=${t.nope.dragLagMs}ms · speed=${t.nope.sequenceSpeed}x · commit=${COMMIT_FINISH_MS.nope}ms`,
  ].join('\n')
}

export function clampSideTune(side: SideFeedbackTune): SideFeedbackTune {
  const dragIn = clamp01(side.dragIn)
  const dragOut = Math.max(dragIn + 0.01, clamp01(side.dragOut))
  const lottieIn = clamp01(side.lottieIn)
  const lottieOut = clamp01(side.lottieOut)
  const finishMin = clamp01(side.finishMin)
  const finishMax = Math.max(finishMin, clamp01(side.finishMax))
  const transformDragIn = clamp01(side.transformDragIn)
  const transformDragOut = Math.max(transformDragIn + 0.01, clamp01(side.transformDragOut))

  const envelope = {
    dragIn,
    dragOut,
    lottieIn,
    lottieOut,
    finishMin,
    finishMax,
    dragLagMs: Math.max(0, Math.min(400, Number.isFinite(side.dragLagMs) ? side.dragLagMs : 0)),
    sequenceSpeed: Math.max(0.15, Math.min(2, Number.isFinite(side.sequenceSpeed) ? side.sequenceSpeed : 1)),
    transformEnabled: Boolean(side.transformEnabled),
    transformDragIn,
    transformDragOut,
    transformFromY: side.transformFromY,
    transformToY: side.transformToY,
    transformFromRot: side.transformFromRot,
    transformMidRot: side.transformMidRot,
    transformToRot: side.transformToRot,
    transformFromScale: Math.max(0.05, side.transformFromScale),
    transformMidScale: Math.max(0.05, side.transformMidScale),
    transformMidAt: clamp01(side.transformMidAt),
    transformToScale: Math.max(0.05, side.transformToScale),
  }

  const rawKeys =
    Array.isArray(side.keys) && side.keys.length > 0
      ? sortKeys(side.keys)
      : buildKeysFromLegacy(envelope, TIMELINE_STEPS)
  const keys = ensureTimelineKeys(rawKeys)

  return { ...envelope, keys }
}

function sideFromPartial(
  base: SideFeedbackTune,
  input: Partial<SideFeedbackTune> | undefined,
): SideFeedbackTune {
  const merged = { ...base, ...(input ?? {}) }
  return clampSideTune({
    keys: Array.isArray(merged.keys) ? merged.keys : base.keys,
    dragIn: num(merged.dragIn, base.dragIn),
    dragOut: num(merged.dragOut, base.dragOut),
    lottieIn: num(merged.lottieIn, base.lottieIn),
    lottieOut: num(merged.lottieOut, base.lottieOut),
    finishMin: num(merged.finishMin, base.finishMin),
    finishMax: num(merged.finishMax, base.finishMax),
    dragLagMs: num(merged.dragLagMs, base.dragLagMs),
    sequenceSpeed: num(merged.sequenceSpeed, base.sequenceSpeed),
    transformEnabled: bool(merged.transformEnabled, base.transformEnabled),
    transformDragIn: num(merged.transformDragIn, base.transformDragIn),
    transformDragOut: num(merged.transformDragOut, base.transformDragOut),
    transformFromY: num(merged.transformFromY, base.transformFromY),
    transformToY: num(merged.transformToY, base.transformToY),
    transformFromRot: num(merged.transformFromRot, base.transformFromRot),
    transformMidRot: num(merged.transformMidRot, base.transformMidRot),
    transformToRot: num(merged.transformToRot, base.transformToRot),
    transformFromScale: num(merged.transformFromScale, base.transformFromScale),
    transformMidScale: num(merged.transformMidScale, base.transformMidScale),
    transformMidAt: num(merged.transformMidAt, base.transformMidAt),
    transformToScale: num(merged.transformToScale, base.transformToScale),
  })
}

export function normalizeTune(
  input: Partial<SwipeFeedbackTune> | null | undefined,
  base: SwipeFeedbackTune = DEFAULT_SWIPE_FEEDBACK_DESKTOP,
): SwipeFeedbackTune {
  return {
    like: sideFromPartial(base.like, input?.like),
    nope: sideFromPartial(base.nope, input?.nope),
  }
}

export function normalizeTuneByDevice(
  input: Partial<SwipeFeedbackByDevice> | null | undefined,
): SwipeFeedbackByDevice {
  return {
    desktop: normalizeTune(input?.desktop, DEFAULT_SWIPE_FEEDBACK_DESKTOP),
    mobile: normalizeTune(input?.mobile, DEFAULT_SWIPE_FEEDBACK_MOBILE),
  }
}

function isDeviceBag(value: unknown): value is Partial<SwipeFeedbackByDevice> {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return 'desktop' in obj || 'mobile' in obj
}

function isFlatTune(value: unknown): value is Partial<SwipeFeedbackTune> {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return 'like' in obj || 'nope' in obj
}

/** Deep-clone a normalized tune for seeding the other device lane. */
export function cloneTune(tune: SwipeFeedbackTune): SwipeFeedbackTune {
  return normalizeTune(structuredClone(tune))
}

export function defaultTuneForDevice(device: SwipeFeedbackDevice): SwipeFeedbackTune {
  return device === 'desktop'
    ? DEFAULT_SWIPE_FEEDBACK_DESKTOP
    : DEFAULT_SWIPE_FEEDBACK_MOBILE
}

/**
 * Sample the side timeline at a drag fraction.
 * Keyframe `drag` values are absolute swipe-threshold fractions:
 * 0.5 = 50% drag, 0.8 = 80%, 1 = full swipe. No speed remapping here —
 * sequenceSpeed only affects lag feel / legacy envelope seeding.
 */
export function sampleSideAtDrag(drag01: number, side: SideFeedbackTune): TimelinePose {
  return sampleKeys(clamp01(drag01), side.keys)
}

export function mapDragToLottie(drag01: number, side: SideFeedbackTune): number {
  return sampleSideAtDrag(drag01, side).lottie
}

export function mapDragToTransform(drag01: number, side: SideFeedbackTune): StampTransform {
  if (!side.transformEnabled) {
    const k = side.keys[0]
    return {
      y: k?.y ?? 0,
      rot: k?.rot ?? 0,
      scale: k?.scale ?? 1,
      opacity: k?.opacity ?? 1,
      blur: k?.blur ?? 0,
    }
  }
  const pose = sampleSideAtDrag(drag01, side)
  return {
    y: pose.y,
    rot: pose.rot,
    scale: pose.scale,
    opacity: pose.opacity,
    blur: pose.blur,
  }
}

export function mapDragToTransformTravel(drag01: number, side: SideFeedbackTune): number {
  // Approx travel from y span for debug meters.
  if (!side.transformEnabled || side.keys.length < 2) return 0
  const sorted = sortKeys(side.keys)
  const y0 = sorted[0]!.y
  const y1 = sorted[sorted.length - 1]!.y
  const span = y1 - y0
  if (Math.abs(span) < 1e-6) return clamp01(drag01)
  const y = sampleSideAtDrag(drag01, side).y
  return clamp01((y - y0) / span)
}

export function commitLottieFrom(drag01: number, side: SideFeedbackTune): number {
  const mapped = mapDragToLottie(drag01, side)
  return Math.min(side.finishMax, Math.max(side.finishMin, mapped))
}

export function nearestTimelineDrag(drag: number): number {
  const d = clamp01(drag)
  let best: number = TIMELINE_DRAGS[0] ?? 0
  let bestDist = Math.abs(d - best)
  for (const point of TIMELINE_DRAGS) {
    const dist = Math.abs(d - point)
    if (dist < bestDist) {
      best = point
      bestDist = dist
    }
  }
  return best
}

export function upsertKeyframe(keys: FeedbackKeyframe[], next: FeedbackKeyframe): FeedbackKeyframe[] {
  const sorted = sortKeys(keys)
  const drag = nearestTimelineDrag(next.drag)
  const key: FeedbackKeyframe = {
    drag: round4(drag),
    lottie: clamp01(next.lottie),
    y: next.y,
    rot: next.rot,
    scale: Math.max(0.05, next.scale),
    opacity: clamp01(typeof next.opacity === 'number' ? next.opacity : 1),
    blur: Math.max(0, Math.min(40, typeof next.blur === 'number' ? next.blur : 0)),
  }
  const idx = sorted.findIndex((k) => Math.abs(k.drag - drag) < 1e-6)
  if (idx >= 0) {
    const copy = [...sorted]
    copy[idx] = key
    return copy
  }
  // Ensure all fixed points exist.
  const merged = sortKeys([...sorted, key])
  return ensureTimelineKeys(merged)
}

/** Guarantee exactly the 5 fixed timeline points exist (fills gaps by sampling). */
export function ensureTimelineKeys(keys: FeedbackKeyframe[]): FeedbackKeyframe[] {
  const sorted = sortKeys(keys)
  return TIMELINE_DRAGS.map((drag) => {
    const existing = sorted.find((k) => Math.abs(k.drag - drag) < 1e-6)
    if (existing) return { ...existing, drag }
    const pose = sampleKeys(drag, sorted)
    return {
      drag,
      lottie: pose.lottie,
      y: pose.y,
      rot: pose.rot,
      scale: pose.scale,
      opacity: pose.opacity,
      blur: pose.blur,
    }
  })
}

export function keyframeAtStep(keys: FeedbackKeyframe[], stepIndex: number): FeedbackKeyframe {
  const idx = Math.max(0, Math.min(TIMELINE_STEPS - 1, Math.round(stepIndex)))
  const drag = TIMELINE_DRAGS[idx]!
  const ensured = ensureTimelineKeys(keys)
  return ensured[idx] ?? {
    drag,
    lottie: 0,
    y: 0,
    rot: 0,
    scale: 1,
    opacity: 0,
    blur: 0,
  }
}

export function formatPointPaste(side: SwipeSide, key: FeedbackKeyframe): string {
  const pct = Math.round(key.drag * 100)
  return [
    `${side.toUpperCase()} @ ${pct}% drag`,
    `lottie: ${Math.round(key.lottie * 100)}%`,
    `y: ${key.y}dvh`,
    `rot: ${key.rot}°`,
    `scale: ${key.scale}×`,
    `opacity: ${key.opacity}`,
    `blur: ${key.blur}px`,
    '',
    'JSON:',
    JSON.stringify({ side, ...key }, null, 2),
  ].join('\n')
}

export function formatSidePointsPaste(side: SwipeSide, keys: FeedbackKeyframe[]): string {
  const ensured = ensureTimelineKeys(keys)
  const lines = [
    `${side.toUpperCase()} TIMELINE (5 points)`,
    '',
  ]
  for (const key of ensured) {
    const pct = Math.round(key.drag * 100)
    lines.push(
      `@${pct}%  lottie=${Math.round(key.lottie * 100)}%  y=${key.y}dvh  rot=${key.rot}°  scale=${key.scale}×  op=${key.opacity}  blur=${key.blur}px`,
    )
  }
  lines.push('', 'JSON:', JSON.stringify({ side, keys: ensured }, null, 2))
  return lines.join('\n')
}

function migrateLegacyFlatTune(raw: string): SwipeFeedbackByDevice | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isFlatTune(parsed) || isDeviceBag(parsed)) return null
    const desktop = normalizeTune(parsed, DEFAULT_SWIPE_FEEDBACK_DESKTOP)
    return {
      desktop,
      // Seed mobile from whatever was saved previously so nothing is lost.
      mobile: cloneTune(desktop),
    }
  } catch {
    return null
  }
}

export function loadSwipeFeedbackByDevice(): SwipeFeedbackByDevice {
  if (typeof window === 'undefined') return DEFAULT_SWIPE_FEEDBACK_BY_DEVICE
  try {
    const raw = window.localStorage.getItem(SWIPE_FEEDBACK_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (isDeviceBag(parsed)) return normalizeTuneByDevice(parsed)
      if (isFlatTune(parsed)) {
        const desktop = normalizeTune(parsed, DEFAULT_SWIPE_FEEDBACK_DESKTOP)
        return { desktop, mobile: cloneTune(desktop) }
      }
    }

    // One-shot migration from v40 flat storage.
    const legacy = window.localStorage.getItem(SWIPE_FEEDBACK_STORAGE_KEY_LEGACY)
    if (legacy) {
      const migrated = migrateLegacyFlatTune(legacy)
      if (migrated) {
        saveSwipeFeedbackByDevice(migrated)
        return migrated
      }
    }

    return DEFAULT_SWIPE_FEEDBACK_BY_DEVICE
  } catch {
    return DEFAULT_SWIPE_FEEDBACK_BY_DEVICE
  }
}

/** @deprecated Prefer loadSwipeFeedbackByDevice — returns desktop lane only. */
export function loadSwipeFeedback(): SwipeFeedbackTune {
  return loadSwipeFeedbackByDevice().desktop
}

export function saveSwipeFeedbackByDevice(byDevice: SwipeFeedbackByDevice) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    SWIPE_FEEDBACK_STORAGE_KEY,
    JSON.stringify(normalizeTuneByDevice(byDevice)),
  )
}

/** @deprecated Prefer saveSwipeFeedbackByDevice. */
export function saveSwipeFeedback(tune: SwipeFeedbackTune) {
  if (typeof window === 'undefined') return
  // Preserve the other device lane when only a flat tune is written.
  const current = loadSwipeFeedbackByDevice()
  saveSwipeFeedbackByDevice({
    ...current,
    desktop: normalizeTune(tune, DEFAULT_SWIPE_FEEDBACK_DESKTOP),
  })
}

export function formatSwipeFeedbackPaste(
  tune: SwipeFeedbackTune,
  device: SwipeFeedbackDevice = 'desktop',
): string {
  const t = normalizeTune(tune, defaultTuneForDevice(device))
  return [
    `SWIPE_FEEDBACK_${device.toUpperCase()}`,
    describeSwipeTiming(t),
    '',
    formatSidePointsPaste('like', t.like.keys),
    '',
    formatSidePointsPaste('nope', t.nope.keys),
    '',
    'FULL JSON:',
    JSON.stringify(t, null, 2),
  ].join('\n')
}
