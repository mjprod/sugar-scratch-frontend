import { useCallback, useEffect, useRef, useState } from 'react'
import { FAN_START_DELAY_MS, type RevealPhase } from '../lib/revealTiming'

export type UseRevealSequenceResult = {
  phase: RevealPhase
  runId: number
  packPlaying: boolean
  packFinished: boolean
  fanActive: boolean
  fanFinished: boolean
  packBehindFan: boolean
  packBlurPx: number
  showPack: boolean
  showFan: boolean
  showPlay: boolean
  playSequence: boolean
  startReveal: () => void
  handleReplay: () => void
  handleSequenceComplete: () => void
  handlePackBehindFan: () => void
  handlePackBlurChange: (blurPx: number) => void
  handleFanComplete: () => void
  reset: () => void
}

/**
 * Shared pack-open phase machine used by RevealExperience and Packs coverflow.
 * Pack track + fan track are decoupled; fan starts after FAN_START_DELAY_MS.
 */
export function useRevealSequence(options?: {
  /** Auto-start shortly after mount / when autoStartKey changes. */
  autoStart?: boolean
  autoStartKey?: string | number | null
  autoStartDelayMs?: number
}): UseRevealSequenceResult {
  const {
    autoStart = false,
    autoStartKey = null,
    autoStartDelayMs = 120,
  } = options ?? {}

  const [phase, setPhase] = useState<RevealPhase>('idle')
  const [runId, setRunId] = useState(0)
  const [packPlaying, setPackPlaying] = useState(false)
  const [fanActive, setFanActive] = useState(false)
  const [packFinished, setPackFinished] = useState(false)
  const [fanFinished, setFanFinished] = useState(false)
  const [packBehindFan, setPackBehindFan] = useState(false)
  const [packBlurPx, setPackBlurPx] = useState(0)
  const autoStartedRef = useRef(false)
  const fanTimerRef = useRef<number | null>(null)

  const clearFanTimer = useCallback(() => {
    if (fanTimerRef.current != null) {
      window.clearTimeout(fanTimerRef.current)
      fanTimerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearFanTimer()
    autoStartedRef.current = false
    setPhase('idle')
    setPackPlaying(false)
    setPackFinished(false)
    setFanActive(false)
    setFanFinished(false)
    setPackBehindFan(false)
    setPackBlurPx(0)
  }, [clearFanTimer])

  const startReveal = useCallback(() => {
    clearFanTimer()
    setPhase('revealing')
    setPackPlaying(true)
    setPackFinished(false)
    setFanActive(false)
    setFanFinished(false)
    setPackBehindFan(false)
    setPackBlurPx(0)
    setRunId((n) => n + 1)

    fanTimerRef.current = window.setTimeout(() => {
      setFanActive(true)
    }, FAN_START_DELAY_MS)
  }, [clearFanTimer])

  const handleSequenceComplete = useCallback(() => {
    setPackPlaying(false)
    setPackFinished(true)
  }, [])

  const handlePackBehindFan = useCallback(() => {
    setPackBehindFan(true)
  }, [])

  const handlePackBlurChange = useCallback((blurPx: number) => {
    setPackBlurPx(blurPx)
  }, [])

  const handleFanComplete = useCallback(() => {
    setFanFinished(true)
    setPhase('complete')
  }, [])

  const handleReplay = useCallback(() => {
    autoStartedRef.current = false
    clearFanTimer()
    setPhase('idle')
    setPackPlaying(false)
    setPackFinished(false)
    setFanActive(false)
    setFanFinished(false)
    setPackBehindFan(false)
    setPackBlurPx(0)
    window.setTimeout(() => {
      if (!autoStartedRef.current) {
        autoStartedRef.current = true
        startReveal()
      }
    }, 40)
  }, [clearFanTimer, startReveal])

  useEffect(() => () => clearFanTimer(), [clearFanTimer])

  useEffect(() => {
    if (!autoStart || autoStartKey == null) return
    autoStartedRef.current = false
    const t = window.setTimeout(() => {
      if (autoStartedRef.current) return
      autoStartedRef.current = true
      startReveal()
    }, autoStartDelayMs)
    return () => window.clearTimeout(t)
  }, [autoStart, autoStartDelayMs, autoStartKey, startReveal])

  const playSequence = packPlaying
  const showPack = phase !== 'idle' || packPlaying || packFinished
  const showFan = phase !== 'idle'
  const showPlay = phase === 'complete'

  return {
    phase,
    runId,
    packPlaying,
    packFinished,
    fanActive,
    fanFinished,
    packBehindFan,
    packBlurPx,
    showPack,
    showFan,
    showPlay,
    playSequence,
    startReveal,
    handleReplay,
    handleSequenceComplete,
    handlePackBehindFan,
    handlePackBlurChange,
    handleFanComplete,
    reset,
  }
}
