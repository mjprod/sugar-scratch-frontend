import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  SWIPE_BURST_FULL_COUNT,
  SWIPE_BURST_WINDOW_MS,
} from '../lib/carouselLayout'

type DragOffsetListener = (offset: number) => void
type ScrubbingListener = (scrubbing: boolean) => void

type CarouselContextValue = {
  /**
   * Live horizontal drag offset while scrubbing.
   * Kept as a ref so pointer-move does not re-render React.
   */
  getDragOffsetPx: () => number
  /** Subscribe to scrub updates (imperative consumers: pill, rAF loops). */
  subscribeDragOffset: (listener: DragOffsetListener) => () => void
  /**
   * True while the deck is being scrubbed (card-row drag OR dots hold-scrub).
   * Used to pause video decode/playback and free GPU/video memory mid-gesture.
   */
  isScrubbing: boolean
  /** Imperative read for non-React consumers (video pause helpers). */
  isCarouselScrubbing: () => boolean
  /** Subscribe without forcing React re-renders on every start/stop. */
  subscribeScrubbing: (listener: ScrubbingListener) => () => void
  setCarouselScrubbing: (scrubbing: boolean) => void
  isDragging: boolean
  isCarouselDragging: () => boolean
  consumeCarouselDrag: () => boolean
  setCarouselDragging: (dragging: boolean) => void
  setDragOffsetPx: (offset: number) => void
  markCarouselDragged: () => void
  /**
   * Record a discrete stage page (±1 card). Rapid repeats raise swipe intensity
   * so SlideDeck settles snappier — still one card per swipe.
   */
  registerStagePage: () => void
  /** 0 = isolated swipe, 1 = full rapid-swipe burst. Ref-only (no re-render). */
  getSwipeIntensity: () => number
}

const CarouselContext = createContext<CarouselContextValue | null>(null)

export function CarouselProvider({ children }: { children: ReactNode }) {
  const dragging = useRef(false)
  const dragged = useRef(false)
  const dragClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref-only scrub value — avoids re-rendering CardCarousel/SlideDeck every move.
  const dragOffsetPxRef = useRef(0)
  const dragListenersRef = useRef(new Set<DragOffsetListener>())
  // Unified scrubbing flag for card-row drag + dots hold-scrub.
  const scrubbingRef = useRef(false)
  const scrubListenersRef = useRef(new Set<ScrubbingListener>())
  // Recent stage-page timestamps for rapid-swipe intensity (ref-only).
  const stagePageTimesRef = useRef<number[]>([])
  const swipeIntensityRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const clearDragFlagSoon = useCallback(() => {
    // Suppress only the click that may fire from the same pointerup as a scrub.
    // If no click arrives, clear so the *next* intentional click still activates.
    if (dragClearTimer.current) clearTimeout(dragClearTimer.current)
    dragClearTimer.current = setTimeout(() => {
      dragged.current = false
      dragClearTimer.current = null
    }, 80)
  }, [])

  const setCarouselScrubbing = useCallback((value: boolean) => {
    if (scrubbingRef.current === value) return
    scrubbingRef.current = value
    setIsScrubbing(value)
    scrubListenersRef.current.forEach((listener) => listener(value))
  }, [])

  const setCarouselDragging = useCallback(
    (value: boolean) => {
      dragging.current = value
      setIsDragging(value)
      // Card-row drag is a scrub for video pause purposes.
      setCarouselScrubbing(value)
      // Drag ended — arm a short window for same-gesture click suppression.
      if (!value) clearDragFlagSoon()
    },
    [clearDragFlagSoon, setCarouselScrubbing]
  )

  const setDragOffsetPx = useCallback((offset: number) => {
    if (dragOffsetPxRef.current === offset) return
    dragOffsetPxRef.current = offset
    // Notify imperative listeners only — no React state.
    dragListenersRef.current.forEach((listener) => listener(offset))
  }, [])

  const getDragOffsetPx = useCallback(() => dragOffsetPxRef.current, [])

  const subscribeDragOffset = useCallback((listener: DragOffsetListener) => {
    dragListenersRef.current.add(listener)
    return () => {
      dragListenersRef.current.delete(listener)
    }
  }, [])

  const isCarouselScrubbing = useCallback(() => scrubbingRef.current, [])

  const subscribeScrubbing = useCallback((listener: ScrubbingListener) => {
    scrubListenersRef.current.add(listener)
    // Push current value immediately so late subscribers sync without a re-render.
    listener(scrubbingRef.current)
    return () => {
      scrubListenersRef.current.delete(listener)
    }
  }, [])

  const markCarouselDragged = useCallback(() => {
    dragged.current = true
    clearDragFlagSoon()
  }, [clearDragFlagSoon])

  const isCarouselDragging = useCallback(() => dragging.current, [])

  const consumeCarouselDrag = useCallback(() => {
    if (!dragged.current) return false
    dragged.current = false
    if (dragClearTimer.current) {
      clearTimeout(dragClearTimer.current)
      dragClearTimer.current = null
    }
    return true
  }, [])

  const registerStagePage = useCallback(() => {
    const now = performance.now()
    const recent = stagePageTimesRef.current.filter(
      (t) => now - t <= SWIPE_BURST_WINDOW_MS
    )
    recent.push(now)
    stagePageTimesRef.current = recent
    // 1 isolated page ≈ low intensity; cluster toward SWIPE_BURST_FULL_COUNT → 1.
    const intensity = Math.max(
      0,
      Math.min(1, (recent.length - 1) / Math.max(1, SWIPE_BURST_FULL_COUNT - 1))
    )
    // Ease up fast, decay a bit slower so a short pause still feels lively.
    swipeIntensityRef.current = Math.max(
      intensity,
      swipeIntensityRef.current * 0.72
    )
  }, [])

  const getSwipeIntensity = useCallback(() => {
    // Pure read from the last registerStagePage sample + time-based decay.
    // Safe to call many times per frame (SlideDeck springs) without double-decay.
    const now = performance.now()
    const recent = stagePageTimesRef.current
    const newest = recent.length > 0 ? recent[recent.length - 1]! : 0
    if (!newest) return 0
    const age = now - newest
    if (age > SWIPE_BURST_WINDOW_MS) {
      swipeIntensityRef.current = 0
      return 0
    }
    // Hold full burst briefly, then ease down over the rest of the window.
    const holdMs = 140
    if (age <= holdMs) return swipeIntensityRef.current
    const fade = 1 - (age - holdMs) / Math.max(1, SWIPE_BURST_WINDOW_MS - holdMs)
    return swipeIntensityRef.current * Math.max(0, fade)
  }, [])

  const value = useMemo(
    () => ({
      getDragOffsetPx,
      subscribeDragOffset,
      isScrubbing,
      isCarouselScrubbing,
      subscribeScrubbing,
      setCarouselScrubbing,
      isDragging,
      isCarouselDragging,
      consumeCarouselDrag,
      setCarouselDragging,
      setDragOffsetPx,
      markCarouselDragged,
      registerStagePage,
      getSwipeIntensity,
    }),
    [
      getDragOffsetPx,
      subscribeDragOffset,
      isScrubbing,
      isCarouselScrubbing,
      subscribeScrubbing,
      setCarouselScrubbing,
      isDragging,
      isCarouselDragging,
      consumeCarouselDrag,
      setCarouselDragging,
      setDragOffsetPx,
      markCarouselDragged,
      registerStagePage,
      getSwipeIntensity,
    ]
  )

  return (
    <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>
  )
}

export function useCarousel() {
  const context = useContext(CarouselContext)
  if (!context) {
    throw new Error('useCarousel must be used within CarouselProvider')
  }
  return context
}
