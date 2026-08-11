export type PackPose = {
  x: number
  y: number
  z: number
  scale: number
  rotY: number
  rotX: number
  rotZ: number
}

export type PackCamera = {
  cameraX: number
  cameraY: number
  cameraZ: number
  cameraFov: number
}

export type TimelineKeyframe = 'start' | 'middle' | 'end'

export type PackTimeline = {
  start: PackPose
  middle: PackPose
  end: PackPose
  camera: PackCamera
}

/** @deprecated single-pose shape kept for slider field reuse */
export type PackFraming = PackPose & PackCamera & {
  enterY?: number
}

export const DEFAULT_PACK_POSE: PackPose = {
  x: -0.01,
  y: -2.11,
  z: 0.09,
  scale: 0.81,
  rotY: 86,
  rotX: -12,
  rotZ: 0,
}

export const DEFAULT_PACK_CAMERA: PackCamera = {
  cameraX: 0.11,
  cameraY: 0.27,
  cameraZ: 4.2,
  cameraFov: 36,
}

export const DEFAULT_PACK_TIMELINE: PackTimeline = {
  start: {
    x: -0.01,
    y: -0.94,
    z: 0.09,
    scale: 0.73,
    rotY: 90.5,
    rotX: -12,
    rotZ: 0,
  },
  middle: {
    x: -0.01,
    y: -0.94,
    z: 0.09,
    scale: 0.73,
    rotY: 90.5,
    rotX: -12,
    rotZ: 0,
  },
  end: {
    x: -0.01,
    y: -2.11,
    z: 0.09,
    scale: 0.81,
    rotY: 86,
    rotX: -12,
    rotZ: 0,
  },
  camera: {
    cameraX: 0.11,
    cameraY: 0.27,
    cameraZ: 4.2,
    cameraFov: 36,
  },
}

// Bump key so this timeline wins over older localStorage values.
export const PACK_TIMELINE_STORAGE_KEY = 'sugar-scratch-reveal-pack-timeline-v9'

/**
 * Temporary: always boot from code defaults so stale localStorage / HMR
 * can't leave Start/Middle stuck on old poses while tuning.
 * Set false once poses are locked in.
 */
export const FORCE_DEFAULT_TIMELINE_ON_LOAD = true

/** Back-compat default used by older UI labels. */
export const DEFAULT_PACK_FRAMING: PackFraming = {
  ...DEFAULT_PACK_TIMELINE.end,
  ...DEFAULT_PACK_TIMELINE.camera,
  enterY: DEFAULT_PACK_TIMELINE.start.y,
}

export function clonePose(pose: PackPose): PackPose {
  return { ...pose }
}

export function cloneTimeline(timeline: PackTimeline): PackTimeline {
  return {
    start: clonePose(timeline.start),
    middle: clonePose(timeline.middle),
    end: clonePose(timeline.end),
    camera: { ...timeline.camera },
  }
}

export function loadPackTimeline(): PackTimeline {
  if (FORCE_DEFAULT_TIMELINE_ON_LOAD) {
    try {
      // Drop any old timeline keys so the panel/JSON always match code defaults.
      for (let i = 1; i <= 6; i += 1) {
        localStorage.removeItem(`sugar-scratch-reveal-pack-timeline-v${i}`)
      }
      localStorage.removeItem('sugar-scratch-reveal-pack-framing-v1')
      localStorage.removeItem('sugar-scratch-reveal-pack-framing-v2')
      localStorage.removeItem('sugar-scratch-reveal-pack-framing-v3')
      localStorage.removeItem('sugar-scratch-reveal-pack-framing-v4')
      localStorage.removeItem('sugar-scratch-reveal-pack-framing-v5')
      localStorage.removeItem('sugar-scratch-reveal-pack-framing-v6')
    } catch {
      // ignore
    }
    return cloneTimeline(DEFAULT_PACK_TIMELINE)
  }

  try {
    const raw = localStorage.getItem(PACK_TIMELINE_STORAGE_KEY)
    if (!raw) return cloneTimeline(DEFAULT_PACK_TIMELINE)
    const parsed = JSON.parse(raw) as Partial<PackTimeline>
    return {
      start: { ...DEFAULT_PACK_TIMELINE.start, ...(parsed.start ?? {}) },
      middle: { ...DEFAULT_PACK_TIMELINE.middle, ...(parsed.middle ?? {}) },
      end: { ...DEFAULT_PACK_TIMELINE.end, ...(parsed.end ?? {}) },
      camera: { ...DEFAULT_PACK_TIMELINE.camera, ...(parsed.camera ?? {}) },
    }
  } catch {
    return cloneTimeline(DEFAULT_PACK_TIMELINE)
  }
}

export function savePackTimeline(timeline: PackTimeline) {
  try {
    localStorage.setItem(PACK_TIMELINE_STORAGE_KEY, JSON.stringify(timeline))
  } catch {
    // ignore quota / private mode
  }
}

export function getTimelinePose(
  timeline: PackTimeline,
  key: TimelineKeyframe,
): PackPose {
  return timeline[key]
}

export function setTimelinePose(
  timeline: PackTimeline,
  key: TimelineKeyframe,
  pose: PackPose,
): PackTimeline {
  return {
    ...timeline,
    [key]: clonePose(pose),
  }
}

export type PoseFieldKey = keyof PackPose
export type CameraFieldKey = keyof PackCamera

export type SliderField<K extends string> = {
  key: K
  label: string
  min: number
  max: number
  step: number
}

export const PACK_POSE_FIELDS: SliderField<PoseFieldKey>[] = [
  { key: 'x', label: 'Pos X', min: -4, max: 4, step: 0.01 },
  { key: 'y', label: 'Pos Y', min: -8, max: 4, step: 0.01 },
  { key: 'z', label: 'Pos Z', min: -4, max: 5, step: 0.01 },
  { key: 'scale', label: 'Scale', min: 0.15, max: 4, step: 0.01 },
  { key: 'rotX', label: 'Rot X°', min: -90, max: 90, step: 0.5 },
  { key: 'rotY', label: 'Rot Y°', min: 0, max: 360, step: 0.5 },
  { key: 'rotZ', label: 'Rot Z°', min: -90, max: 90, step: 0.5 },
]

export const PACK_CAMERA_FIELDS: SliderField<CameraFieldKey>[] = [
  { key: 'cameraX', label: 'Cam X', min: -5, max: 5, step: 0.01 },
  { key: 'cameraY', label: 'Cam Y', min: -5, max: 5, step: 0.01 },
  { key: 'cameraZ', label: 'Cam Z', min: 1, max: 14, step: 0.05 },
  { key: 'cameraFov', label: 'Cam FOV', min: 12, max: 90, step: 0.5 },
]

/** Combined fields for the older single-framing modal API. */
export const PACK_FRAMING_FIELDS: SliderField<keyof PackFraming>[] = [
  ...PACK_POSE_FIELDS,
  ...PACK_CAMERA_FIELDS,
]

export const TIMELINE_KEYS: TimelineKeyframe[] = ['start', 'middle', 'end']

export const TIMELINE_LABELS: Record<TimelineKeyframe, string> = {
  start: 'Start',
  middle: 'Middle',
  end: 'End',
}

export const TIMELINE_HINTS: Record<TimelineKeyframe, string> = {
  start: 'Where the pack begins (usually off-screen / low).',
  middle: 'Peak pose in the rise sequence.',
  end: 'Final resting pose under the card fan.',
}
