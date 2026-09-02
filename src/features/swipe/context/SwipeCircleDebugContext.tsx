/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  DEFAULT_SWIPE_CIRCLE_BY_DEVICE,
  DEFAULT_SWIPE_CIRCLE_DESKTOP,
  DEFAULT_SWIPE_CIRCLE_MOBILE,
  SWIPE_CIRCLE_STORAGE_KEY,
  clamp,
  defaultSwipeCircleForDevice,
  isSwipeCircleDesktop,
  normalizeOklch,
  type OklchColor,
  type SwipeCircleByDevice,
  type SwipeCircleTune,
} from '../constants/swipeCircle'

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function defaultSwipeCircleTune(
  device: 'desktop' | 'mobile' = 'desktop',
): SwipeCircleTune {
  return defaultSwipeCircleForDevice(device)
}

export function normalizeSwipeCircleTune(
  input: Partial<SwipeCircleTune> | null | undefined,
  base: SwipeCircleTune = DEFAULT_SWIPE_CIRCLE_DESKTOP,
): SwipeCircleTune {
  if (!input) {
    return {
      ...base,
      yes: { ...base.yes },
      nope: { ...base.nope },
    }
  }
  return {
    yDvh: clamp(num(input.yDvh, base.yDvh), -80, 80),
    widthVw: clamp(num(input.widthVw, base.widthVw), 20, 260),
    heightVw: clamp(num(input.heightVw, base.heightVw), 10, 200),
    blur: clamp(num(input.blur, base.blur), 0, 120),
    opacity: clamp(num(input.opacity, base.opacity), 0, 1),
    yes: normalizeOklch(input.yes, base.yes),
    nope: normalizeOklch(input.nope, base.nope),
  }
}

function normalizeByDevice(
  input: Partial<SwipeCircleByDevice> | Partial<SwipeCircleTune> | null | undefined,
): SwipeCircleByDevice {
  // Legacy flat { yDvh, … } storage → treat as mobile (desktop is frozen baked).
  if (input && typeof input === 'object' && !('desktop' in input) && !('mobile' in input)) {
    return {
      desktop: normalizeSwipeCircleTune(
        DEFAULT_SWIPE_CIRCLE_DESKTOP,
        DEFAULT_SWIPE_CIRCLE_DESKTOP,
      ),
      mobile: normalizeSwipeCircleTune(
        input as Partial<SwipeCircleTune>,
        DEFAULT_SWIPE_CIRCLE_MOBILE,
      ),
    }
  }

  const by = (input ?? {}) as Partial<SwipeCircleByDevice>
  return {
    // Desktop stays on baked defaults — panel no longer writes this lane.
    desktop: normalizeSwipeCircleTune(
      DEFAULT_SWIPE_CIRCLE_DESKTOP,
      DEFAULT_SWIPE_CIRCLE_DESKTOP,
    ),
    mobile: normalizeSwipeCircleTune(by.mobile, DEFAULT_SWIPE_CIRCLE_MOBILE),
  }
}

function loadByDevice(): SwipeCircleByDevice {
  if (typeof window === 'undefined') return DEFAULT_SWIPE_CIRCLE_BY_DEVICE
  try {
    const raw = window.localStorage.getItem(SWIPE_CIRCLE_STORAGE_KEY)
    if (!raw) return DEFAULT_SWIPE_CIRCLE_BY_DEVICE
    return normalizeByDevice(JSON.parse(raw) as unknown as Partial<SwipeCircleByDevice>)
  } catch {
    return DEFAULT_SWIPE_CIRCLE_BY_DEVICE
  }
}

function saveByDevice(byDevice: SwipeCircleByDevice) {
  if (typeof window === 'undefined') return
  try {
    // Only persist mobile — desktop is code-baked.
    window.localStorage.setItem(
      SWIPE_CIRCLE_STORAGE_KEY,
      JSON.stringify({
        mobile: normalizeSwipeCircleTune(byDevice.mobile, DEFAULT_SWIPE_CIRCLE_MOBILE),
      }),
    )
  } catch {
    // ignore quota / private mode
  }
}

function oklchSnippet(name: string, color: OklchColor) {
  return [
    `  ${name}: {`,
    `    l: ${Number(color.l.toFixed(4))},`,
    `    c: ${Number(color.c.toFixed(4))},`,
    `    h: ${Number(color.h.toFixed(2))},`,
    `  },`,
  ].join('\n')
}

type LiveIntensity = {
  like01: number
  nope01: number
}

type SwipeCircleDebugContextValue = {
  /** Active viewport lane (desktop baked / mobile live-tuned). */
  tune: SwipeCircleTune
  /** True when viewport is desktop (≥768). */
  isDesktop: boolean
  /** Mobile lane only — what the debug panel edits. */
  mobileTune: SwipeCircleTune
  setTune: (patch: Partial<SwipeCircleTune>) => void
  setYes: (patch: Partial<OklchColor>) => void
  setNope: (patch: Partial<OklchColor>) => void
  reset: () => void
  /** Force a side so you can place the circle without swiping. */
  previewSide: 'off' | 'like' | 'nope'
  setPreviewSide: (side: 'off' | 'like' | 'nope') => void
  previewIntensity: number
  setPreviewIntensity: (value: number) => void
  /**
   * Publish live finger intensity without React state on the provider.
   * State updates here re-rendered SwipeDeck mid-drag and cancelled NOPE commits.
   */
  setLive: (like01: number, nope01: number) => void
  subscribeLive: (onStoreChange: () => void) => () => void
  getLive: () => LiveIntensity
  /** Mobile-only paste snippet. */
  pasteSnippet: string
}

const EMPTY_LIVE: LiveIntensity = { like01: 0, nope01: 0 }

const SwipeCircleDebugContext =
  createContext<SwipeCircleDebugContextValue | null>(null)

export function SwipeCircleDebugProvider({ children }: { children: ReactNode }) {
  const [byDevice, setByDevice] = useState<SwipeCircleByDevice>(() => loadByDevice())
  const [previewSide, setPreviewSide] = useState<'off' | 'like' | 'nope'>('off')
  const [previewIntensity, setPreviewIntensityState] = useState(0.85)
  const [isDesktop, setIsDesktop] = useState(() => isSwipeCircleDesktop())

  // Live intensity is ref + external store — NOT React state — so publishing
  // during drag only notifies SwipeCircle, not SwipeDeck / the whole tree.
  const liveRef = useRef<LiveIntensity>(EMPTY_LIVE)
  const liveListenersRef = useRef(new Set<() => void>())

  useEffect(() => {
    saveByDevice(byDevice)
  }, [byDevice])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(`(min-width: 768px)`)
    const apply = () => setIsDesktop(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  // Debug panel only mutates the mobile lane.
  const setTune = useCallback((patch: Partial<SwipeCircleTune>) => {
    setByDevice((prev) =>
      normalizeByDevice({
        ...prev,
        mobile: { ...prev.mobile, ...patch },
      }),
    )
  }, [])

  const setYes = useCallback((patch: Partial<OklchColor>) => {
    setByDevice((prev) =>
      normalizeByDevice({
        ...prev,
        mobile: {
          ...prev.mobile,
          yes: { ...prev.mobile.yes, ...patch },
        },
      }),
    )
  }, [])

  const setNope = useCallback((patch: Partial<OklchColor>) => {
    setByDevice((prev) =>
      normalizeByDevice({
        ...prev,
        mobile: {
          ...prev.mobile,
          nope: { ...prev.mobile.nope, ...patch },
        },
      }),
    )
  }, [])

  const reset = useCallback(() => {
    setByDevice(normalizeByDevice(DEFAULT_SWIPE_CIRCLE_BY_DEVICE))
    setPreviewSide('off')
    setPreviewIntensityState(0.85)
  }, [])

  const setPreviewIntensity = useCallback((value: number) => {
    setPreviewIntensityState(clamp(value, 0, 1))
  }, [])

  const setLive = useCallback((like01: number, nope01: number) => {
    const next = {
      like01: clamp(like01, 0, 1),
      nope01: clamp(nope01, 0, 1),
    }
    const prev = liveRef.current
    // Skip no-op notifies (idle zeros spam after commit).
    if (
      Math.abs(prev.like01 - next.like01) < 0.0008 &&
      Math.abs(prev.nope01 - next.nope01) < 0.0008
    ) {
      return
    }
    liveRef.current = next
    liveListenersRef.current.forEach((listener) => listener())
  }, [])

  const subscribeLive = useCallback((onStoreChange: () => void) => {
    liveListenersRef.current.add(onStoreChange)
    return () => {
      liveListenersRef.current.delete(onStoreChange)
    }
  }, [])

  const getLive = useCallback(() => liveRef.current, [])

  const mobileTune = byDevice.mobile
  // Desktop always serves baked defaults; mobile serves the live-tuned lane.
  const tune = isDesktop ? byDevice.desktop : byDevice.mobile

  const pasteSnippet = useMemo(() => {
    const t = normalizeSwipeCircleTune(mobileTune, DEFAULT_SWIPE_CIRCLE_MOBILE)
    return [
      `// Swipe circle MOBILE debug export`,
      `export const DEFAULT_SWIPE_CIRCLE_MOBILE = {`,
      `  yDvh: ${Number(t.yDvh.toFixed(2))},`,
      `  widthVw: ${Number(t.widthVw.toFixed(2))},`,
      `  heightVw: ${Number(t.heightVw.toFixed(2))},`,
      `  blur: ${Number(t.blur.toFixed(2))},`,
      `  opacity: ${Number(t.opacity.toFixed(3))},`,
      oklchSnippet('yes', t.yes),
      oklchSnippet('nope', t.nope),
      `} as const`,
    ].join('\n')
  }, [mobileTune])

  const value = useMemo(
    () => ({
      tune,
      isDesktop,
      mobileTune,
      setTune,
      setYes,
      setNope,
      reset,
      previewSide,
      setPreviewSide,
      previewIntensity,
      setPreviewIntensity,
      setLive,
      subscribeLive,
      getLive,
      pasteSnippet,
    }),
    [
      tune,
      isDesktop,
      mobileTune,
      setTune,
      setYes,
      setNope,
      reset,
      previewSide,
      previewIntensity,
      setPreviewIntensity,
      setLive,
      subscribeLive,
      getLive,
      pasteSnippet,
    ],
  )

  return (
    <SwipeCircleDebugContext.Provider value={value}>
      {children}
    </SwipeCircleDebugContext.Provider>
  )
}

/** Active viewport tune + optional preview — falls back to defaults when provider is absent. */
export function useSwipeCircleTune(): {
  tune: SwipeCircleTune
  isDesktop: boolean
  previewSide: 'off' | 'like' | 'nope'
  previewIntensity: number
} {
  const ctx = useContext(SwipeCircleDebugContext)
  const fallbackDesktop = isSwipeCircleDesktop()
  const fallback = fallbackDesktop
    ? defaultSwipeCircleForDevice('desktop')
    : defaultSwipeCircleForDevice('mobile')
  return {
    tune: ctx?.tune ?? fallback,
    isDesktop: ctx?.isDesktop ?? fallbackDesktop,
    previewSide: ctx?.previewSide ?? 'off',
    previewIntensity: ctx?.previewIntensity ?? 0,
  }
}

/** Subscribe to live swipe intensity (SwipeCircle only — not the deck). */
export function useSwipeCircleLiveIntensity(): LiveIntensity {
  const ctx = useContext(SwipeCircleDebugContext)
  const subscribe = ctx?.subscribeLive
  const getLive = ctx?.getLive

  return useSyncExternalStore(
    subscribe ?? ((() => () => {}) as (onStoreChange: () => void) => () => void),
    getLive ?? (() => EMPTY_LIVE),
    () => EMPTY_LIVE,
  )
}

/** Publish live swipe intensity for the page-level circle (no-op without provider). */
export function useSwipeCircleLivePublisher() {
  const ctx = useContext(SwipeCircleDebugContext)
  return ctx?.setLive ?? (() => {})
}
