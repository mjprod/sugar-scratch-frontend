import { animated, to, useSpring } from '@react-spring/web'
import type { SpringValue } from '@react-spring/web'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  CARD_RADIUS,
  STACK_BEHIND_BRIGHTNESS,
  STACK_DEPTH_SCALE_STEP,
  STACK_DEPTH_Y,
  STACK_SECOND_BRIGHTNESS,
  SWIPE_NOPE_CONTRAST,
  SWIPE_NOPE_TINT_BLEND,
  SWIPE_NOPE_TINT_COLOR,
  SWIPE_NOPE_TINT_OPACITY,
  SWIPE_REST_ROTATION,
  swipeHeroRestYPx,
  SWIPE_SHADOW_MAX_ALPHA,
  SWIPE_SHADOW_MAX_BLUR,
  SWIPE_SHADOW_MAX_OFFSET_X,
  SWIPE_SHADOW_MAX_OFFSET_Y,
  SWIPE_SHADOW_REST_ALPHA,
  SWIPE_SHADOW_REST_BLUR,
  swipeNopeProgressPx,
  swipeThresholdPx,
  type SwipeCardData,
} from '../constants/cards'
import {
  RIM_HEIGHT_REST_PX,
  rimColorFromSwipe,
  rimHeightFromSwipe,
  rimMaskImageFromSwipe,
} from '../constants/swipeCircle'
import {
  useNopeTintForceFull,
  useNopeTintTune,
  type NopeTintTune,
} from '../context/NopeTintDebugContext'
import { useSwipeCircleTune } from '../context/SwipeCircleDebugContext'
import { SwipeCard } from './SwipeCard'

type DragSprings = {
  x: SpringValue<number>
  y: SpringValue<number>
  rot: SpringValue<number>
  scale: SpringValue<number>
}

/** Separate leave-flight springs so the stack never inherits fly offsets. */
type LeaveSprings = {
  x: SpringValue<number>
  y: SpringValue<number>
  rot: SpringValue<number>
  scale: SpringValue<number>
  opacity: SpringValue<number>
}

type StackSlotProps = {
  card: SwipeCardData
  depth: number
  isFront: boolean
  playing: boolean
  /**
   * Idle front-card tilt (deg). Only applied at depth 0; behind cards stay flat
   * so promote can spring into the current hero rest angle.
   */
  restRot?: number
  drag?: DragSprings
  /** When set, this slot is mid fly-away (same card.id key / DOM node as before commit). */
  leave?: LeaveSprings
  /**
   * Shared horizontal swipe spring (drag.x or leave.x). Drives opposite-direction
   * lift shadows on the top of the stack while the hero is tilted.
   */
  tiltX?: SpringValue<number>
  /**
   * LIVE finger drag X only (never leave.x). Depth-1 brightens with the hero swipe.
   * Must not use leave.x — past-threshold leave would force full-bright, then snap
   * dim when the flyer clears (the post-bounce dim flash).
   */
  brightenX?: SpringValue<number>
  bind?: () => Record<string, unknown>
  stamps?: ReactNode
  zIndex: number
}

const promote = { tension: 190, friction: 14, mass: 1.15 }
const promoteFront = { tension: 175, friction: 12, mass: 1.22 }
/** Dim/bright fades — damped + clamped so brightness never overshoots/flashes. */
const brightnessFade = { tension: 110, friction: 30, mass: 1, clamp: true }

function restBrightness(depth: number) {
  if (depth === 0) return 1
  if (depth === 1) return STACK_SECOND_BRIGHTNESS
  return STACK_BEHIND_BRIGHTNESS
}

function pose(depth: number, restRot = SWIPE_REST_ROTATION) {
  return {
    x: 0,
    // Depth ladder + hero-only sink so the next card peeks above the front.
    y: depth * STACK_DEPTH_Y + (depth === 0 ? swipeHeroRestYPx() : 0),
    scale: 1 - depth * STACK_DEPTH_SCALE_STEP,
    // Only the hero idles tilted; promote springs 0 → restRot with scale/y.
    rot: depth === 0 ? restRot : 0,
  }
}

/** 0 at rest → 1 at full swipe threshold (either direction). */
function swipeProgressFromX(dx: number) {
  return smoothstep01(Math.abs(dx) / swipeThresholdPx())
}

/**
 * Depth-1 rest brightness lerps toward full as the hero swipe progresses,
 * so the next card brightens into place before it becomes front.
 */
function secondBrightnessFromX(dx: number, stackBrightness: number) {
  const t = swipeProgressFromX(dx)
  return stackBrightness * (1 - t) + 1 * t
}

function composeTransform(x: number, y: number, scale: number, rot: number) {
  return `translate3d(${x}px, ${y}px, 0) rotateZ(${rot}deg) scale3d(${scale}, ${scale}, 1)`
}

/**
 * 0 at rest/right → 1 at left drag clamp (or forced full for debug).
 * Desktop clamp is shorter than the commit threshold, so peak NOPE must
 * key off the clamp — otherwise full tint only appears on leave overshoot.
 */
function leftProgressFromX(dx: number, forceFull = false) {
  if (forceFull) return 1
  if (dx >= 0) return 0
  return Math.min(1, Math.max(0, -dx / swipeNopeProgressPx()))
}

/**
 * Peaks for progressive left/down drag.
 * Color / peak opacity / blend / contrast stay fixed (baked constants).
 * Brightness + grayscale still follow live debug tune so the panel can preview.
 */
function nopePeaks(tune: NopeTintTune) {
  return {
    brightness: tune.brightness,
    grayscale: tune.grayscale,
    // Fixed peaks — not live-edited during drag.
    contrast: SWIPE_NOPE_CONTRAST,
    tintColor: SWIPE_NOPE_TINT_COLOR,
    tintOpacity: SWIPE_NOPE_TINT_OPACITY,
    blendMode: SWIPE_NOPE_TINT_BLEND,
  }
}

/**
 * NOPE look on the face: brightness / contrast / grayscale toward peaks with t.
 * Color overlay lives on .swipe-deck__slot-face::after via --nope-tint*.
 * Rest / right stay identity so YES is untouched.
 */
function nopeFilterFromX(
  dx: number,
  stackBrightness: number,
  tune: NopeTintTune,
  forceFull = false,
) {
  const t = leftProgressFromX(dx, forceFull)
  const peaks = nopePeaks(tune)
  const brightness = stackBrightness * (1 - t) + peaks.brightness * t
  const contrast = 1 * (1 - t) + peaks.contrast * t
  const grayscale = t * peaks.grayscale
  return `brightness(${brightness}) contrast(${contrast}) grayscale(${grayscale})`
}

/** Overlay opacity ramps 0 → baked peak (1) with left progress. */
function nopeTintFromX(dx: number, tune: NopeTintTune, forceFull = false) {
  const peaks = nopePeaks(tune)
  return leftProgressFromX(dx, forceFull) * peaks.tintOpacity
}

function smoothstep01(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/**
 * Soft lift shadow opposite the swipe. Blur / offset / alpha grow with |dx|.
 * Deeper stack cards get a lighter copy so the pile reads as one tilted pack.
 */
function composeSwipeShadow(dx: number, depth: number) {
  const t = swipeProgressFromX(dx)
  // Opposite the swipe: right drag → shadow left, left drag → shadow right.
  const dir = dx > 0 ? -1 : dx < 0 ? 1 : 0
  const depthMul = depth <= 0 ? 1 : depth === 1 ? 0.72 : 0.48

  const ox = dir * (6 + t * (SWIPE_SHADOW_MAX_OFFSET_X - 6)) * depthMul
  const oy =
    (12 + t * (SWIPE_SHADOW_MAX_OFFSET_Y - 12)) * (0.9 + 0.1 * depthMul)
  const blur =
    (SWIPE_SHADOW_REST_BLUR +
      t * (SWIPE_SHADOW_MAX_BLUR - SWIPE_SHADOW_REST_BLUR)) *
    (0.88 + 0.12 * depthMul)
  const alpha =
    (SWIPE_SHADOW_REST_ALPHA +
      t * (SWIPE_SHADOW_MAX_ALPHA - SWIPE_SHADOW_REST_ALPHA)) *
    depthMul

  // Keep a quiet ambient under the directional lift so rest still has body.
  const ambientY = 16 + t * 6
  const ambientBlur = 36 + t * 10
  const ambientAlpha = 0.38 * (1 - t * 0.2) * depthMul

  return [
    `${ox.toFixed(2)}px ${oy.toFixed(2)}px ${blur.toFixed(2)}px rgba(0, 0, 0, ${alpha.toFixed(3)})`,
    `0 ${ambientY.toFixed(2)}px ${ambientBlur.toFixed(2)}px rgba(0, 0, 0, ${ambientAlpha.toFixed(3)})`,
    '0 2px 0 rgba(255, 255, 255, 0.06) inset',
  ].join(', ')
}

/**
 * One stable mount per card.id. Depth changes animate on THIS component's spring,
 * so promoting never rebinds a different spring controller (which caused flashes).
 * Leave flight must keep the same list key/position so the video element is preserved.
 */
export function StackSlot({
  card,
  depth,
  isFront,
  playing,
  restRot = SWIPE_REST_ROTATION,
  drag,
  leave,
  tiltX,
  brightenX,
  bind,
  stamps,
  zIndex,
}: StackSlotProps) {
  // Same OKLCH yes/nope as the page glow — rim stays in lockstep with debug.
  const { tune: circleTune } = useSwipeCircleTune()
  // Live NOPE media filter + overlay (debug panel / baked defaults).
  const nopeTune = useNopeTintTune()
  // Fixed overlay peaks (color / blend) — not scrubbed with drag.
  const nopeOverlayPeaks = nopePeaks(nopeTune)
  // Debug latch: pin front card at full NOPE without holding a drag.
  const nopeForceFull = useNopeTintForceFull()

  // Pose stays slightly bouncy; brightness is a separate damped fade.
  const style = useSpring({
    to: pose(depth, restRot),
    config: depth === 0 ? promoteFront : promote,
  })

  const [{ brightness }, brightnessApi] = useSpring(() => ({
    brightness: restBrightness(depth),
    config: brightnessFade,
  }))

  // Soft brightness fades on depth change only.
  const prevDepthRef = useRef(depth)

  useEffect(() => {
    const prev = prevDepthRef.current
    if (prev === depth) return
    prevDepthRef.current = depth
    const target = restBrightness(depth)

    // Second-card → hero: the live filter was already swipe-boosted toward 1.
    // Finger X is cleared on commit, so snap base brightness to full — never
    // fall back through 0.62 (that read as a dim flash on the new front).
    if (prev === 1 && depth === 0) {
      void brightnessApi.start({
        from: { brightness: 1 },
        to: { brightness: 1 },
        immediate: true,
        config: brightnessFade,
      })
      return
    }

    // Deeper → second (0.3 → 0.62) and other depth moves: soft fade, no bounce.
    void brightnessApi.start({
      to: { brightness: target },
      immediate: false,
      config: brightnessFade,
    })
  }, [depth, brightnessApi])

  const isLeaving = Boolean(leave)

  // Prefer leave springs when flying; otherwise compose stack pose + drag.
  const transform = leave
    ? to([leave.x, leave.y, leave.scale, leave.rot], (sx, sy, ss, sr) =>
        composeTransform(sx, sy, ss, sr),
      )
    : isFront && drag
      ? to(
          [style.x, style.y, style.scale, style.rot, drag.x, drag.y, drag.scale, drag.rot],
          (sx, sy, ss, sr, dx, dy, ds, dr) =>
            composeTransform(sx + dx, sy + dy, ss * ds, sr + dr),
        )
      : to([style.x, style.y, style.scale, style.rot], (sx, sy, ss, sr) =>
          composeTransform(sx, sy, ss, sr),
        )

  // Front / leave: progressive NOPE from drag/leave x (base brightness ~1).
  // t=0 identity → t=1 baked peaks (contrast 1.16, grayscale, brightness,
  // overlay opacity 1 @ #e10600 multiply). Color/blend/contrast peaks fixed.
  // Depth 1: progressive brighten from LIVE finger X only (never leave.x).
  // forceFull only latches the interactive front — not the departing flyer.
  const frontForceFull = isFront && nopeForceFull
  const filter = leave
    ? to([brightness, leave.x], (b, dx) =>
        nopeFilterFromX(dx, b, nopeTune, false),
      )
    : isFront && drag
      ? to([brightness, drag.x], (b, dx) =>
          nopeFilterFromX(dx, b, nopeTune, frontForceFull),
        )
      : depth === 1 && brightenX
        ? to([brightness, brightenX], (b, dx) =>
            `brightness(${secondBrightnessFromX(dx, b)}) saturate(1)`,
          )
        : to(brightness, (b) => `brightness(${b}) saturate(1)`)

  // Color overlay opacity ramps with left progress (face ::after). Front / flyer.
  const nopeTint = leave
    ? to(leave.x, (dx) => nopeTintFromX(dx, nopeTune, false))
    : isFront && drag
      ? to(drag.x, (dx) => nopeTintFromX(dx, nopeTune, frontForceFull))
      : 0

  // Bottom rim light — progressive OKLCH + thickness toward yes/nope.
  // Only front + flyer; under-cards stay off (transparent / rest height).
  const rimColor = leave
    ? to(leave.x, (dx) =>
        rimColorFromSwipe(dx, circleTune.yes, circleTune.nope, swipeThresholdPx()),
      )
    : isFront && drag
      ? to(drag.x, (dx) =>
          rimColorFromSwipe(dx, circleTune.yes, circleTune.nope, swipeThresholdPx()),
        )
      : 'transparent'

  const rimHeight = leave
    ? to(leave.x, (dx) => rimHeightFromSwipe(dx, swipeThresholdPx()))
    : isFront && drag
      ? to(drag.x, (dx) => rimHeightFromSwipe(dx, swipeThresholdPx()))
      : `${RIM_HEIGHT_REST_PX}px`

  // Edge-fade mask: yes → opaque right (black 100% / soft 80%);
  // nope → opaque left (black 0% / soft 20%).
  const rimMaskImage = leave
    ? to(leave.x, (dx) => rimMaskImageFromSwipe(dx, swipeThresholdPx()))
    : isFront && drag
      ? to(drag.x, (dx) => rimMaskImageFromSwipe(dx, swipeThresholdPx()))
      : rimMaskImageFromSwipe(0, swipeThresholdPx())

  // Slot always owns the shadow so we never swap card CSS ambient ↔ slot
  // tilt-shadow mid-promote (that ownership flip flashed a drop-shadow).
  const boxShadow = tiltX
    ? to(tiltX, (dx) => composeSwipeShadow(dx, depth))
    : composeSwipeShadow(0, depth)

  const className = [
    'swipe-deck__slot',
    isFront ? 'swipe-deck__slot--front' : '',
    isLeaving ? 'swipe-deck__slot--leaving' : '',
    // Always on — rest pose still paints via composeSwipeShadow(0, depth).
    'swipe-deck__slot--tilt-shadow',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <animated.div
      className={className}
      style={{
        transform,
        // Only the leave spring owns opacity; idle slots stay at full opacity
        // without swapping a SpringValue in/out (that swap flashed the video).
        ...(leave ? { opacity: leave.opacity } : {}),
        zIndex,
        touchAction: isFront ? 'none' : undefined,
        // Round the slot so the animated box-shadow follows the card corners.
        // Shadow lives here (not under filter) so NOPE dim/tint doesn't crush it.
        borderRadius: CARD_RADIUS,
        boxShadow,
        // Rim is a slot ::after outside the filtered face, so brightness /
        // grayscale + multiply tint never wash the yes/nope OKLCH border light.
        ['--card-rim' as string]: rimColor,
        ['--card-rim-height' as string]: rimHeight,
        ['--card-rim-mask' as string]: rimMaskImage,
      }}
      {...(isFront && bind ? bind() : {})}
      aria-hidden={isFront ? undefined : true}
    >
      <animated.div
        className="swipe-deck__slot-face"
        style={{
          // Progressive opacity; fixed color/blend peaks (baked constants).
          ['--nope-tint' as string]: nopeTint,
          ['--nope-tint-color' as string]: nopeOverlayPeaks.tintColor,
          ['--nope-tint-blend' as string]: nopeOverlayPeaks.blendMode,
        }}
      >
        {/*
          Brightness/contrast/grayscale live on an inner layer so the color
          ::after is not itself desaturated by the media filter.
        */}
        <animated.div className="swipe-deck__slot-face-media" style={{ filter }}>
          {stamps}
          <SwipeCard card={card} playing={playing} />
        </animated.div>
      </animated.div>
    </animated.div>
  )
}
