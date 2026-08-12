import { useEffect, useState } from 'react'
import {
  DESKTOP_MAX_VISIBLE,
  DESKTOP_VISIBILITY,
  MOBILE_MAX_VISIBLE,
  MOBILE_VISIBILITY,
  type VisibilityLimits,
} from '../lib/carouselLayout'

const DESKTOP_MQ = '(hover: hover) and (pointer: fine)'

export type DesktopCarouselState = {
  isDesktop: boolean
  maxVisible: number
  limits: VisibilityLimits
}

/**
 * Desktop: load at most 20 cards in the stage (finite, no infinite wrap).
 * Mobile keeps a lighter 5-card window.
 */
export function useDesktopCarousel(): DesktopCarouselState {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia(DESKTOP_MQ).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return {
    isDesktop,
    maxVisible: isDesktop ? DESKTOP_MAX_VISIBLE : MOBILE_MAX_VISIBLE,
    limits: isDesktop ? DESKTOP_VISIBILITY : MOBILE_VISIBILITY,
  }
}
