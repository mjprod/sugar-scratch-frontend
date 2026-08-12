import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ScrubSpeedSample = {
  /** Instantaneous horizontal pointer speed (px/ms). */
  currentPxPerMs: number
  /** Peak horizontal speed during the active scrub gesture (px/ms). */
  peakPxPerMs: number
  /** Same values in px/s for easier reading. */
  currentPxPerSec: number
  peakPxPerSec: number
  /** Gesture mode while sampling. */
  mode: 'idle' | 'tilt' | 'flip' | 'vertical' | 'browse'
  /** True while a pointer is actively scrubbing. */
  active: boolean
}

const IDLE_SCRUB: ScrubSpeedSample = {
  currentPxPerMs: 0,
  peakPxPerMs: 0,
  currentPxPerSec: 0,
  peakPxPerSec: 0,
  mode: 'idle',
  active: false,
}

type ActiveCardContextValue = {
  activeCardId: string | null
  setActiveCardId: (id: string | null) => void
  toggleActiveCard: (id: string) => void
  scrubSpeed: ScrubSpeedSample
  reportScrubSpeed: (sample: Partial<ScrubSpeedSample>) => void
  resetScrubSpeed: () => void
}

const ActiveCardContext = createContext<ActiveCardContextValue | null>(null)

export function ActiveCardProvider({
  children,
  initialActiveCardId = null,
}: {
  children: ReactNode
  /** Seed active card before first paint (avoids post-mount focus jump). */
  initialActiveCardId?: string | null
}) {
  const [activeCardId, setActiveCardId] = useState<string | null>(
    initialActiveCardId,
  )
  const [scrubSpeed, setScrubSpeed] = useState<ScrubSpeedSample>(IDLE_SCRUB)

  const toggleActiveCard = useCallback((id: string) => {
    setActiveCardId((current) => (current === id ? null : id))
  }, [])

  const reportScrubSpeed = useCallback((sample: Partial<ScrubSpeedSample>) => {
    setScrubSpeed((prev) => {
      const currentPxPerMs =
        typeof sample.currentPxPerMs === 'number'
          ? sample.currentPxPerMs
          : prev.currentPxPerMs
      const peakPxPerMs =
        typeof sample.peakPxPerMs === 'number'
          ? sample.peakPxPerMs
          : Math.max(prev.peakPxPerMs, currentPxPerMs)
      return {
        currentPxPerMs,
        peakPxPerMs,
        currentPxPerSec: currentPxPerMs * 1000,
        peakPxPerSec: peakPxPerMs * 1000,
        mode: sample.mode ?? prev.mode,
        active: sample.active ?? prev.active,
      }
    })
  }, [])

  const resetScrubSpeed = useCallback(() => {
    setScrubSpeed(IDLE_SCRUB)
  }, [])

  const value = useMemo(
    () => ({
      activeCardId,
      setActiveCardId,
      toggleActiveCard,
      scrubSpeed,
      reportScrubSpeed,
      resetScrubSpeed,
    }),
    [
      activeCardId,
      toggleActiveCard,
      scrubSpeed,
      reportScrubSpeed,
      resetScrubSpeed,
    ]
  )

  return (
    <ActiveCardContext.Provider value={value}>{children}</ActiveCardContext.Provider>
  )
}

export function useActiveCard() {
  const context = useContext(ActiveCardContext)
  if (!context) {
    throw new Error('useActiveCard must be used within ActiveCardProvider')
  }
  return context
}
