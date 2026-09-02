/**
 * Live-tunable pack stage look (lights + face material + video grade).
 * Used by coverflow/reveal Three.js stages and the PackStageDebug panel.
 */

export type PackStageLightSettings = {
  ambientIntensity: number
  hemiIntensity: number
  hemiSky: string
  hemiGround: string
  /** Primary key light. */
  keyIntensity: number
  keyColor: string
  keyX: number
  keyY: number
  keyZ: number
  /** Primary fill. */
  fillIntensity: number
  fillColor: string
  fillX: number
  fillY: number
  fillZ: number
  /** Second fill — duplicate of primary, toggleable. */
  fill2Enabled: boolean
  fill2Intensity: number
  fill2Color: string
  fill2X: number
  fill2Y: number
  fill2Z: number
  pointIntensity: number
  pointColor: string
  pointX: number
  pointY: number
  pointZ: number
  /** Extra key lights — toggleable in PackStageDebug. */
  key2Enabled: boolean
  key2Intensity: number
  key2Color: string
  key2X: number
  key2Y: number
  key2Z: number
  key3Enabled: boolean
  key3Intensity: number
  key3Color: string
  key3X: number
  key3Y: number
  key3Z: number
}

/** Pack face MeshStandardMaterial knobs (video map + emissiveMap). */
export type PackStageFaceSettings = {
  /** Multiplies base color (1 = white / neutral). */
  color: number
  emissive: number
  emissiveIntensity: number
  metalness: number
  roughness: number
}

/**
 * Canvas 2D grade applied while drawing video frames into textures.
 * 1 = identity. Contrast < 1 flattens crushed looks; brightness lifts midtones.
 */
export type PackStageVideoGradeSettings = {
  brightness: number
  contrast: number
  saturation: number
}

export type PackStageLookSettings = {
  lights: PackStageLightSettings
  face: PackStageFaceSettings
  video: PackStageVideoGradeSettings
  /** WebGLRenderer.toneMappingExposure */
  exposure: number
}

/** Tuned pack-stage look (from live PackStageDebug session). */
export const DEFAULT_PACK_STAGE_LIGHTS: PackStageLightSettings = {
  ambientIntensity: 0,
  hemiIntensity: 2.99,
  hemiSky: '#ffffff',
  hemiGround: '#1a1020',
  keyIntensity: 1.09,
  keyColor: '#917855',
  keyX: -0.06,
  keyY: -1,
  keyZ: 4.19,
  fillIntensity: 0.07,
  fillColor: '#ffffff',
  fillX: 6,
  fillY: 2.37,
  fillZ: 3.63,
  fill2Enabled: true,
  fill2Intensity: 0.35,
  fill2Color: '#ffffff',
  fill2X: -3.9,
  fill2Y: 2.15,
  fill2Z: 1.44,
  pointIntensity: 0.35,
  pointColor: '#ffffff',
  pointX: -0.35,
  pointY: 3.32,
  pointZ: 2.79,
  key2Enabled: true,
  key2Intensity: 0.31,
  key2Color: '#ad5295',
  key2X: 0.3,
  key2Y: 4.35,
  key2Z: 2.97,
  key3Enabled: true,
  key3Intensity: 2.15,
  key3Color: '#e8f0ff',
  key3X: 1.44,
  key3Y: -0.34,
  key3Z: -0.7,
}

/** Tuned pack-face material (from live PackStageDebug session). */
export const DEFAULT_PACK_STAGE_FACE: PackStageFaceSettings = {
  color: 1.09,
  emissive: 0.06,
  emissiveIntensity: 0.88,
  metalness: 0.49,
  roughness: 0.31,
}

export const DEFAULT_PACK_STAGE_VIDEO: PackStageVideoGradeSettings = {
  brightness: 0.87,
  contrast: 0.8,
  saturation: 1.35,
}

export const DEFAULT_PACK_STAGE_LOOK: PackStageLookSettings = {
  lights: { ...DEFAULT_PACK_STAGE_LIGHTS },
  face: { ...DEFAULT_PACK_STAGE_FACE },
  video: { ...DEFAULT_PACK_STAGE_VIDEO },
  exposure: 1.68,
}

const STORAGE_KEY = 'sugar.packStageLook'

type Listener = () => void

function cloneLook(look: PackStageLookSettings): PackStageLookSettings {
  return {
    lights: { ...look.lights },
    face: { ...look.face },
    video: { ...look.video },
    exposure: look.exposure,
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function sanitizeLook(raw: unknown): PackStageLookSettings | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<PackStageLookSettings>
  const lightsRaw = { ...((value.lights ?? {}) as Record<string, unknown>) }
  // If an older save has no fill2, seed it as a duplicate of primary fill.
  if (lightsRaw.fill2Enabled === undefined && lightsRaw.fillIntensity !== undefined) {
    lightsRaw.fill2Enabled = true
    lightsRaw.fill2Intensity = lightsRaw.fillIntensity
    lightsRaw.fill2Color = lightsRaw.fillColor
    // Mirror X so the second fill isn't stacked on the first.
    const fx = typeof lightsRaw.fillX === 'number' ? lightsRaw.fillX : 0
    lightsRaw.fill2X = -fx
    lightsRaw.fill2Y = lightsRaw.fillY
    lightsRaw.fill2Z = lightsRaw.fillZ
  }

  const lightsIn = lightsRaw as Partial<PackStageLightSettings>
  const faceIn = (value.face ?? {}) as Partial<PackStageFaceSettings>
  const videoIn = (value.video ?? {}) as Partial<PackStageVideoGradeSettings>

  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  const hex = (v: unknown, fallback: string) =>
    typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)
      ? v
      : fallback
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === 'boolean' ? v : fallback

  return {
    lights: {
      ambientIntensity: clamp(num(lightsIn.ambientIntensity, DEFAULT_PACK_STAGE_LIGHTS.ambientIntensity), 0, 4),
      hemiIntensity: clamp(num(lightsIn.hemiIntensity, DEFAULT_PACK_STAGE_LIGHTS.hemiIntensity), 0, 4),
      hemiSky: hex(lightsIn.hemiSky, DEFAULT_PACK_STAGE_LIGHTS.hemiSky),
      hemiGround: hex(lightsIn.hemiGround, DEFAULT_PACK_STAGE_LIGHTS.hemiGround),
      keyIntensity: clamp(num(lightsIn.keyIntensity, DEFAULT_PACK_STAGE_LIGHTS.keyIntensity), 0, 6),
      keyColor: hex(lightsIn.keyColor, DEFAULT_PACK_STAGE_LIGHTS.keyColor),
      keyX: num(lightsIn.keyX, DEFAULT_PACK_STAGE_LIGHTS.keyX),
      keyY: num(lightsIn.keyY, DEFAULT_PACK_STAGE_LIGHTS.keyY),
      keyZ: num(lightsIn.keyZ, DEFAULT_PACK_STAGE_LIGHTS.keyZ),
      fillIntensity: clamp(num(lightsIn.fillIntensity, DEFAULT_PACK_STAGE_LIGHTS.fillIntensity), 0, 6),
      fillColor: hex(lightsIn.fillColor, DEFAULT_PACK_STAGE_LIGHTS.fillColor),
      fillX: num(lightsIn.fillX, DEFAULT_PACK_STAGE_LIGHTS.fillX),
      fillY: num(lightsIn.fillY, DEFAULT_PACK_STAGE_LIGHTS.fillY),
      fillZ: num(lightsIn.fillZ, DEFAULT_PACK_STAGE_LIGHTS.fillZ),
      fill2Enabled: bool(lightsIn.fill2Enabled, DEFAULT_PACK_STAGE_LIGHTS.fill2Enabled),
      fill2Intensity: clamp(num(lightsIn.fill2Intensity, DEFAULT_PACK_STAGE_LIGHTS.fill2Intensity), 0, 6),
      fill2Color: hex(lightsIn.fill2Color, DEFAULT_PACK_STAGE_LIGHTS.fill2Color),
      fill2X: num(lightsIn.fill2X, DEFAULT_PACK_STAGE_LIGHTS.fill2X),
      fill2Y: num(lightsIn.fill2Y, DEFAULT_PACK_STAGE_LIGHTS.fill2Y),
      fill2Z: num(lightsIn.fill2Z, DEFAULT_PACK_STAGE_LIGHTS.fill2Z),
      pointIntensity: clamp(num(lightsIn.pointIntensity, DEFAULT_PACK_STAGE_LIGHTS.pointIntensity), 0, 6),
      pointColor: hex(lightsIn.pointColor, DEFAULT_PACK_STAGE_LIGHTS.pointColor),
      pointX: num(lightsIn.pointX, DEFAULT_PACK_STAGE_LIGHTS.pointX),
      pointY: num(lightsIn.pointY, DEFAULT_PACK_STAGE_LIGHTS.pointY),
      pointZ: num(lightsIn.pointZ, DEFAULT_PACK_STAGE_LIGHTS.pointZ),
      key2Enabled: bool(lightsIn.key2Enabled, DEFAULT_PACK_STAGE_LIGHTS.key2Enabled),
      key2Intensity: clamp(num(lightsIn.key2Intensity, DEFAULT_PACK_STAGE_LIGHTS.key2Intensity), 0, 6),
      key2Color: hex(lightsIn.key2Color, DEFAULT_PACK_STAGE_LIGHTS.key2Color),
      key2X: num(lightsIn.key2X, DEFAULT_PACK_STAGE_LIGHTS.key2X),
      key2Y: num(lightsIn.key2Y, DEFAULT_PACK_STAGE_LIGHTS.key2Y),
      key2Z: num(lightsIn.key2Z, DEFAULT_PACK_STAGE_LIGHTS.key2Z),
      key3Enabled: bool(lightsIn.key3Enabled, DEFAULT_PACK_STAGE_LIGHTS.key3Enabled),
      key3Intensity: clamp(num(lightsIn.key3Intensity, DEFAULT_PACK_STAGE_LIGHTS.key3Intensity), 0, 6),
      key3Color: hex(lightsIn.key3Color, DEFAULT_PACK_STAGE_LIGHTS.key3Color),
      key3X: num(lightsIn.key3X, DEFAULT_PACK_STAGE_LIGHTS.key3X),
      key3Y: num(lightsIn.key3Y, DEFAULT_PACK_STAGE_LIGHTS.key3Y),
      key3Z: num(lightsIn.key3Z, DEFAULT_PACK_STAGE_LIGHTS.key3Z),
    },
    face: {
      color: clamp(num(faceIn.color, DEFAULT_PACK_STAGE_FACE.color), 0, 2),
      emissive: clamp(num(faceIn.emissive, DEFAULT_PACK_STAGE_FACE.emissive), 0, 2),
      emissiveIntensity: clamp(
        num(faceIn.emissiveIntensity, DEFAULT_PACK_STAGE_FACE.emissiveIntensity),
        0,
        3,
      ),
      metalness: clamp(num(faceIn.metalness, DEFAULT_PACK_STAGE_FACE.metalness), 0, 1),
      roughness: clamp(num(faceIn.roughness, DEFAULT_PACK_STAGE_FACE.roughness), 0, 1),
    },
    video: {
      brightness: clamp(num(videoIn.brightness, DEFAULT_PACK_STAGE_VIDEO.brightness), 0, 3),
      contrast: clamp(num(videoIn.contrast, DEFAULT_PACK_STAGE_VIDEO.contrast), 0, 3),
      saturation: clamp(num(videoIn.saturation, DEFAULT_PACK_STAGE_VIDEO.saturation), 0, 3),
    },
    exposure: clamp(num(value.exposure, DEFAULT_PACK_STAGE_LOOK.exposure), 0.2, 3),
  }
}

function loadStoredLook(): PackStageLookSettings {
  if (typeof window === 'undefined') return cloneLook(DEFAULT_PACK_STAGE_LOOK)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneLook(DEFAULT_PACK_STAGE_LOOK)
    const parsed = sanitizeLook(JSON.parse(raw))
    return parsed ?? cloneLook(DEFAULT_PACK_STAGE_LOOK)
  } catch {
    return cloneLook(DEFAULT_PACK_STAGE_LOOK)
  }
}

let current = loadStoredLook()
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function getPackStageLook(): PackStageLookSettings {
  return current
}

export function subscribePackStageLook(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setPackStageLook(next: PackStageLookSettings, persist = true) {
  current = cloneLook(next)
  if (persist && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    } catch {
      // ignore quota / private mode
    }
  }
  emit()
}

export function updatePackStageLook(
  patch: {
    lights?: Partial<PackStageLightSettings>
    face?: Partial<PackStageFaceSettings>
    video?: Partial<PackStageVideoGradeSettings>
    exposure?: number
  },
  persist = true,
) {
  setPackStageLook(
    {
      lights: { ...current.lights, ...patch.lights },
      face: { ...current.face, ...patch.face },
      video: { ...current.video, ...patch.video },
      exposure:
        typeof patch.exposure === 'number' ? patch.exposure : current.exposure,
    },
    persist,
  )
}

export function resetPackStageLook(persist = true) {
  setPackStageLook(cloneLook(DEFAULT_PACK_STAGE_LOOK), persist)
}

/** Canvas filter string for 2D video grade (identity omitted). */
export function getPackStageVideoFilter(video = current.video): string {
  const parts: string[] = []
  if (Math.abs(video.brightness - 1) > 0.001) {
    parts.push(`brightness(${video.brightness})`)
  }
  if (Math.abs(video.contrast - 1) > 0.001) {
    parts.push(`contrast(${video.contrast})`)
  }
  if (Math.abs(video.saturation - 1) > 0.001) {
    parts.push(`saturate(${video.saturation})`)
  }
  return parts.length ? parts.join(' ') : 'none'
}

/** Pretty JSON for copy/paste into defaults. */
export function formatPackStageLook(look: PackStageLookSettings = current): string {
  return JSON.stringify(look, null, 2)
}

function normalizeLightHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return value
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return `#${value}`
  return null
}

/**
 * Map API card lights onto the pack stage key rig:
 * - cardLightColor1 → Key 2 + Key 3
 * - cardLightColor2 → Key 1 (primary key)
 *
 * Missing/invalid values fall back to the baked defaults (not the live
 * debug overrides), so clearing an API colour restores the design default.
 */
export function applyApiCardLightColors(input: {
  cardLightColor1?: string | null
  cardLightColor2?: string | null
}): void {
  const fromLight1 = normalizeLightHex(input.cardLightColor1)
  const fromLight2 = normalizeLightHex(input.cardLightColor2)

  const nextKeyColor = fromLight2 ?? DEFAULT_PACK_STAGE_LIGHTS.keyColor
  const nextKey2Color = fromLight1 ?? DEFAULT_PACK_STAGE_LIGHTS.key2Color
  // Key 3 shares card light 1 with Key 2.
  const nextKey3Color = fromLight1 ?? DEFAULT_PACK_STAGE_LIGHTS.key3Color

  if (
    current.lights.keyColor === nextKeyColor &&
    current.lights.key2Color === nextKey2Color &&
    current.lights.key3Color === nextKey3Color
  ) {
    return
  }

  // Don't persist API-driven colour swaps into localStorage look presets —
  // those stay as the designer's baseline; model colours override live only.
  updatePackStageLook(
    {
      lights: {
        keyColor: nextKeyColor,
        key2Color: nextKey2Color,
        key3Color: nextKey3Color,
      },
    },
    false,
  )
}
