/**
 * Editable duck-in timeline (start of duck → end of duck).
 * Channels: position xyz + rotation xyz.
 */

export type DuckInPose = {
  x: number
  y: number
  z: number
  rotX: number
  rotY: number
  rotZ: number
}

export type DuckInKeyframe = DuckInPose & {
  id: string
  /** Normalized time along the duck-in, 0 = start, 1 = end. */
  t: number
}

export type DuckInTimeline = {
  keys: DuckInKeyframe[]
}

export type DuckInChannel = keyof DuckInPose

export const DUCK_IN_CHANNELS: DuckInChannel[] = [
  'rotZ',
  'rotY',
  'rotX',
  'x',
  'y',
  'z',
]

export const DUCK_IN_CHANNEL_LABELS: Record<DuckInChannel, string> = {
  rotZ: 'Rot Z°',
  rotY: 'Rot Y°',
  rotX: 'Rot X°',
  x: 'Pos X',
  y: 'Pos Y',
  z: 'Pos Z',
}

/** Graph / slider ranges per channel. */
export const DUCK_IN_CHANNEL_RANGES: Record<
  DuckInChannel,
  { min: number; max: number; step: number; color: string }
> = {
  rotZ: { min: -90, max: 90, step: 0.5, color: '#ff6b9d' },
  rotY: { min: 0, max: 360, step: 0.5, color: '#7dd3fc' },
  rotX: { min: -90, max: 90, step: 0.5, color: '#fbbf24' },
  x: { min: -4, max: 4, step: 0.01, color: '#a78bfa' },
  y: { min: -8, max: 4, step: 0.01, color: '#34d399' },
  z: { min: -4, max: 5, step: 0.01, color: '#fb923c' },
}

/**
 * Defaults mirror the tuned duck path:
 * start rotZ -55 → mid -22.5 → peak +31 @ ~74% (y -0.51, z -1) → settle -6.
 *
 * Early keys keep moving immediately (no hold at End) so spin → duck has no park.
 */
export const DEFAULT_DUCK_IN_TIMELINE: DuckInTimeline = {
  keys: [
    {
      id: 'duck-0',
      t: 0,
      x: -0.01,
      y: -2.11,
      z: 0.09,
      rotX: -12,
      rotY: 86,
      rotZ: -55,
    },
    {
      // Early lead-in with real travel — avoids a flat first segment.
      id: 'duck-1',
      t: 0.08,
      x: -0.01,
      y: -1.88,
      z: -0.08,
      rotX: -12.4,
      rotY: 86,
      rotZ: -48,
    },
    {
      id: 'duck-2',
      t: 0.4,
      x: -0.01,
      y: -1.28,
      z: -0.58,
      rotX: -14,
      rotY: 86,
      rotZ: -22.5,
    },
    {
      id: 'duck-3',
      t: 0.7407,
      x: -0.01,
      y: -0.5097,
      z: -1,
      rotX: -7,
      rotY: 86,
      rotZ: 31,
    },
    {
      id: 'duck-4',
      t: 1,
      x: -0.01,
      y: -0.8,
      z: -1.12,
      rotX: -5,
      rotY: 86,
      rotZ: -6,
    },
  ],
}

// Bump so code defaults win over older localStorage duck curves.
export const DUCK_IN_STORAGE_KEY = 'sugar-scratch-reveal-duck-in-timeline-v3'

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t))
}

/**
 * Centripetal-ish Catmull-Rom (uniform in parameter space).
 * Gives C1 continuity across keys so Y/Z don't hitch at corners.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

function sampleChannel(
  keys: DuckInKeyframe[],
  i: number,
  local: number,
  channel: DuckInChannel,
) {
  const p1 = keys[i][channel]
  const p2 = keys[i + 1][channel]
  const p0 = keys[Math.max(0, i - 1)][channel]
  const p3 = keys[Math.min(keys.length - 1, i + 2)][channel]
  return catmullRom(p0, p1, p2, p3, local)
}

function newId() {
  return `duck-${Math.random().toString(36).slice(2, 9)}`
}

export function cloneDuckInTimeline(timeline: DuckInTimeline): DuckInTimeline {
  return {
    keys: timeline.keys.map((key) => ({ ...key })),
  }
}

export function sortDuckInKeys(keys: DuckInKeyframe[]): DuckInKeyframe[] {
  return [...keys].sort((a, b) => a.t - b.t)
}

export function loadDuckInTimeline(): DuckInTimeline {
  try {
    const raw = localStorage.getItem(DUCK_IN_STORAGE_KEY)
    if (!raw) return cloneDuckInTimeline(DEFAULT_DUCK_IN_TIMELINE)
    const parsed = JSON.parse(raw) as Partial<DuckInTimeline>
    if (!Array.isArray(parsed.keys) || parsed.keys.length < 2) {
      return cloneDuckInTimeline(DEFAULT_DUCK_IN_TIMELINE)
    }
    const keys = parsed.keys
      .map((key, index) => {
        const base = DEFAULT_DUCK_IN_TIMELINE.keys[
          Math.min(index, DEFAULT_DUCK_IN_TIMELINE.keys.length - 1)
        ]
        return {
          id: typeof key.id === 'string' ? key.id : newId(),
          t: clamp01(typeof key.t === 'number' ? key.t : base.t),
          x: typeof key.x === 'number' ? key.x : base.x,
          y: typeof key.y === 'number' ? key.y : base.y,
          z: typeof key.z === 'number' ? key.z : base.z,
          rotX: typeof key.rotX === 'number' ? key.rotX : base.rotX,
          rotY: typeof key.rotY === 'number' ? key.rotY : base.rotY,
          rotZ: typeof key.rotZ === 'number' ? key.rotZ : base.rotZ,
        } satisfies DuckInKeyframe
      })
      .sort((a, b) => a.t - b.t)

    // Keep endpoints pinned for a stable scrub range.
    if (keys.length > 0) {
      keys[0] = { ...keys[0], t: 0 }
      keys[keys.length - 1] = { ...keys[keys.length - 1], t: 1 }
    }
    return { keys }
  } catch {
    return cloneDuckInTimeline(DEFAULT_DUCK_IN_TIMELINE)
  }
}

export function saveDuckInTimeline(timeline: DuckInTimeline) {
  try {
    localStorage.setItem(DUCK_IN_STORAGE_KEY, JSON.stringify(timeline))
  } catch {
    // ignore quota / private mode
  }
}

export function sampleDuckInPose(
  timeline: DuckInTimeline,
  t: number,
): DuckInPose {
  const keys = sortDuckInKeys(timeline.keys)
  if (keys.length === 0) {
    return {
      x: 0,
      y: 0,
      z: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
    }
  }
  const u = clamp01(t)
  if (u <= keys[0].t) {
    const k = keys[0]
    return {
      x: k.x,
      y: k.y,
      z: k.z,
      rotX: k.rotX,
      rotY: k.rotY,
      rotZ: k.rotZ,
    }
  }
  const last = keys[keys.length - 1]
  if (u >= last.t) {
    return {
      x: last.x,
      y: last.y,
      z: last.z,
      rotX: last.rotX,
      rotY: last.rotY,
      rotZ: last.rotZ,
    }
  }

  let i = 0
  while (i < keys.length - 1 && keys[i + 1].t < u) i += 1
  const a = keys[i]
  const b = keys[i + 1]
  const span = Math.max(1e-6, b.t - a.t)
  // Linear segment parameter — Catmull-Rom keeps velocity continuous
  // across keys (smoothstep here would zero speed at every corner).
  const local = clamp01((u - a.t) / span)
  return {
    x: sampleChannel(keys, i, local, 'x'),
    y: sampleChannel(keys, i, local, 'y'),
    z: sampleChannel(keys, i, local, 'z'),
    rotX: sampleChannel(keys, i, local, 'rotX'),
    rotY: sampleChannel(keys, i, local, 'rotY'),
    rotZ: sampleChannel(keys, i, local, 'rotZ'),
  }
}

export function updateDuckInKey(
  timeline: DuckInTimeline,
  id: string,
  patch: Partial<Omit<DuckInKeyframe, 'id'>>,
): DuckInTimeline {
  const keys = timeline.keys.map((key) => {
    if (key.id !== id) return key
    const next = { ...key, ...patch }
    // Pin endpoints in time.
    if (key.t === 0 || (patch.t === undefined && key === timeline.keys[0])) {
      // fall through
    }
    return next
  })

  const sorted = sortDuckInKeys(
    keys.map((key, index, arr) => {
      if (index === 0) return { ...key, t: 0 }
      if (index === arr.length - 1) return { ...key, t: 1 }
      return { ...key, t: clamp01(key.t) }
    }),
  )

  // Re-pin after sort in case ids moved.
  if (sorted.length > 0) {
    sorted[0] = { ...sorted[0], t: 0 }
    sorted[sorted.length - 1] = { ...sorted[sorted.length - 1], t: 1 }
  }

  return { keys: sorted }
}

export function addDuckInKey(
  timeline: DuckInTimeline,
  t: number,
): DuckInTimeline {
  const pose = sampleDuckInPose(timeline, t)
  const key: DuckInKeyframe = {
    id: newId(),
    t: clamp01(t),
    ...pose,
  }
  // Don't stack on endpoints.
  if (key.t <= 0.001 || key.t >= 0.999) return timeline
  const keys = sortDuckInKeys([...timeline.keys, key])
  keys[0] = { ...keys[0], t: 0 }
  keys[keys.length - 1] = { ...keys[keys.length - 1], t: 1 }
  return { keys }
}

export function removeDuckInKey(
  timeline: DuckInTimeline,
  id: string,
): DuckInTimeline {
  if (timeline.keys.length <= 2) return timeline
  const target = timeline.keys.find((key) => key.id === id)
  if (!target) return timeline
  // Keep endpoints.
  if (target.t <= 0.0001 || target.t >= 0.9999) return timeline
  const keys = sortDuckInKeys(timeline.keys.filter((key) => key.id !== id))
  if (keys.length > 0) {
    keys[0] = { ...keys[0], t: 0 }
    keys[keys.length - 1] = { ...keys[keys.length - 1], t: 1 }
  }
  return { keys }
}
