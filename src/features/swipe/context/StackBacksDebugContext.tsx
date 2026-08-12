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
  STACK_BACK_LIP_SCALE,
  STACK_BACK_LIP_X,
  STACK_BACK_LIP_Y,
  STACK_BACK_REST_ROLL_DEGS,
  STACK_BACK_VISIBLE,
  STACK_DEPTH_SCALE_STEP,
  STACK_DEPTH_Y,
} from '../constants/cards'

export type StackBackLipPose = {
  x: number
  y: number
  scale: number
  rot: number
}

export type StackBacksTune = {
  /** Outer wrapper = second-card locus. */
  baseY: number
  baseScale: number
  /** Nearest → deepest visible lips (4). */
  lips: StackBackLipPose[]
}

// Bump when shipping new baked defaults so stale localStorage doesn't override.
const STORAGE_KEY = 'sugar-scratch.stack-backs-tune.v2'

export function defaultStackBacksTune(): StackBacksTune {
  const lips: StackBackLipPose[] = Array.from(
    { length: STACK_BACK_VISIBLE },
    (_, index) => ({
      x: STACK_BACK_LIP_X[index] ?? 0,
      y: STACK_BACK_LIP_Y[index] ?? 0,
      scale: STACK_BACK_LIP_SCALE[index] ?? 1,
      rot: STACK_BACK_REST_ROLL_DEGS[index] ?? 0,
    }),
  )
  return {
    baseY: STACK_DEPTH_Y,
    baseScale: 1 - STACK_DEPTH_SCALE_STEP,
    lips,
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function normalizeTune(input: Partial<StackBacksTune> | null | undefined): StackBacksTune {
  const base = defaultStackBacksTune()
  if (!input) return base

  const lipsIn = Array.isArray(input.lips) ? input.lips : []
  const lips = base.lips.map((fallback, index) => {
    const raw = lipsIn[index] as Partial<StackBackLipPose> | undefined
    return {
      x: clamp(Number(raw?.x ?? fallback.x) || 0, -40, 40),
      y: clamp(Number(raw?.y ?? fallback.y) || 0, -40, 40),
      scale: clamp(Number(raw?.scale ?? fallback.scale) || fallback.scale, 0.8, 1.1),
      rot: clamp(Number(raw?.rot ?? fallback.rot) || 0, -8, 8),
    }
  })

  return {
    baseY: clamp(Number(input.baseY ?? base.baseY) || base.baseY, -40, 60),
    baseScale: clamp(
      Number(input.baseScale ?? base.baseScale) || base.baseScale,
      0.85,
      1.1,
    ),
    lips,
  }
}

function loadTune(): StackBacksTune {
  if (typeof window === 'undefined') return defaultStackBacksTune()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStackBacksTune()
    return normalizeTune(JSON.parse(raw) as Partial<StackBacksTune>)
  } catch {
    return defaultStackBacksTune()
  }
}

function saveTune(tune: StackBacksTune) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tune))
  } catch {
    // ignore quota / private mode
  }
}

type StackBacksDebugContextValue = {
  tune: StackBacksTune
  setBase: (patch: Partial<Pick<StackBacksTune, 'baseY' | 'baseScale'>>) => void
  setLip: (index: number, patch: Partial<StackBackLipPose>) => void
  reset: () => void
  /** Ready-to-paste snippet for cards.ts defaults. */
  pasteSnippet: string
}

const StackBacksDebugContext = createContext<StackBacksDebugContextValue | null>(
  null,
)

export function StackBacksDebugProvider({ children }: { children: ReactNode }) {
  const [tune, setTune] = useState<StackBacksTune>(() => loadTune())

  useEffect(() => {
    saveTune(tune)
  }, [tune])

  const setBase = useCallback(
    (patch: Partial<Pick<StackBacksTune, 'baseY' | 'baseScale'>>) => {
      setTune((prev) => normalizeTune({ ...prev, ...patch }))
    },
    [],
  )

  const setLip = useCallback((index: number, patch: Partial<StackBackLipPose>) => {
    setTune((prev) => {
      const lips = prev.lips.map((lip, i) =>
        i === index ? { ...lip, ...patch } : lip,
      )
      return normalizeTune({ ...prev, lips })
    })
  }, [])

  const reset = useCallback(() => {
    setTune(defaultStackBacksTune())
  }, [])

  const pasteSnippet = useMemo(() => {
    const rolls = tune.lips.map((l) => Number(l.rot.toFixed(2)))
    const scales = tune.lips.map((l) => Number(l.scale.toFixed(4)))
    const ys = tune.lips.map((l) => Number(l.y.toFixed(2)))
    const xs = tune.lips.map((l) => Number(l.x.toFixed(2)))
    return [
      `// StackBacks debug export`,
      `export const STACK_DEPTH_Y = ${Number(tune.baseY.toFixed(2))}`,
      `export const STACK_DEPTH_SCALE_STEP = ${Number((1 - tune.baseScale).toFixed(4))}`,
      `// Per-lip absolute rest (nearest → deepest)`,
      `export const STACK_BACK_LIP_X = [${xs.join(', ')}] as const`,
      `export const STACK_BACK_LIP_Y = [${ys.join(', ')}] as const`,
      `export const STACK_BACK_LIP_SCALE = [${scales.join(', ')}] as const`,
      `export const STACK_BACK_REST_ROLL_DEGS = [${rolls.join(', ')}, 0] as const`,
    ].join('\n')
  }, [tune])

  const value = useMemo(
    () => ({
      tune,
      setBase,
      setLip,
      reset,
      pasteSnippet,
    }),
    [tune, setBase, setLip, reset, pasteSnippet],
  )

  return (
    <StackBacksDebugContext.Provider value={value}>
      {children}
    </StackBacksDebugContext.Provider>
  )
}

export function useStackBacksDebug() {
  const ctx = useContext(StackBacksDebugContext)
  if (!ctx) {
    throw new Error('useStackBacksDebug must be used within StackBacksDebugProvider')
  }
  return ctx
}

/** Live tune for StackBacks — falls back to constants when panel provider is absent. */
export function useStackBacksTune(): StackBacksTune {
  const ctx = useContext(StackBacksDebugContext)
  return ctx?.tune ?? defaultStackBacksTune()
}
