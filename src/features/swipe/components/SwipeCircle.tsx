import { animated, to, useSpring } from '@react-spring/web'
import { useMemo, useRef } from 'react'
import { formatOklch } from '../constants/swipeCircle'
import {
  useSwipeCircleLiveIntensity,
  useSwipeCircleTune,
} from '../context/SwipeCircleDebugContext'

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/**
 * Soft ellipse anchored to the viewport bottom.
 * Hidden at rest; opacity + OKLCH color track the swipe (yes / nope).
 * Mounted at app root (not inside transformed stage) so fixed + dvh stay true.
 */
export function SwipeCircle() {
  const { tune, previewSide, previewIntensity } = useSwipeCircleTune()
  const { like01: liveLike01, nope01: liveNope01 } = useSwipeCircleLiveIntensity()

  // Remember last active side so the fade-out keeps the correct color.
  const lastSideRef = useRef<'like' | 'nope'>('like')

  const { side, intensity } = useMemo(() => {
    if (previewSide !== 'off') {
      lastSideRef.current = previewSide
      return {
        side: previewSide as 'like' | 'nope',
        intensity: clamp01(previewIntensity),
      }
    }
    const like = clamp01(liveLike01)
    const nope = clamp01(liveNope01)
    if (like < 0.005 && nope < 0.005) {
      return { side: lastSideRef.current, intensity: 0 }
    }
    if (like >= nope) {
      lastSideRef.current = 'like'
      return { side: 'like' as const, intensity: like }
    }
    lastSideRef.current = 'nope'
    return { side: 'nope' as const, intensity: nope }
  }, [liveLike01, liveNope01, previewIntensity, previewSide])

  // 1 = yes, 0 = nope — spring blends only when switching mid-gesture.
  const targetMix = side === 'like' ? 1 : 0

  // Fade-in: bouncy ease-out.
  // Fade-out: still quicker than in, stretched so the glow lingers through promote.
  const spring = useSpring({
    intensity,
    mix: targetMix,
    config:
      intensity <= 0.001
        ? { tension: 140, friction: 28, mass: 1.05, clamp: true }
        : { tension: 210, friction: 14, mass: 0.85 },
  })

  const yes = tune.yes
  const nope = tune.nope

  const style = {
    width: `${tune.widthVw}vw`,
    height: `${tune.heightVw}vw`,
    // Neg y lifts the ellipse; positive sinks it past the bottom edge.
    bottom: `${-tune.yDvh}dvh`,
    filter: tune.blur > 0 ? `blur(${tune.blur}px)` : 'none',
    // Opacity tracks swipe × peak; allow mild overshoot so the bounce reads.
    opacity: spring.intensity.to(
      (v) => Math.min(1.18, Math.max(0, v)) * tune.opacity,
    ),
    background: to([spring.mix], (mix) => {
      // Hard pick once clearly on a side; brief blend only across the zero cross.
      const color = mix >= 0.5 ? yes : nope
      const core = formatOklch(color, 0.95)
      const mid = formatOklch(color, 0.35)
      const edge = formatOklch(color, 0)
      return `radial-gradient(ellipse at center, ${core} 0%, ${mid} 42%, ${edge} 72%)`
    }),
  }

  return (
    <animated.div
      className="swipe-circle"
      style={style}
      aria-hidden="true"
    />
  )
}
