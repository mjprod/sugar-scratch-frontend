/**
 * Full V-style holo lab parameters.
 *
 * How the default V/VStar effect is built (study notes):
 *
 * .card__shine / :after stack 4 backgrounds:
 *   0) foil/grain texture          size: --imgsize (often 18% 15% when unmasked → TILES)
 *   1) sunpillar rainbow            repeating-linear-gradient(0deg)  size: 200% 700%
 *                                   pos: 0% var(--background-y)
 *   2) metallic diagonal bars       repeating-linear-gradient(--angle)
 *                                   size: 300% 100% (main) / 195% 100% (:after)
 *                                   pos: var(--background-x) var(--background-y)
 *                                   ← THIS is the left/right-moving horizontal band look
 *   3) radial dark vignette         at --pointer-x/y
 *
 * :before is a soft radial (pointer-based), not bars.
 * .card__glare is a separate radial light (also pointer-based).
 *
 * Filters: brightness(pointer-from-center * k + base) contrast saturate
 * Blend: soft-light/hue/hard-light (main), exclusion/soft-light (:after)
 */

export type HoloTransform = {
  // --- pointer / interaction ---
  lockPointer: boolean
  pointerX: number
  pointerY: number
  pointerAxis: 'both' | 'x' | 'y'

  // --- layer visibility ---
  showMedia: boolean
  showShine: boolean
  showShineBefore: boolean
  showShineAfter: boolean
  showGlare: boolean
  /** Lab mode: override shine stack with controllable CSS vars. */
  labMode: boolean

  // --- foil / texture layer 0 ---
  foilSizeX: number
  foilSizeY: number
  foilPosX: number
  foilPosY: number

  // --- sunpillar layer 1 (vertical rainbow stripes) ---
  sunpillarSpace: number
  sunpillarSizeX: number
  sunpillarSizeY: number
  sunpillarPosX: number
  sunpillarPosY: number
  sunpillarOpacity: number

  // --- metallic bars layer 2 (the left/right band) ---
  barAngle: number
  barSizeX: number
  barSizeY: number
  barPosX: number
  barPosY: number
  barStripeDark: number
  barStripeLight: number
  barStripeGap: number
  barOpacity: number

  // --- after-layer bar size (second pass) ---
  afterBarSizeX: number
  afterBarSizeY: number

  // --- filters ---
  shineBrightness: number
  shineContrast: number
  shineSaturate: number
  afterBrightness: number
  afterContrast: number
  afterSaturate: number
  glareBrightness: number
  glareContrast: number
  glareOpacity: number
  beforeOpacity: number

  // --- clip (only some effects use it) ---
  clipTop: number
  clipRight: number
  clipBottom: number
  clipLeft: number
  disableClip: boolean
}

export const DEFAULT_HOLO_TRANSFORM: HoloTransform = {
  lockPointer: false,
  pointerX: 38,
  pointerY: 32,
  pointerAxis: 'both',

  showMedia: true,
  showShine: true,
  showShineBefore: true,
  showShineAfter: true,
  showGlare: true,
  labMode: false,

  // VStar unmasked foil tiles at 18% 15% — start at full cover for lab
  foilSizeX: 100,
  foilSizeY: 100,
  foilPosX: 50,
  foilPosY: 50,

  // From v-star.css / tuned debug defaults
  sunpillarSpace: 5,
  sunpillarSizeX: 200,
  sunpillarSizeY: 700,
  sunpillarPosX: 0,
  sunpillarPosY: 50,
  sunpillarOpacity: 1,

  barAngle: 133,
  barSizeX: 300,
  barSizeY: 100,
  barPosX: 50,
  barPosY: 50,
  // approximate stripe stops from the gradient: dark 0–3.8–5.2–10–12%
  barStripeDark: 3.8,
  barStripeLight: 4.5,
  barStripeGap: 12,
  barOpacity: 1,

  afterBarSizeX: 195,
  afterBarSizeY: 100,

  // Tuned from holo debug panel screenshot
  shineBrightness: 0.55,
  shineContrast: 2,
  shineSaturate: 1.25,
  afterBrightness: 1,
  afterContrast: 1.5,
  afterSaturate: 1.5,
  glareBrightness: 0.75,
  glareContrast: 0.55,
  glareOpacity: 0.28,
  beforeOpacity: 0.8,

  clipTop: 0,
  clipRight: 0,
  clipBottom: 0,
  clipLeft: 0,
  disableClip: false,
}

export const POKEMON_ART_CLIP: HoloTransform = {
  ...DEFAULT_HOLO_TRANSFORM,
  clipTop: 9.85,
  clipRight: 8,
  clipBottom: 52.85,
  clipLeft: 8,
}

export const BORDER_CLIP: HoloTransform = {
  ...DEFAULT_HOLO_TRANSFORM,
  clipTop: 2.8,
  clipRight: 4,
  clipBottom: 2.8,
  clipLeft: 4,
}

function clampNum(
  n: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function normalizeHoloTransform(
  partial?: Partial<HoloTransform> | null
): HoloTransform {
  const b = { ...DEFAULT_HOLO_TRANSFORM, ...(partial ?? {}) }
  const axis =
    b.pointerAxis === 'x' || b.pointerAxis === 'y' || b.pointerAxis === 'both'
      ? b.pointerAxis
      : 'both'

  return {
    lockPointer: Boolean(b.lockPointer),
    pointerX: clampNum(b.pointerX, 0, 100, 38),
    pointerY: clampNum(b.pointerY, 0, 100, 32),
    pointerAxis: axis,

    showMedia: b.showMedia !== false,
    showShine: b.showShine !== false,
    showShineBefore: b.showShineBefore !== false,
    showShineAfter: b.showShineAfter !== false,
    showGlare: b.showGlare !== false,
    labMode: Boolean(b.labMode),

    foilSizeX: clampNum(b.foilSizeX, 1, 400, 100),
    foilSizeY: clampNum(b.foilSizeY, 1, 400, 100),
    foilPosX: clampNum(b.foilPosX, 0, 100, 50),
    foilPosY: clampNum(b.foilPosY, 0, 100, 50),

    sunpillarSpace: clampNum(b.sunpillarSpace, 0.5, 40, 5),
    sunpillarSizeX: clampNum(b.sunpillarSizeX, 50, 1000, 200),
    sunpillarSizeY: clampNum(b.sunpillarSizeY, 50, 1500, 700),
    sunpillarPosX: clampNum(b.sunpillarPosX, 0, 100, 0),
    sunpillarPosY: clampNum(b.sunpillarPosY, 0, 100, 50),
    sunpillarOpacity: clampNum(b.sunpillarOpacity, 0, 1, 1),

    barAngle: clampNum(b.barAngle, 0, 180, 133),
    barSizeX: clampNum(b.barSizeX, 50, 1000, 300),
    barSizeY: clampNum(b.barSizeY, 10, 400, 100),
    barPosX: clampNum(b.barPosX, 0, 100, 50),
    barPosY: clampNum(b.barPosY, 0, 100, 50),
    barStripeDark: clampNum(b.barStripeDark, 0.5, 20, 3.8),
    barStripeLight: clampNum(b.barStripeLight, 0.5, 20, 4.5),
    barStripeGap: clampNum(b.barStripeGap, 2, 40, 12),
    barOpacity: clampNum(b.barOpacity, 0, 1, 1),

    afterBarSizeX: clampNum(b.afterBarSizeX, 50, 1000, 195),
    afterBarSizeY: clampNum(b.afterBarSizeY, 10, 400, 100),

    shineBrightness: clampNum(b.shineBrightness, 0.1, 4, 1),
    shineContrast: clampNum(b.shineContrast, 0.5, 6, 2),
    shineSaturate: clampNum(b.shineSaturate, 0, 4, 1.25),
    afterBrightness: clampNum(b.afterBrightness, 0.1, 4, 1),
    afterContrast: clampNum(b.afterContrast, 0.5, 6, 1.5),
    afterSaturate: clampNum(b.afterSaturate, 0, 4, 1.5),
    glareBrightness: clampNum(b.glareBrightness, 0.1, 4, 0.7),
    glareContrast: clampNum(b.glareContrast, 0.5, 6, 2),
    glareOpacity: clampNum(b.glareOpacity, 0, 1, 1),
    beforeOpacity: clampNum(b.beforeOpacity, 0, 1, 0.8),

    clipTop: clampNum(b.clipTop, 0, 80, 0),
    clipRight: clampNum(b.clipRight, 0, 80, 0),
    clipBottom: clampNum(b.clipBottom, 0, 80, 0),
    clipLeft: clampNum(b.clipLeft, 0, 80, 0),
    disableClip: Boolean(b.disableClip),
  }
}

export function mapPointerToBackground(pointerPercent: number): number {
  // Keep in a mid-band — extreme % + inverted calc() breaks holo sampling in Safari.
  const t = Math.min(1, Math.max(0, pointerPercent / 100))
  return 38 + t * (62 - 38)
}

export function mapPointerToBackgroundY(pointerPercent: number): number {
  const t = Math.min(1, Math.max(0, pointerPercent / 100))
  return 34 + t * (66 - 34)
}

function insetCss(n: HoloTransform): string {
  return `inset(${n.clipTop}% ${n.clipRight}% ${n.clipBottom}% ${n.clipLeft}%)`
}

function insetInvertPolygon(n: HoloTransform): string {
  const top = n.clipTop
  const right = 100 - n.clipRight
  const bottom = 100 - n.clipBottom
  const left = n.clipLeft
  return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${left}% ${top}%, ${left}% ${bottom}%, ${right}% ${bottom}%, ${right}% ${top}%, ${left}% ${top}%)`
}

export function holoTransformToCssVars(
  t: HoloTransform
): Record<string, string> {
  const n = normalizeHoloTransform(t)
  const inset = insetCss(n)
  const invert = insetInvertPolygon(n)

  // Metallic bar stripe stops (relative %).
  const d = n.barStripeDark
  const l = n.barStripeLight
  const g = n.barStripeGap

  return {
    // clip
    '--clip': n.disableClip ? 'none' : inset,
    '--clip-stage': n.disableClip ? 'none' : inset,
    '--clip-trainer': n.disableClip ? 'none' : inset,
    '--clip-borders': n.disableClip ? 'none' : inset,
    '--clip-invert': n.disableClip ? 'none' : invert,
    '--clip-stage-invert': n.disableClip ? 'none' : invert,
    '--clip-trainer-invert': n.disableClip ? 'none' : invert,

    // pointer helpers
    '--holo-pointer-x': `${n.pointerX}%`,
    '--holo-pointer-y': `${n.pointerY}%`,

    // lab: foil
    '--lab-foil-size-x': `${n.foilSizeX}%`,
    '--lab-foil-size-y': `${n.foilSizeY}%`,
    '--lab-foil-pos-x': `${n.foilPosX}%`,
    '--lab-foil-pos-y': `${n.foilPosY}%`,
    '--imgsize': `${n.foilSizeX}% ${n.foilSizeY}%`,

    // lab: sunpillar
    '--lab-space': `${n.sunpillarSpace}%`,
    '--space': `${n.sunpillarSpace}%`,
    '--lab-sun-size-x': `${n.sunpillarSizeX}%`,
    '--lab-sun-size-y': `${n.sunpillarSizeY}%`,
    '--lab-sun-pos-x': `${n.sunpillarPosX}%`,
    '--lab-sun-pos-y': `${n.sunpillarPosY}%`,
    '--lab-sun-opacity': String(n.sunpillarOpacity),

    // lab: bars
    '--lab-angle': `${n.barAngle}deg`,
    '--angle': `${n.barAngle}deg`,
    '--lab-bar-size-x': `${n.barSizeX}%`,
    '--lab-bar-size-y': `${n.barSizeY}%`,
    '--lab-bar-pos-x': `${n.barPosX}%`,
    '--lab-bar-pos-y': `${n.barPosY}%`,
    '--lab-bar-opacity': String(n.barOpacity),
    '--lab-bar-d': `${d}%`,
    '--lab-bar-l': `${l}%`,
    '--lab-bar-g': `${g}%`,
    '--lab-after-bar-size-x': `${n.afterBarSizeX}%`,
    '--lab-after-bar-size-y': `${n.afterBarSizeY}%`,

    // filters
    '--lab-shine-brightness': String(n.shineBrightness),
    '--lab-shine-contrast': String(n.shineContrast),
    '--lab-shine-saturate': String(n.shineSaturate),
    '--lab-after-brightness': String(n.afterBrightness),
    '--lab-after-contrast': String(n.afterContrast),
    '--lab-after-saturate': String(n.afterSaturate),
    '--lab-glare-brightness': String(n.glareBrightness),
    '--lab-glare-contrast': String(n.glareContrast),
    '--lab-glare-opacity': String(n.glareOpacity),
    '--lab-before-opacity': String(n.beforeOpacity),
  }
}

export function holoTransformToClassNames(t: HoloTransform): string {
  const n = normalizeHoloTransform(t)
  const classes: string[] = []
  if (n.disableClip) classes.push('holo-no-clip')
  if (!n.showShine) classes.push('holo-hide-shine')
  if (!n.showShineBefore) classes.push('holo-hide-shine-before')
  if (!n.showShineAfter) classes.push('holo-hide-shine-after')
  if (!n.showGlare) classes.push('holo-hide-glare')
  if (!n.showMedia) classes.push('holo-hide-media')
  if (n.lockPointer) classes.push('holo-lock-pointer')
  if (n.pointerAxis === 'x') classes.push('holo-axis-x')
  if (n.pointerAxis === 'y') classes.push('holo-axis-y')
  if (n.labMode) classes.push('holo-lab')
  return classes.join(' ')
}

export function formatHoloTransformSnippet(t: HoloTransform): string {
  const n = normalizeHoloTransform(t)
  return [
    '/* Holo lab state — paste back here */',
    JSON.stringify(n, null, 2),
  ].join('\n')
}
