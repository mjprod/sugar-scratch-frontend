import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'

/**
 * Global DeviceOrientation permission + live values.
 *
 * - Permission requested once per browser tab session (sessionStorage)
 * - One shared `deviceorientation` listener after grant
 * - Components consume via useMotion() — no per-page listeners
 */

export type MotionPermission = 'unknown' | 'granted' | 'denied'

export type MotionValues = {
  /** Compass heading (deg), or 0 if unavailable. */
  alpha: number
  /** Front/back tilt (deg). */
  beta: number
  /** Left/right tilt (deg). */
  gamma: number
  absolute: boolean
  /** True when at least one orientation field was a real number this frame. */
  hasSample: boolean
  /** Wall-clock ms of last sample. */
  updatedAt: number
}

const DEFAULT_VALUES: MotionValues = {
  alpha: 0,
  beta: 0,
  gamma: 0,
  absolute: false,
  hasSample: false,
  updatedAt: 0,
}

const SESSION_KEY = 'holo-motion-permission-v1'
/** User opt-in preference (independent of OS permission). */
const ENABLED_KEY = 'holo-motion-enabled-v1'

type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

type MotionContextValue = {
  /** Current permission: unknown | granted | denied */
  permission: MotionPermission
  /** False when DeviceOrientationEvent is missing entirely. */
  supported: boolean
  /**
   * User preference: apply phone tilt to active cards until toggled off.
   * Survives card switches for the browser session.
   */
  enabled: boolean
  /**
   * Request motion permission (must run from a user gesture on iOS).
   * Returns true if granted (or auto-granted on non-iOS).
   */
  requestPermission: () => Promise<boolean>
  /**
   * Toggle user opt-in. Enabling also requests permission when needed.
   * Disabling does not revoke session permission (so re-enable won't re-prompt).
   */
  setEnabled: (next: boolean) => Promise<boolean>
  /** Convenience: flip `enabled` (requests permission if turning on). */
  toggleEnabled: () => Promise<boolean>
  /** Latest orientation sample (defaults to zeros when unsupported / no samples). */
  values: MotionValues
  /**
   * Imperative subscription for high-frequency consumers that want to avoid
   * React re-renders every orientation frame. Returns unsubscribe.
   */
  subscribe: (listener: (values: MotionValues) => void) => () => void
  /** Always-current ref (same object identity for the provider lifetime). */
  valuesRef: MutableRefObject<MotionValues>
}

const MotionContext = createContext<MotionContextValue | null>(null)

function readSessionPermission(): MotionPermission | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw === 'granted' || raw === 'denied' || raw === 'unknown') return raw
  } catch {
    // private mode / blocked storage
  }
  return null
}

function writeSessionPermission(permission: MotionPermission) {
  try {
    sessionStorage.setItem(SESSION_KEY, permission)
  } catch {
    // ignore
  }
}

function readSessionEnabled(): boolean {
  try {
    return sessionStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function writeSessionEnabled(enabled: boolean) {
  try {
    sessionStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}

function isOrientationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined'
}

function needsOrientationPermission(): boolean {
  if (typeof window === 'undefined') return false
  const Ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor | undefined
  return typeof Ctor?.requestPermission === 'function'
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const supported = isOrientationSupported()
  const [permission, setPermission] = useState<MotionPermission>(() => {
    if (!supported) return 'denied'
    // Non-iOS browsers never prompt — treat as granted up front.
    if (!needsOrientationPermission()) return 'granted'
    return readSessionPermission() ?? 'unknown'
  })
  // User opt-in remembered for the tab session (all active cards share this).
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (!supported) return false
    return readSessionEnabled()
  })
  const [values, setValues] = useState<MotionValues>(DEFAULT_VALUES)

  const valuesRef = useRef<MotionValues>(DEFAULT_VALUES)
  const listenersRef = useRef(new Set<(v: MotionValues) => void>())
  const permissionRef = useRef(permission)
  const enabledRef = useRef(enabled)
  const rafPublishRef = useRef<number | null>(null)
  const pendingPublishRef = useRef<MotionValues | null>(null)

  useEffect(() => {
    permissionRef.current = permission
  }, [permission])
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const publish = useCallback((next: MotionValues) => {
    valuesRef.current = next
    pendingPublishRef.current = next
    // Coalesce React state updates to one per animation frame.
    if (rafPublishRef.current !== null) return
    rafPublishRef.current = requestAnimationFrame(() => {
      rafPublishRef.current = null
      const sample = pendingPublishRef.current
      if (!sample) return
      setValues(sample)
      for (const listener of listenersRef.current) {
        listener(sample)
      }
    })
  }, [])

  const subscribe = useCallback((listener: (v: MotionValues) => void) => {
    listenersRef.current.add(listener)
    // Push current sample immediately so late subscribers aren't stuck at zero.
    listener(valuesRef.current)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  // Single global listener while permission is granted.
  useEffect(() => {
    if (!supported || permission !== 'granted' || typeof window === 'undefined') {
      return
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const alpha =
        typeof event.alpha === 'number' && !Number.isNaN(event.alpha)
          ? event.alpha
          : 0
      const beta =
        typeof event.beta === 'number' && !Number.isNaN(event.beta)
          ? event.beta
          : 0
      const gamma =
        typeof event.gamma === 'number' && !Number.isNaN(event.gamma)
          ? event.gamma
          : 0
      const hasSample =
        (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) ||
        (typeof event.beta === 'number' && !Number.isNaN(event.beta)) ||
        (typeof event.gamma === 'number' && !Number.isNaN(event.gamma))

      publish({
        alpha,
        beta,
        gamma,
        absolute: Boolean(event.absolute),
        hasSample,
        updatedAt: performance.now(),
      })
    }

    window.addEventListener('deviceorientation', handleOrientation, true)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
      if (rafPublishRef.current !== null) {
        cancelAnimationFrame(rafPublishRef.current)
        rafPublishRef.current = null
      }
    }
  }, [permission, publish, supported])

  // Non-iOS: ensure session is marked granted so remounts stay quiet.
  useEffect(() => {
    if (!supported) return
    if (!needsOrientationPermission() && permission === 'granted') {
      writeSessionPermission('granted')
    }
  }, [permission, supported])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported || typeof window === 'undefined') {
      setPermission('denied')
      writeSessionPermission('denied')
      return false
    }

    // Already decided this session.
    if (permissionRef.current === 'granted') return true
    // Allow retry from denied via explicit user gesture.
    // (iOS may still re-prompt depending on settings.)

    const Ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor | undefined
    if (!Ctor) {
      setPermission('denied')
      writeSessionPermission('denied')
      return false
    }

    try {
      if (typeof Ctor.requestPermission === 'function') {
        // Must be called from a user gesture on iOS Safari.
        const result = await Ctor.requestPermission()
        if (result !== 'granted') {
          setPermission('denied')
          writeSessionPermission('denied')
          return false
        }
      }

      setPermission('granted')
      writeSessionPermission('granted')
      return true
    } catch {
      setPermission('denied')
      writeSessionPermission('denied')
      return false
    }
  }, [supported])

  const setEnabled = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (!next) {
        setEnabledState(false)
        writeSessionEnabled(false)
        // Clear last sample so consumers don't keep a stale pose.
        publish(DEFAULT_VALUES)
        return true
      }

      if (!supported) {
        setEnabledState(false)
        writeSessionEnabled(false)
        return false
      }

      const granted = await requestPermission()
      if (!granted) {
        setEnabledState(false)
        writeSessionEnabled(false)
        return false
      }

      setEnabledState(true)
      writeSessionEnabled(true)
      return true
    },
    [publish, requestPermission, supported]
  )

  const toggleEnabled = useCallback(async (): Promise<boolean> => {
    return setEnabled(!enabledRef.current)
  }, [setEnabled])

  const value = useMemo<MotionContextValue>(
    () => ({
      permission,
      supported,
      enabled,
      requestPermission,
      setEnabled,
      toggleEnabled,
      values,
      subscribe,
      valuesRef,
    }),
    [
      enabled,
      permission,
      requestPermission,
      setEnabled,
      subscribe,
      supported,
      toggleEnabled,
      values,
    ]
  )

  return (
    <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
  )
}

export function useMotion(): MotionContextValue {
  const ctx = useContext(MotionContext)
  if (!ctx) {
    throw new Error('useMotion must be used within a MotionProvider')
  }
  return ctx
}

/** Safe default for optional trees (tests / story shells). */
export function useMotionOptional(): MotionContextValue | null {
  return useContext(MotionContext)
}
