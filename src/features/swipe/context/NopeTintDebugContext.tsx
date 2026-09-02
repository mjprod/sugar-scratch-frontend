/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  SWIPE_NOPE_BLEND_MODES,
  SWIPE_NOPE_BRIGHTNESS,
  SWIPE_NOPE_CONTRAST,
  SWIPE_NOPE_GRAYSCALE,
  SWIPE_NOPE_TINT_BLEND,
  SWIPE_NOPE_TINT_COLOR,
  SWIPE_NOPE_TINT_OPACITY,
  type SwipeNopeBlendMode,
} from '../constants/cards'

export type NopeTintTune = {
  /** Peak brightness() at full NOPE (lower = darker). */
  brightness: number
  /** Peak contrast() at full NOPE (1 = identity). */
  contrast: number
  /** Peak grayscale() at full NOPE (0–1). */
  grayscale: number
  /** Overlay solid color. */
  tintColor: string
  /** Peak overlay opacity at full NOPE (0–1). */
  tintOpacity: number
  /** CSS mix-blend-mode for the overlay. */
  blendMode: SwipeNopeBlendMode
}

// Bump when shipping new baked defaults so stale localStorage doesn't override.
const STORAGE_KEY = 'sugar-scratch.nope-tint-tune.v2'

export function defaultNopeTintTune(): NopeTintTune {
  return {
    brightness: SWIPE_NOPE_BRIGHTNESS,
    contrast: SWIPE_NOPE_CONTRAST,
    grayscale: SWIPE_NOPE_GRAYSCALE,
    tintColor: SWIPE_NOPE_TINT_COLOR,
    tintOpacity: SWIPE_NOPE_TINT_OPACITY,
    blendMode: SWIPE_NOPE_TINT_BLEND,
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeHex(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback
  const raw = input.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, r, g, b] = raw
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return fallback
}

function normalizeBlend(input: unknown, fallback: SwipeNopeBlendMode): SwipeNopeBlendMode {
  if (typeof input !== 'string') return fallback
  return (SWIPE_NOPE_BLEND_MODES as readonly string[]).includes(input)
    ? (input as SwipeNopeBlendMode)
    : fallback
}

export function normalizeNopeTintTune(
  input: Partial<NopeTintTune> | null | undefined,
): NopeTintTune {
  const base = defaultNopeTintTune()
  if (!input) return base
  return {
    brightness: clamp(num(input.brightness, base.brightness), 0.05, 1.5),
    contrast: clamp(num(input.contrast, base.contrast), 0.2, 2.5),
    grayscale: clamp(num(input.grayscale, base.grayscale), 0, 1),
    tintColor: normalizeHex(input.tintColor, base.tintColor),
    tintOpacity: clamp(num(input.tintOpacity, base.tintOpacity), 0, 1),
    blendMode: normalizeBlend(input.blendMode, base.blendMode),
  }
}

function loadTune(): NopeTintTune {
  if (typeof window === 'undefined') return defaultNopeTintTune()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultNopeTintTune()
    return normalizeNopeTintTune(JSON.parse(raw) as Partial<NopeTintTune>)
  } catch {
    return defaultNopeTintTune()
  }
}

function saveTune(tune: NopeTintTune) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tune))
  } catch {
    // ignore quota / private mode
  }
}

type NopeTintDebugContextValue = {
  tune: NopeTintTune
  setTune: (patch: Partial<NopeTintTune>) => void
  reset: () => void
  pasteSnippet: string
  /**
   * Debug-only: pin the front card at full NOPE look (progress = 1) so you can
   * tune without holding a left drag. Session-only — not persisted.
   */
  forceFull: boolean
  setForceFull: (on: boolean) => void
  toggleForceFull: () => void
}

const NopeTintDebugContext = createContext<NopeTintDebugContextValue | null>(null)

export function NopeTintDebugProvider({ children }: { children: ReactNode }) {
  const [tune, setTuneState] = useState<NopeTintTune>(() => loadTune())
  // Preview latch — never written to localStorage.
  const [forceFull, setForceFull] = useState(false)

  useEffect(() => {
    saveTune(tune)
  }, [tune])

  const setTune = useCallback((patch: Partial<NopeTintTune>) => {
    setTuneState((prev) => normalizeNopeTintTune({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setTuneState(defaultNopeTintTune())
  }, [])

  const toggleForceFull = useCallback(() => {
    setForceFull((prev) => !prev)
  }, [])

  const pasteSnippet = useMemo(() => {
    const t = normalizeNopeTintTune(tune)
    return [
      `// NOPE tint debug export`,
      `export const SWIPE_NOPE_BRIGHTNESS = ${Number(t.brightness.toFixed(3))}`,
      `export const SWIPE_NOPE_CONTRAST = ${Number(t.contrast.toFixed(3))}`,
      `export const SWIPE_NOPE_GRAYSCALE = ${Number(t.grayscale.toFixed(3))}`,
      `export const SWIPE_NOPE_TINT_COLOR = '${t.tintColor}'`,
      `export const SWIPE_NOPE_TINT_OPACITY = ${Number(t.tintOpacity.toFixed(3))}`,
      `export const SWIPE_NOPE_TINT_BLEND = '${t.blendMode}' as const`,
    ].join('\n')
  }, [tune])

  const value = useMemo(
    () => ({
      tune,
      setTune,
      reset,
      pasteSnippet,
      forceFull,
      setForceFull,
      toggleForceFull,
    }),
    [tune, setTune, reset, pasteSnippet, forceFull, toggleForceFull],
  )

  return (
    <NopeTintDebugContext.Provider value={value}>
      {children}
    </NopeTintDebugContext.Provider>
  )
}

/** Live tune for StackSlot — falls back to constants when provider is absent. */
export function useNopeTintTune(): NopeTintTune {
  const ctx = useContext(NopeTintDebugContext)
  return ctx?.tune ?? defaultNopeTintTune()
}

/** Force-full preview latch (false when the debug provider is absent). */
export function useNopeTintForceFull(): boolean {
  const ctx = useContext(NopeTintDebugContext)
  return ctx?.forceFull ?? false
}
