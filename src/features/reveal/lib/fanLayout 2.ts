export type FanLayout = {
  /** Horizontal distance from center to outermost cards (px). Higher = more spaced. */
  spreadX: number
  /** Total fan arc in degrees across the full hand. Higher = more angled. */
  spreadDeg: number
  /** How far cards lift above the pack mouth (px). */
  liftY: number
  /** Extra vertical drop on outer cards (px). Higher = more arc / less stacked. */
  outerDrop: number
  /** Uniform card size multiplier (z-scale feel). 1 = default size. */
  cardScale: number
}

/** Closed / exit-pack start of the fan open animation. */
export const FAN_OPEN_FROM: Pick<
  FanLayout,
  'cardScale' | 'spreadDeg' | 'spreadX' | 'liftY'
> = {
  cardScale: 0.75,
  spreadDeg: 0,
  spreadX: 0,
  liftY: 0,
}

/** Open hand end pose for the fan animation. */
export const DEFAULT_FAN_LAYOUT: FanLayout = {
  spreadX: 62,
  spreadDeg: 40,
  liftY: 61,
  outerDrop: 15,
  cardScale: 1.2,
}

// Bump so code defaults win over older localStorage fan layouts.
export const FAN_LAYOUT_STORAGE_KEY = 'sugar-scratch-reveal-fan-layout-v7'

export function cloneFanLayout(layout: FanLayout): FanLayout {
  return { ...layout }
}

export function loadFanLayout(): FanLayout {
  try {
    const raw = localStorage.getItem(FAN_LAYOUT_STORAGE_KEY)
    if (!raw) return cloneFanLayout(DEFAULT_FAN_LAYOUT)
    const parsed = JSON.parse(raw) as Partial<FanLayout>
    return {
      ...DEFAULT_FAN_LAYOUT,
      ...parsed,
      cardScale:
        typeof parsed.cardScale === 'number'
          ? parsed.cardScale
          : DEFAULT_FAN_LAYOUT.cardScale,
    }
  } catch {
    return cloneFanLayout(DEFAULT_FAN_LAYOUT)
  }
}

export function saveFanLayout(layout: FanLayout) {
  try {
    localStorage.setItem(FAN_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // ignore
  }
}

export function fanPose(
  index: number,
  total = 5,
  layout: FanLayout = DEFAULT_FAN_LAYOUT,
) {
  const mid = (total - 1) / 2
  const t = mid === 0 ? 0 : (index - mid) / mid
  const rot = t * (layout.spreadDeg / 2)
  const x = t * layout.spreadX
  const y = -layout.liftY + Math.abs(t) * layout.outerDrop
  return { x, y, rot }
}

export type FanLayoutField = {
  key: keyof FanLayout
  label: string
  min: number
  max: number
  step: number
  hint: string
}

export const FAN_LAYOUT_FIELDS: FanLayoutField[] = [
  {
    key: 'spreadX',
    label: 'Card spacing X',
    min: 0,
    max: 260,
    step: 1,
    hint: 'How far apart cards sit horizontally. Lower = tighter hand.',
  },
  {
    key: 'spreadDeg',
    label: 'Fan angle°',
    min: 0,
    max: 120,
    step: 1,
    hint: 'Rotation spread across the hand. Lower = more parallel.',
  },
  {
    key: 'liftY',
    label: 'Lift Y',
    min: 0,
    max: 280,
    step: 1,
    hint: 'How high the fan sits above the pack mouth.',
  },
  {
    key: 'outerDrop',
    label: 'Outer drop',
    min: 0,
    max: 60,
    step: 1,
    hint: 'Extra downward offset on outer cards (arc shape).',
  },
  {
    key: 'cardScale',
    label: 'Card scale',
    min: 0.5,
    max: 1.8,
    step: 0.01,
    hint: 'Uniform size of each fanned card (z-scale feel).',
  },
]
