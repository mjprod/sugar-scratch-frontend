/**
 * Bottom swipe-intent glow. Tuned via the Swipe circle debug panel;
 * bake values here once locked.
 */

import {
  SWIPE_DESKTOP_MIN_WIDTH,
  swipeDragMaxVw,
} from './cards'

/** OKLCH channel triple — L 0–1, C ≥ 0, H 0–360. */
export type OklchColor = {
  l: number
  c: number
  h: number
}

export type SwipeCircleTune = {
  /** Vertical offset from the viewport bottom (dvh). Neg = up. */
  yDvh: number
  /** Ellipse width in vw. */
  widthVw: number
  /** Ellipse height in vw (keeps aspect stable across short/tall phones). */
  heightVw: number
  /** CSS blur in px at full intensity. */
  blur: number
  /** Peak opacity at full like/nope drag (0–1). */
  opacity: number
  /** Yes / right swipe glow. */
  yes: OklchColor
  /** Nope / left swipe glow. */
  nope: OklchColor
}

/** Device lane for circle pose (matches SWIPE_DESKTOP_MIN_WIDTH). */
export type SwipeCircleDevice = 'desktop' | 'mobile'

export type SwipeCircleByDevice = {
  desktop: SwipeCircleTune
  mobile: SwipeCircleTune
}

/**
 * Locked desktop baseline — debug panel no longer edits this lane.
 * Tune mobile via the panel and paste into DEFAULT_SWIPE_CIRCLE_MOBILE.
 */
export const DEFAULT_SWIPE_CIRCLE_DESKTOP: SwipeCircleTune = {
  yDvh: 31,
  widthVw: 94,
  heightVw: 124,
  blur: 22,
  opacity: 0.33,
  yes: {
    l: 0.8664,
    c: 0.2948,
    h: 142.5,
  },
  nope: {
    l: 0.5,
    c: 0.4,
    h: 49.5,
  },
}

/**
 * Mobile lane — pose-tuned via debug panel (mobile-only).
 * Paste panel exports here when locked. Colors share desktop yes/nope.
 */
export const DEFAULT_SWIPE_CIRCLE_MOBILE: SwipeCircleTune = {
  yDvh: 17.5,
  widthVw: 104,
  heightVw: 137,
  blur: 51,
  opacity: 0.43,
  yes: {
    l: 0.8664,
    c: 0.2948,
    h: 142.5,
  },
  nope: {
    l: 0.5,
    c: 0.4,
    h: 49.5,
  },
}

export const DEFAULT_SWIPE_CIRCLE_BY_DEVICE: SwipeCircleByDevice = {
  desktop: DEFAULT_SWIPE_CIRCLE_DESKTOP,
  mobile: DEFAULT_SWIPE_CIRCLE_MOBILE,
}

/** @deprecated Prefer DEFAULT_SWIPE_CIRCLE_DESKTOP / BY_DEVICE. */
export const DEFAULT_SWIPE_CIRCLE = DEFAULT_SWIPE_CIRCLE_DESKTOP

// Bump when shipping new baked defaults so stale localStorage doesn't override.
export const SWIPE_CIRCLE_STORAGE_KEY = 'sugar-scratch.swipe-circle-tune.v10'

export function defaultSwipeCircleForDevice(
  device: SwipeCircleDevice,
): SwipeCircleTune {
  return device === 'desktop'
    ? {
        ...DEFAULT_SWIPE_CIRCLE_DESKTOP,
        yes: { ...DEFAULT_SWIPE_CIRCLE_DESKTOP.yes },
        nope: { ...DEFAULT_SWIPE_CIRCLE_DESKTOP.nope },
      }
    : {
        ...DEFAULT_SWIPE_CIRCLE_MOBILE,
        yes: { ...DEFAULT_SWIPE_CIRCLE_MOBILE.yes },
        nope: { ...DEFAULT_SWIPE_CIRCLE_MOBILE.nope },
      }
}

export function isSwipeCircleDesktop(
  viewportWidth =
    typeof window !== 'undefined' ? window.innerWidth : SWIPE_DESKTOP_MIN_WIDTH,
): boolean {
  return viewportWidth >= SWIPE_DESKTOP_MIN_WIDTH
}

/** Bottom rim strip thickness at rest / full swipe. */
export const RIM_HEIGHT_REST_PX = 0.5
export const RIM_HEIGHT_MAX_PX = 1

/**
 * Full rim progress should land when the finger hits the side's drag clamp,
 * not the shared commit threshold. Left (esp. desktop 5vw) never reaches
 * thresholdPx, so NOPE would stall mid-mask without this.
 */
function rimSpanPx(dx: number, thresholdPx: number) {
  const thresh = Math.max(1, thresholdPx)
  if (typeof window === 'undefined') return thresh
  const width = window.innerWidth
  const direction: 'left' | 'right' = dx < 0 ? 'left' : 'right'
  // Match SwipeDeck.dragMaxPx: desktop uses vw caps; mobile is at least threshold.
  const byVw = width * swipeDragMaxVw(direction, width)
  const sideMax =
    width >= SWIPE_DESKTOP_MIN_WIDTH
      ? byVw
      : Math.max(thresh, byVw)
  // Reachable travel for this side — clamp is often tighter than threshold on left.
  return Math.max(1, Math.min(thresh, sideMax))
}

function rimProgress01(dx: number, thresholdPx: number) {
  const span = rimSpanPx(dx, thresholdPx)
  const t = clamp(Math.abs(dx) / span, 0, 1)
  // Smoothstep so early drag stays subtle, then ramps.
  return t * t * (3 - 2 * t)
}

/**
 * Card bottom rim light — progressive OKLCH toward the active side color.
 * t01 is |drag| / threshold (0 rest → 1 full swipe).
 */
export function rimColorFromSwipe(
  dx: number,
  yes: OklchColor,
  nope: OklchColor,
  thresholdPx: number,
): string {
  const u = rimProgress01(dx, thresholdPx)
  if (u <= 0.001) return 'transparent'
  const side = dx >= 0 ? yes : nope
  // Progressive luma + chroma; hue locked to active side.
  const l = side.l * (0.4 + 0.6 * u)
  const c = side.c * u
  const alpha = 0.25 + 0.75 * u
  return formatOklch({ l, c, h: side.h }, alpha)
}

/** Rim strip height: 0.5px rest → 1px at full swipe. */
export function rimHeightFromSwipe(dx: number, thresholdPx: number): string {
  const u = rimProgress01(dx, thresholdPx)
  const px = RIM_HEIGHT_REST_PX + (RIM_HEIGHT_MAX_PX - RIM_HEIGHT_REST_PX) * u
  return `${px.toFixed(2)}px`
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Rim edge-fade mask-image for the swipe.
 *
 * Yes (right) end:  transparent 50% → black 80% → transparent 100%
 *   (opaque near the right, with a 20% fade off the trailing edge)
 * Nope (left) end:  transparent 0% → black 20% → transparent 40%
 *   (opaque near the left, with a soft leading-edge fade)
 * Rest: centered soft lobe (transparent · black · transparent).
 */
export function rimMaskImageFromSwipe(dx: number, thresholdPx: number): string {
  const u = rimProgress01(dx, thresholdPx)

  if (u <= 0.001) {
    return 'linear-gradient(to right, transparent 20%, black 50%, transparent 80%)'
  }

  if (dx >= 0) {
    // Yes: opaque slides right, keeps a trailing transparent so the edge softens.
    // Rest-ish → end:
    //   left soft  20% → 50%
    //   black      50% → 80%
    //   right soft 80% → 100%
    const softL = lerp(20, 50, u)
    const ink = lerp(50, 80, u)
    const softR = lerp(80, 100, u)
    return `linear-gradient(to right, transparent 0%, transparent ${softL.toFixed(2)}%, black ${ink.toFixed(2)}%, transparent ${softR.toFixed(2)}%)`
  }

  // Nope: opaque slides left, keeps a leading transparent so the edge softens.
  // Rest-ish → end:
  //   left soft  20% → 0%
  //   black      50% → 20%
  //   right soft 80% → 40%
  const softL = lerp(20, 0, u)
  const ink = lerp(50, 20, u)
  const softR = lerp(80, 40, u)
  return `linear-gradient(to right, transparent 0%, transparent ${softL.toFixed(2)}%, black ${ink.toFixed(2)}%, transparent ${softR.toFixed(2)}%)`
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function formatOklch({ l, c, h }: OklchColor, alpha = 1): string {
  const L = Number(l.toFixed(4))
  const C = Number(c.toFixed(4))
  const H = Number(h.toFixed(2))
  if (alpha >= 0.999) return `oklch(${L} ${C} ${H})`
  return `oklch(${L} ${C} ${H} / ${Number(alpha.toFixed(3))})`
}

export function lerpOklch(a: OklchColor, b: OklchColor, t: number): OklchColor {
  const u = clamp(t, 0, 1)
  // Shortest-path hue blend.
  let dh = b.h - a.h
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  return {
    l: a.l + (b.l - a.l) * u,
    c: a.c + (b.c - a.c) * u,
    h: ((a.h + dh * u) % 360 + 360) % 360,
  }
}

function srgbToLinear(u: number) {
  const v = clamp(u, 0, 1)
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(u: number) {
  const v = clamp(u, 0, 1)
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
}

/** sRGB 0–1 → OKLCH. */
export function srgbToOklch(r: number, g: number, b: number): OklchColor {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  const l_ = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
  const m_ = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
  const s_ = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl

  const l = Math.cbrt(l_)
  const m = Math.cbrt(m_)
  const s = Math.cbrt(s_)

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  const C = Math.sqrt(a * a + b2 * b2)
  let H = (Math.atan2(b2, a) * 180) / Math.PI
  if (H < 0) H += 360

  return {
    l: clamp(L, 0, 1),
    c: Math.max(0, C),
    h: H,
  }
}

/** OKLCH → sRGB 0–1 (may clip out-of-gamut). */
export function oklchToSrgb({ l, c, h }: OklchColor): {
  r: number
  g: number
  b: number
} {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b2 = c * Math.sin(hr)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b2
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b2
  const s_ = l - 0.0894841775 * a - 1.291485548 * b2

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  const rLin =
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const gLin =
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const bLin =
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  return {
    r: clamp(linearToSrgb(rLin), 0, 1),
    g: clamp(linearToSrgb(gLin), 0, 1),
    b: clamp(linearToSrgb(bLin), 0, 1),
  }
}

export function oklchToHex(color: OklchColor): string {
  const { r, g, b } = oklchToSrgb(color)
  const toByte = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}

export function hexToOklch(hex: string): OklchColor | null {
  const raw = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  const r = parseInt(raw.slice(0, 2), 16) / 255
  const g = parseInt(raw.slice(2, 4), 16) / 255
  const b = parseInt(raw.slice(4, 6), 16) / 255
  return srgbToOklch(r, g, b)
}

export function normalizeOklch(
  input: Partial<OklchColor> | null | undefined,
  fallback: OklchColor,
): OklchColor {
  const l = typeof input?.l === 'number' && Number.isFinite(input.l) ? input.l : fallback.l
  const c = typeof input?.c === 'number' && Number.isFinite(input.c) ? input.c : fallback.c
  const h = typeof input?.h === 'number' && Number.isFinite(input.h) ? input.h : fallback.h
  return {
    l: clamp(l, 0, 1),
    c: clamp(c, 0, 0.45),
    h: ((h % 360) + 360) % 360,
  }
}
