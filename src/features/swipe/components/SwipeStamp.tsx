import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react'
import { COMMIT_FINISH_MS, type StampTransform } from '../constants/swipeFeedback'

type SwipeStampProps = {
  type: 'like' | 'nope'
  /** 0–1 lottie playhead (scrubbed by drag curve). */
  progress: number
  /** Independent drag-linked pose (full swipe can be 100% travel). */
  transform: StampTransform
  /**
   * scrub  — playhead follows progress (paused, no loop)
   * finish — commit path (see falling / finishMs)
   * hidden — reset to frame 0, stay mounted
   */
  mode?: 'scrub' | 'finish' | 'hidden'
  /** Bumps on each commit so finish/reset cycles cannot stick. */
  finishKey?: number
  /**
   * While false, keep scrubbing the remaining sequence after commit.
   * When true, freeze and run the CSS exit (same path for LIKE + NOPE).
   */
  falling?: boolean
  /** Override CSS exit duration (ms). Defaults to COMMIT_FINISH_MS[type]. */
  finishMs?: number
  onComplete?: () => void
}

const LOTTIE_SRC = {
  like: '/lottie/like.lottie',
  nope: '/lottie/dislike.lottie',
} as const

/** Keep in sync with CSS commit animation durations. */
const FINISH_MS = COMMIT_FINISH_MS

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/** Soft-step so the stamp fades in early in the drag. */
function opacityFromProgress(progress: number) {
  const t = clamp01(progress)
  const u = clamp01((t - 0.04) / 0.4)
  return u * u * (3 - 2 * u)
}

function cssTransform({ y, rot, scale }: StampTransform) {
  // -50% X keeps the container centered on left:50% through scale/rotate.
  return `translate3d(-50%, ${y}dvh, 0) rotate(${rot}deg) scale(${scale})`
}

function cssFilter(blur: number) {
  const b = Math.max(0, blur)
  return b > 0.01 ? `blur(${b}px)` : 'none'
}

function frameForProgress(player: DotLottie, progress: number) {
  const total = player.totalFrames
  if (!Number.isFinite(total) || total <= 1) return 0
  return clamp01(progress) * (total - 1)
}

const REST_TRANSFORM: StampTransform = { y: 0, rot: 0, scale: 1, opacity: 0, blur: 0 }

export function SwipeStamp({
  type,
  progress,
  transform,
  mode = 'scrub',
  finishKey = 0,
  falling = true,
  finishMs: finishMsProp,
  onComplete,
}: SwipeStampProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<DotLottie | null>(null)
  const finishStartedRef = useRef(false)
  const finishedRef = useRef(false)
  const progressRef = useRef(progress)
  const onCompleteRef = useRef(onComplete)
  const [ready, setReady] = useState(false)

  progressRef.current = progress

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const configurePlayer = useCallback((player: DotLottie) => {
    player.setLoop(false)
    try {
      player.setLoopCount(0)
    } catch {
      // older runtimes may not expose setLoopCount
    }
  }, [])

  const scrubTo = useCallback(
    (player: DotLottie, value: number) => {
      if (!player.isLoaded) return
      configurePlayer(player)
      if (player.isPlaying) player.pause()
      player.setFrame(frameForProgress(player, value))
    },
    [configurePlayer],
  )

  const hardResetPlayer = useCallback(() => {
    const player = playerRef.current
    if (!player?.isLoaded) return
    configurePlayer(player)
    if (player.isPlaying) player.pause()
    // stop() returns to start on dotlottie; fall back to frame 0.
    try {
      player.stop()
    } catch {
      player.setFrame(0)
    }
    player.setFrame(0)
  }, [configurePlayer])

  const hardResetDom = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    // Drop any filled commit animation matrix before the next drag.
    el.style.animation = 'none'
    el.style.transform = cssTransform(REST_TRANSFORM)
    el.style.opacity = '0'
    el.style.filter = 'none'
    // Force reflow so a later animation can restart cleanly.
    void el.offsetWidth
    el.style.animation = ''
  }, [])

  const handlePlayer = useCallback(
    (player: DotLottie | null) => {
      playerRef.current = player
      if (!player) {
        setReady(false)
        return
      }

      const markReady = () => {
        configurePlayer(player)
        if (player.isPlaying) player.pause()
        scrubTo(player, progressRef.current)
        setReady(true)
      }

      if (player.isLoaded) markReady()
      else player.addEventListener('load', markReady)
    },
    [configurePlayer, scrubTo],
  )

  // Post-commit sequence: keep scrubbing while the deck tweens remaining frames.
  const scrubDuringFinish = mode === 'finish' && !falling

  // Scrub playhead while dragging, or while finishing the remaining sequence.
  useEffect(() => {
    if (mode !== 'scrub' && !scrubDuringFinish) return
    if (mode === 'scrub') {
      finishStartedRef.current = false
      finishedRef.current = false
    }
    const player = playerRef.current
    if (!player?.isLoaded) return
    scrubTo(player, progress)
  }, [mode, progress, ready, scrubTo, scrubDuringFinish])

  // Commit exit waits until `falling` so the reserved 75→100% tail can play first.
  useEffect(() => {
    if (mode !== 'finish') return
    if (!falling) {
      // Sequence phase — parent still drives progress/transform; no CSS exit yet.
      finishStartedRef.current = false
      finishedRef.current = false
      const player = playerRef.current
      if (player?.isLoaded) scrubTo(player, progressRef.current)
      return
    }

    finishedRef.current = false
    finishStartedRef.current = false

    const el = rootRef.current
    let cssDone = false
    let settled = false

    const settle = () => {
      if (settled || !cssDone) return
      settled = true
      finishedRef.current = true
      hardResetPlayer()
      hardResetDom()
      onCompleteRef.current?.()
    }

    const markCssDone = () => {
      cssDone = true
      settle()
    }

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.target !== el) return
      markCssDone()
    }

    // If release pose is already gone, don't keep a long post-swipe hold.
    const releaseOpacity = clamp01(transform.opacity ?? 1)
    const baseMs =
      typeof finishMsProp === 'number' && Number.isFinite(finishMsProp)
        ? Math.max(80, finishMsProp)
        : FINISH_MS[type]
    const finishMs = releaseOpacity <= 0.02 ? 120 : baseMs
    const cssTimer = window.setTimeout(markCssDone, finishMs + 40)
    el?.addEventListener('animationend', onAnimationEnd)

    // Hold the exact drag playhead — never call play() after release.
    const freeze = () => {
      if (finishStartedRef.current) return
      const player = playerRef.current
      if (!player?.isLoaded) return
      finishStartedRef.current = true
      configurePlayer(player)
      if (player.isPlaying) player.pause()
      scrubTo(player, progressRef.current)
      if (player.isPlaying) player.pause()
      try {
        player.setLoop(false)
      } catch {
        // ignore
      }
    }

    const player = playerRef.current
    if (player?.isLoaded) {
      freeze()
    } else if (player) {
      player.addEventListener('load', freeze)
    }

    return () => {
      window.clearTimeout(cssTimer)
      el?.removeEventListener('animationend', onAnimationEnd)
      const p = playerRef.current
      p?.removeEventListener('load', freeze)
      if (p?.isPlaying) p.pause()
    }
  }, [
    mode,
    finishKey,
    type,
    ready,
    falling,
    finishMsProp,
    transform.opacity,
    configurePlayer,
    scrubTo,
    hardResetPlayer,
    hardResetDom,
  ])

  // Leaving finish/hidden: always restore rest pose + frame 0 for the next card.
  useEffect(() => {
    if (mode === 'finish') return
    finishStartedRef.current = false
    if (mode === 'hidden') {
      finishedRef.current = false
      hardResetPlayer()
      hardResetDom()
    }
  }, [mode, finishKey, hardResetPlayer, hardResetDom])

  const active = mode === 'finish' || mode === 'scrub'
  const transformActive =
    Math.abs(transform.y) > 0.05 ||
    Math.abs(transform.rot) > 0.5 ||
    transform.scale > 1.02 ||
    transform.opacity > 0.02 ||
    transform.blur > 0.05

  // Prefer keyframed opacity; fall back to legacy soft fade for like if missing.
  const keyOpacity = clamp01(transform.opacity ?? 1)
  const fallbackLike =
    mode === 'finish' ? 1 : mode === 'scrub' ? opacityFromProgress(progress) : 0
  const visualOpacity =
    mode === 'finish'
      ? keyOpacity
      : mode === 'scrub'
        ? keyOpacity > 0.001
          ? keyOpacity
          : type === 'like'
            ? fallbackLike
            : keyOpacity
        : 0

  const show =
    mode === 'finish'
      ? keyOpacity > 0.01 || transformActive || scrubDuringFinish
      : mode === 'scrub' && (visualOpacity > 0.01 || progress > 0.001 || transformActive)

  const runCssExit = mode === 'finish' && falling
  const resolvedFallMs =
    typeof finishMsProp === 'number' && Number.isFinite(finishMsProp)
      ? Math.max(80, finishMsProp)
      : FINISH_MS[type]

  const finishStyle = {
    // Keep the exact release look — do not pop back to full opacity.
    opacity: clamp01(transform.opacity ?? 1),
    filter: cssFilter(transform.blur ?? 0),
    ['--stamp-y' as string]: `${transform.y}dvh`,
    ['--stamp-rot' as string]: `${transform.rot}deg`,
    ['--stamp-scale' as string]: `${transform.scale}`,
    ['--stamp-opacity' as string]: `${clamp01(transform.opacity ?? 1)}`,
    ['--stamp-blur' as string]: `${Math.max(0, transform.blur ?? 0)}px`,
    // Clear any inline transform from hardReset so CSS keyframes own the pose.
    transform: undefined,
    // Velocity-scaled fall duration (CSS default remains the fallback).
    animationDuration: `${resolvedFallMs}ms`,
  } as CSSProperties

  // Sequence phase after commit: still parent-driven pose, no CSS exit yet.
  const sequenceFinishStyle = {
    opacity: show ? visualOpacity : 0,
    filter: cssFilter(transform.blur ?? 0),
    transform: cssTransform(transform),
    visibility: active && show ? 'visible' : 'hidden',
    pointerEvents: 'none',
    animation: 'none',
  } as CSSProperties

  const idleStyle =
    mode === 'hidden'
      ? ({
          opacity: 0,
          filter: 'none',
          transform: cssTransform(REST_TRANSFORM),
          visibility: 'hidden',
          pointerEvents: 'none',
          animation: 'none',
        } as CSSProperties)
      : ({
          opacity: show ? visualOpacity : 0,
          filter: cssFilter(transform.blur ?? 0),
          transform: cssTransform(transform),
          visibility: active && show ? 'visible' : 'hidden',
          pointerEvents: 'none',
          animation: 'none',
        } as CSSProperties)

  const style =
    mode === 'finish'
      ? runCssExit
        ? finishStyle
        : sequenceFinishStyle
      : idleStyle

  return (
    <div
      ref={rootRef}
      className={[
        'swipe-stamp',
        `swipe-stamp--${type}`,
        runCssExit ? 'swipe-stamp--committed' : 'swipe-stamp--preview',
        show ? 'is-visible' : 'is-hidden',
      ].join(' ')}
      style={style}
      aria-hidden="true"
    >
      <DotLottieReact
        src={LOTTIE_SRC[type]}
        autoplay={false}
        loop={false}
        dotLottieRefCallback={handlePlayer}
        className="swipe-stamp__lottie"
      />
    </div>
  )
}
