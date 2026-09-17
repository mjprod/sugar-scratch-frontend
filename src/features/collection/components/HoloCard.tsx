// @ts-nocheck
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { animated, to, useSpring } from '@react-spring/web'
import { useNavigate } from 'react-router-dom'
import { useActiveCard } from '../context/ActiveCardContext'
import { useCarousel } from '../context/CarouselContext'
import { useMotion } from '../hooks/useMotion'
import { adjust, clamp, round } from '../lib/math'
import type { HoloEffect } from '../lib/effects'
import {
  DEFAULT_HOLO_TRANSFORM,
  holoTransformToClassNames,
  holoTransformToCssVars,
  mapPointerToBackground,
  mapPointerToBackgroundY,
  normalizeHoloTransform,
  type HoloTransform,
} from '../lib/holoTransform'
import ActiveCardPanel from './ActiveCardPanel'
import {
  CardFaceOverlay,
  type CardFaceOverlayData,
} from '@/shared/ui/CardFaceOverlay'
import {
  PLACEHOLDER_MEDIA_URL,
  type CardFaceOverlayConfig,
} from '../lib/cards'
import {
  shouldNudgeCachedSrcLoad,
  shouldPlayFromDecodePoll,
} from '../lib/faceVideoPlayback'
import { getVideoCardCount } from '../lib/photoSlots'
import { unlockCountdownSound } from '@/features/game/modules/InitialCountdown'
import { useCollectionActions } from '../CollectionActionsContext'

const INTERACT_CONFIG = { tension: 200, friction: 22 }
/** Hero select spring — quick but controlled (lift + 10% scale). */
const ACTIVE_CONFIG = { tension: 200, friction: 26 }
const SNAP_CONFIG = { tension: 50, friction: 14 }
/** Live drag tracking — near-1:1 with the pointer. */
const DRAG_FOLLOW_CONFIG = { tension: 600, friction: 38 }
/** Active pack lift (px up) + scale boost (~10% desktop). */
const ACTIVE_Y_LIFT_PX = 36
const ACTIVE_SCALE = 1.1
/** Mobile: a slightly smaller hero scale so the card doesn't overgrow the stage. */
const ACTIVE_SCALE_MOBILE = 1.02

function getActiveScale() {
  if (typeof window === 'undefined') return ACTIVE_SCALE
  return window.matchMedia('(max-width: 800px)').matches
    ? ACTIVE_SCALE_MOBILE
    : ACTIVE_SCALE
}

type MediaType = 'image' | 'video'

/**
 * Physical vertical drag → activate/deactivate.
 * Pull distance maps 0..1 onto rest ↔ active pose; release commits past threshold.
 */
/** Hero card: pull distance to map rest → open pose. */
const ACTIVATE_DRAG_DISTANCE_HERO_PX = 96
/** Side cards: longer pull so drag-up is less sensitive before commit. */
const ACTIVATE_DRAG_DISTANCE_SIDE_PX = 170
/** Hero commit threshold (fraction of pull) — must pull most of the way. */
const COMMIT_PROGRESS_HERO = 0.72
/** Side cards need a deep pull before catching into hero activate. */
const COMMIT_PROGRESS_SIDE = 0.82
/** Side cards need more vertical intent before locking into pull mode. */
const VERTICAL_LOCK_SIDE_PX = 18
const VERTICAL_LOCK_HERO_PX = 10
const VERTICAL_AXIS_RATIO = 1.15
const TAP_MAX_MOVE_PX = 12
/** Extra travel past the active pose (rubber feel). */
const DRAG_OVERSHOOT = 0.14

const FLIP_SPRING = { tension: 220, friction: 26 }
/** Softer settle after a mobile finger-flip scrub (less snappy than the button flip). */
const FLIP_SCRUB_RELEASE_SPRING = { tension: 110, friction: 28, clamp: true }

/**
 * Active-card scrub tilt — ported from sugar-scracth3dpack CoverFlowCarousel:
 *   MAX_HOVER_YAW = π/5.5  (degree lock)
 *   TILT_SENSITIVITY = 0.11
 * Accumulated scrub is clamped to [-1, 1], then mapped to ±max yaw.
 */
const MAX_HOVER_YAW_RAD = Math.PI / 5.5
const MAX_HOVER_YAW_DEG = (MAX_HOVER_YAW_RAD * 180) / Math.PI
const TILT_SENSITIVITY = 0.11
/**
 * Live follow while scrubbing.
 * `clamp: true` kills spring overshoot past the target — overshoot past max tilt
 * was making Safari/WebKit re-rasterize blend-mode holo and flash a different texture.
 */
const TILT_FOLLOW_CONFIG = { tension: 380, friction: 38, clamp: true }
/** Soft ease back upright on release (3dpack TILT_RETURN feel). */
const TILT_RETURN_CONFIG = { tension: 90, friction: 22, clamp: true }
/** Phone orientation follow — match 3dpack soft catch-up. */
const DEVICE_TILT_FOLLOW_CONFIG = { tension: 120, friction: 26, clamp: true }
const TILT_LOCK_PX = 10
/** Keep foil pointer/background in a Safari-safe band (avoid 0%/100% edge glitches). */
const HOLO_POINTER_MIN = 10
const HOLO_POINTER_MAX = 90

/**
 * Device orientation → card tilt (ported from sugar-scracth3dpack CoverFlowCarousel).
 * Higher range = less sensitive / slower-feeling response.
 */
const DEVICE_TILT_GAMMA_RANGE = 42
const DEVICE_TILT_BETA_RANGE = 36
const MAX_DEVICE_PITCH_RAD = Math.PI / 14
const MAX_DEVICE_PITCH_DEG = (MAX_DEVICE_PITCH_RAD * 180) / Math.PI
/** Lower = smoother/slower catch-up to phone orientation. */
const DEVICE_TILT_SMOOTHING = 0.1

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
/**
 * Horizontal scrub gate:
 *   <  threshold  → degree-locked tilt (scrub)
 *   >= threshold  → full face rotate / flip (swipe)
 * Desktop keeps a higher mouse gate; mobile/touch uses 1.5 px/ms from device tuning.
 */
const ROTATE_SCRUB_SPEED_PX_MS = 3
/** Mobile/touch only (phone motion off): < 0.8 = tilt scrub, >= 0.8 = flip swipe. */
const ROTATE_SCRUB_SPEED_TOUCH_PX_MS = 0.8
/**
 * Mobile/touch with phone motion enabled: much easier flip so finger swipes
 * don't compete with device tilt for the "slow scrub" band.
 * < 0.3 = tilt scrub, >= 0.3 = flip swipe.
 */
const ROTATE_SCRUB_SPEED_TOUCH_MOTION_PX_MS = 0.3
/**
 * Extra promote path on desktop only (mouse can travel far while still "slow").
 * Mobile relies on the speed gate alone so slow long scrubs stay tilt.
 */
const ROTATE_PROMOTE_DISTANCE_PX = 86
/** Touch/coarse pointer: softer foil overlay while tilting. */
const TOUCH_TILT_HOLO_OPACITY = 0.52
/** Temporary: hide the speed/tilt debug HUD. */
const SHOW_TILT_SPEED_DEBUG = false
/** Temporary: swipe-zone paint overlay (off — was confusing hit-testing). */
const SHOW_SWIPE_ZONE_OVERLAY = false
/**
   * Horizontal travel (as a fraction of card width) that maps to a full 180° face
   * flip. Continuous — no auto-complete while dragging.
   */
const ROTATE_FULL_FLIP_WIDTH_FRAC = 0.95
/**
   * Mobile scrub path for a full 180° face flip.
   * Smaller = more sensitive (less travel to complete).
   */
const ROTATE_FULL_FLIP_WIDTH_FRAC_TOUCH = 0.88
/** Motion-on mobile: slightly more sensitive (3D face is visually narrower). */
const ROTATE_FULL_FLIP_WIDTH_FRAC_TOUCH_MOTION = 0.8
/** On release, commit to nearest face past this midpoint. */
const ROTATE_SNAP_MIDPOINT_DEG = 90

function isTouchLikePointer(pointerType?: string) {
  if (pointerType === 'touch' || pointerType === 'pen') return true
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: none), (pointer: coarse)').matches
}

/**
 * Holo blend/filter stacks are currently disabled on ALL browsers.
 * Keep tilt / flip / phone-motion; hide shine/glare foil until restabilized.
 */
function shouldDisableHoloEffects() {
  return true
}

function getRotateSpeedThreshold(
  pointerType?: string,
  motionTiltOn = false
) {
  if (!isTouchLikePointer(pointerType)) return ROTATE_SCRUB_SPEED_PX_MS
  // With device tilt on, finger swipes should flip more easily.
  return motionTiltOn
    ? ROTATE_SCRUB_SPEED_TOUCH_MOTION_PX_MS
    : ROTATE_SCRUB_SPEED_TOUCH_PX_MS
}

function getTiltHoloOpacity(pointerType?: string) {
  if (shouldDisableHoloEffects()) return 0
  return isTouchLikePointer(pointerType) ? TOUCH_TILT_HOLO_OPACITY : 1
}

type SelectDragState = {
  pointerId: number
  startX: number
  startY: number
  /** true once gesture locked to vertical drag (not a tap / not horizontal). */
  vertical: boolean
  /** true once gesture locked to horizontal active-card tilt scrub. */
  tilting: boolean
  /** true once speed-promoted into continuous face-rotate scrub. */
  rotating: boolean
  /** Accumulated scrub in [-1, 1] — the degree-lock unit. */
  scrubTilt: number
  lastScrubX: number
  /** Speed sampling for sidebar debug meter. */
  lastSpeedX: number
  lastSpeedT: number
  peakSpeedPxPerMs: number
  /** progress 0 = rest, 1 = full active pose at drag start. */
  startProgress: number
  /** last computed progress for commit on release. */
  progress: number
  /** true while actively tracking a vertical pull. */
  dragging: boolean
  /** side-card already committed to scroll-to-hero mid-drag. */
  committed: boolean
}

/** Continuous face-rotate driven by scrub distance (not center-pull snap). */
type RotateScrubState = {
  pointerId: number
  /** Pointer X when rotate mode began (gesture start). */
  originX: number
  /**
   * Flip angle at rotate start.
   * Prefer the live signed angle so left/right from the back face don't jump
   * between +180 and -180.
   */
  baseAngle: number
  /** px of horizontal travel that maps to a full face change. */
  fullFlipPx: number
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

/** Map progress 0..1 → { scale, translateY } between rest and active. */
function poseFromProgress(progress: number) {
  const p = clamp01(progress)
  const e = easeOutCubic(p)
  const activeScale = getActiveScale()
  return {
    scale: 1 + (activeScale - 1) * e,
    translateY: -ACTIVE_Y_LIFT_PX * e,
  }
}

type HoloCardProps = {
  src: string
  mediaType: MediaType
  effect: HoloEffect
  foil?: string
  mask?: string
  /** Still poster for the front video face (Safari / loading). */
  poster?: string
  back?: string
  backMediaType?: MediaType
  fullBleed?: boolean
  backHolo?: boolean
  flipAngle?: number
  onFlipAngleChange?: (angle: number) => void
  /** When false, tap focuses the card instead of scaling it up. */
  expandable?: boolean
  onSelect?: () => void
  /** Live size/position tuning for the holo layers. */
  holoTransform?: HoloTransform
  /**
   * Keep the holo fully visible without hover (for slider tuning).
   * When true, mouse leave won't fade the foil out.
   */
  pinHolo?: boolean
  /** Stable id for selection (defaults to React useId). */
  cardKey?: string
  /** Label shown under the active card actions. */
  cardName?: string
  /** Optional play-count override for "Play Game (Nx)". */
  videoCardCount?: number
  /** Backend model id — opens /game?model=&card= from Play Game. */
  modelId?: string
  /** Optional photo-fill override (0–10) for this motion card's grid. */
  photoFilledCount?: number
  /** Optional catalog photo URLs for the gift grid. */
  photoUrls?: string[]
  /** Role-level filled static count (0–30). Gift unlocks at 30/30. */
  rolePhotoFilledCount?: number
  /** Exclusive category gift video URL. */
  giftVideoUrl?: string
  /** Optional identity overlay on the card front. */
  overlay?: CardFaceOverlayConfig | CardFaceOverlayData | null
  /** Fires when real face media is visible (false while placeholder is showing). */
  onFaceMediaReady?: (ready: boolean) => void
}

export default function HoloCard({
  src,
  mediaType,
  effect,
  foil = '',
  mask = '',
  poster = '',
  back = '/img/SugarScratch.png',
  backMediaType = 'image',
  fullBleed = true,
  backHolo = true,
  flipAngle = 0,
  onFlipAngleChange,
  expandable = true,
  onSelect,
  holoTransform = DEFAULT_HOLO_TRANSFORM,
  pinHolo = false,
  cardKey,
  cardName = 'Card',
  videoCardCount,
  modelId,
  photoFilledCount,
  photoUrls,
  rolePhotoFilledCount,
  giftVideoUrl,
  overlay = null,
  onFaceMediaReady,
}: HoloCardProps) {
  const navigate = useNavigate()
  const actions = useCollectionActions()
  const { activeCardId, toggleActiveCard, reportScrubSpeed, resetScrubSpeed } =
    useActiveCard()
  const {
    consumeCarouselDrag,
    isCarouselDragging,
    isCarouselScrubbing,
    subscribeScrubbing,
  } = useCarousel()
  // Global session motion: permission + user opt-in + single orientation listener.
  const {
    permission: motionPermission,
    supported: motionSupported,
    enabled: motionEnabled,
    subscribe: subscribeMotion,
  } = useMotion()
  const reactId = useId()
  const cardId = cardKey || reactId
  const cardRef = useRef<HTMLDivElement>(null)
  const frontVideoRef = useRef<HTMLVideoElement | null>(null)
  const backVideoRef = useRef<HTMLVideoElement | null>(null)
  const rafId = useRef<number | null>(null)
  const pendingUpdate = useRef<{
    background: { x: number; y: number }
    glare: { x: number; y: number; o: number }
  } | null>(null)
  const firstPop = useRef(true)
  const repositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasActive = useRef(false)
  const flipDraggingRef = useRef(false)
  const buttonFlipRef = useRef(false)
  const rotateScrub = useRef<RotateScrubState | null>(null)
  const selectDrag = useRef<SelectDragState | null>(null)
  const selectDraggingRef = useRef(false)
  const rotatorRef = useRef<HTMLButtonElement>(null)
  const suppressClick = useRef(false)
  const flipAngleRef = useRef(flipAngle)
  const activeRef = useRef(false)
  const isTiltingRef = useRef(false)
  /** Soft-followed device orientation (degrees for CSS rotate vars). */
  const deviceTiltYawRef = useRef(0)
  const deviceTiltPitchRef = useRef(0)
  const motionEnabledRef = useRef(motionEnabled)

  const [interacting, setInteracting] = useState(false)
  /** React-owned so re-renders don't wipe classList-added is-tilting. */
  const [isTilting, setIsTilting] = useState(false)
  /**
   * True while a finger face-flip scrub is live. Forces device-tilt CSS vars to 0
   * so --rotate-x can't cancel one swipe direction (right→left was dying when
   * residual phone yaw was negative and flip-y was positive).
   */
  const [isFlipScrubbing, setIsFlipScrubbing] = useState(false)
  const isFlipScrubbingRef = useRef(false)
  const [loading, setLoading] = useState(true)
  /** Fall back to placeholder art when video src is missing or fails. */
  const [frontMediaFailed, setFrontMediaFailed] = useState(false)
/** Keep video invisible until a real frame is decoded (poster can be shown before the first decoded frame). */
  const [frontVideoReady, setFrontVideoReady] = useState(false)
  const frontMediaUrl = (src ?? '').trim()
  const facePosterUrl = (poster ?? '').trim()
  const showFrontVideo =
    mediaType === 'video' && Boolean(frontMediaUrl) && !frontMediaFailed
  // Never use a failed video URL as an <img>/CSS background — fall back to placeholder.
  const frontDisplayUrl = showFrontVideo
    ? frontMediaUrl
    : mediaType === 'image' && frontMediaUrl && !frontMediaFailed
      ? frontMediaUrl
      : facePosterUrl || PLACEHOLDER_MEDIA_URL
  const frontPlaceholderUrl = facePosterUrl || PLACEHOLDER_MEDIA_URL
  const active = activeCardId === cardId
  /** Owned / playable motion card — otherwise show B&W + lock. */
  const isCollected = getVideoCardCount(cardId, videoCardCount) > 0
  /**
   * Poster-first face media: keep a still poster while browsing.
   * Mount + play the motion clip only after the user selects this card.
   */
  const mountFrontVideo = showFrontVideo && active
  const playFrontVideo = mountFrontVideo
  /** Identity strip only after real face media is visible — not over the placeholder. */
  const showFaceOverlay =
    Boolean(overlay) &&
    (showFrontVideo
      ? frontVideoReady || Boolean(facePosterUrl)
      : frontDisplayUrl !== PLACEHOLDER_MEDIA_URL)
  /** Browse stills are ready immediately; selected clips wait for a frame / poster. */
  const faceMediaReady = showFrontVideo
    ? !active || frontVideoReady || Boolean(facePosterUrl)
    : frontDisplayUrl !== PLACEHOLDER_MEDIA_URL

  useEffect(() => {
    onFaceMediaReady?.(faceMediaReady)
  }, [faceMediaReady, onFaceMediaReady])

  /** Live tilt/swipe debug HUD — tune tilt vs flip thresholds from device. */
  const [tiltDebug, setTiltDebug] = useState({
    scrub: 0,
    yaw: 0,
    px: 50,
    py: 50,
    bgx: 50,
    bgy: 50,
    center: 0,
    speed: 0,
    peak: 0,
    gate: ROTATE_SCRUB_SPEED_PX_MS,
    dist: 0,
    mode: 'idle' as 'idle' | 'tilt' | 'flip' | 'vertical',
  })

  const randomSeed = useMemo(
    () => ({ x: Math.random(), y: Math.random() }),
    []
  )
  const cosmosPosition = useMemo(
    () => ({
      x: Math.floor(randomSeed.x * 734),
      y: Math.floor(randomSeed.y * 1280),
    }),
    [randomSeed]
  )

  /** Safari + mobile: no shine/glare (unreliable WebKit holo). */
  const holoDisabled = useMemo(() => shouldDisableHoloEffects(), [])

  useEffect(() => {
    flipAngleRef.current = flipAngle
  }, [flipAngle])
  useEffect(() => {
    activeRef.current = active
  }, [active])
  useEffect(() => {
    isTiltingRef.current = isTilting
  }, [isTilting])
  useEffect(() => {
    isFlipScrubbingRef.current = isFlipScrubbing
  }, [isFlipScrubbing])
  useEffect(() => {
    motionEnabledRef.current = motionEnabled
  }, [motionEnabled])

  const [springs, api] = useSpring(() => ({
    flipDeltaX: 0,
    /** Active scrub / device yaw in degrees (CSS --rotate-x → rotateY). */
    tiltYaw: 0,
    /** Device front/back pitch in degrees (CSS --rotate-y → rotateX). */
    tiltPitch: 0,
    glareX: 50,
    glareY: 50,
    glareO: 0,
    bgX: 50,
    bgY: 50,
    scale: 1,
    translateX: 0,
    translateY: 0,
    config: INTERACT_CONFIG,
  }))

  const updateSprings = useCallback(
    (
      background: { x: number; y: number },
      glare: { x: number; y: number; o: number }
    ) => {
      api.start({
        bgX: background.x,
        bgY: background.y,
        glareX: glare.x,
        glareY: glare.y,
        glareO: glare.o,
        config: INTERACT_CONFIG,
      })
    },
    [api]
  )

  const pinHoloRef = useRef(pinHolo)
  const holoTransformRef = useRef(normalizeHoloTransform(holoTransform))
  useEffect(() => {
    pinHoloRef.current = pinHolo
  }, [pinHolo])
  useEffect(() => {
    holoTransformRef.current = normalizeHoloTransform(holoTransform)
  }, [holoTransform])

  const applyPointerPose = useCallback(
    (pointerX: number, pointerY: number, opacity = 1) => {
      const t = holoTransformRef.current
      let px = pointerX
      let py = pointerY
      // Axis lock freezes the unused dimension at center.
      if (t.pointerAxis === 'x') py = 50
      if (t.pointerAxis === 'y') px = 50

      api.start({
        glareX: px,
        glareY: py,
        glareO: opacity,
        bgX: mapPointerToBackground(px),
        bgY: mapPointerToBackgroundY(py),
        config: INTERACT_CONFIG,
      })
    },
    [api]
  )

  const interactEnd = useCallback(
    (delay = 500, { keepHolo = false } = {}) => {
      const t = holoTransformRef.current
      // Pinned or locked-pointer preview: keep foil lit.
      if (pinHoloRef.current || t.lockPointer) {
        if (rafId.current !== null) {
          cancelAnimationFrame(rafId.current)
          rafId.current = null
        }
        pendingUpdate.current = null
        setInteracting(true)
        applyPointerPose(t.pointerX, t.pointerY, 1)
        return
      }

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      pendingUpdate.current = null

      window.setTimeout(() => {
        if (pinHoloRef.current || holoTransformRef.current.lockPointer) return
        setInteracting(false)
        api.start({
          glareX: 50,
          glareY: 50,
          glareO: keepHolo ? 0.85 : 0,
          bgX: 50,
          bgY: 50,
          config: SNAP_CONFIG,
        })
      }, delay)
    },
    [api, applyPointerPose]
  )

  // Pin / lock / slider pointer pose — live, no refresh.
  useEffect(() => {
    const t = normalizeHoloTransform(holoTransform)
    if (pinHolo || t.lockPointer) {
      setInteracting(true)
      applyPointerPose(t.pointerX, t.pointerY, 1)
    } else if (!active) {
      setInteracting(false)
      api.start({
        glareX: 50,
        glareY: 50,
        glareO: 0,
        bgX: 50,
        bgY: 50,
        config: SNAP_CONFIG,
      })
    }
  }, [pinHolo, holoTransform, active, api, applyPointerPose])

  const applySelectPose = useCallback(
    (progress: number, immediate = false) => {
      const pose = poseFromProgress(progress)
      api.start({
        scale: pose.scale,
        translateX: 0,
        translateY: pose.translateY,
        glareO: 0,
        immediate,
        config: immediate ? DRAG_FOLLOW_CONFIG : ACTIVE_CONFIG,
      })
    },
    [api]
  )

  useEffect(() => {
    // Don't fight the physical vertical drag mid-gesture.
    if (selectDraggingRef.current) {
      wasActive.current = active
      return
    }
    if (active && !wasActive.current) {
      firstPop.current = false
      applySelectPose(1)
      setInteracting(false)
    } else if (!active && wasActive.current) {
      applySelectPose(0)
      // Clear any residual scrub tilt / flip-button lock when deactivating.
      buttonFlipRef.current = false
      suppressClick.current = false
      setIsTilting(false)
      // Keep global motion preference — next active card continues if still enabled.
      deviceTiltYawRef.current = 0
      deviceTiltPitchRef.current = 0
      cardRef.current?.classList.remove('is-tilting')
      api.start({
        tiltYaw: 0,
        tiltPitch: 0,
        glareX: 50,
        glareY: 50,
        glareO: 0,
        bgX: 50,
        bgY: 50,
        config: TILT_RETURN_CONFIG,
      })
      resetScrubSpeed()
      interactEnd(80)
    }
    wasActive.current = active
  }, [active, api, applySelectPose, interactEnd, resetScrubSpeed])

  // When global motion preference turns off, always ease this card upright
  // (covers toggle from this card or any shared session state change).
  useEffect(() => {
    if (motionEnabled) return
    deviceTiltYawRef.current = 0
    deviceTiltPitchRef.current = 0
    // Don't fight a live finger flip / drag.
    if (
      flipDraggingRef.current ||
      rotateScrub.current ||
      selectDraggingRef.current ||
      isFlipScrubbingRef.current
    ) {
      return
    }
    if (!active) return
    api.start({
      tiltYaw: 0,
      tiltPitch: 0,
      config: TILT_RETURN_CONFIG,
    })
  }, [active, api, motionEnabled])

  // Consume the single global orientation stream (no per-card window listeners).
  // Preference is app-wide: once enabled, every active hero follows motion
  // until the user turns tilt off in Profile.
  // Finger scrub / flip temporarily wins while a gesture is active.
  useEffect(() => {
    if (!active || !motionEnabled || motionPermission !== 'granted') {
      return
    }

    return subscribeMotion((sample) => {
      if (!sample.hasSample) return
      // Hard pause while the user is flipping or finger-dragging the hero.
      // Residual device yaw was canceling one swipe direction when combined
      // with --flip-y in CSS (rotateY(flip-y + rotate-x)).
      if (
        selectDraggingRef.current ||
        flipDraggingRef.current ||
        rotateScrub.current ||
        isTiltingRef.current ||
        isFlipScrubbingRef.current ||
        buttonFlipRef.current
      ) {
        return
      }

      const gamma = sample.gamma
      const beta = sample.beta

      // gamma: left/right phone tilt. Invert so phone-left tilts face right.
      const normalizedYaw = clamp(gamma / DEVICE_TILT_GAMMA_RANGE, -1, 1)
      const targetYawDeg = -normalizedYaw * MAX_HOVER_YAW_DEG
      const nextYaw = lerp(
        deviceTiltYawRef.current,
        targetYawDeg,
        DEVICE_TILT_SMOOTHING
      )
      deviceTiltYawRef.current = nextYaw

      // beta: front/back phone tilt → slight pitch (not yaw).
      // Center around a natural handheld upright (~55°).
      const betaOffset = beta - 55
      const normalizedPitch = clamp(betaOffset / DEVICE_TILT_BETA_RANGE, -1, 1)
      // Invert so tipping the phone toward you pitches the face toward you.
      const targetPitchDeg = -normalizedPitch * MAX_DEVICE_PITCH_DEG
      const nextPitch = lerp(
        deviceTiltPitchRef.current,
        targetPitchDeg,
        DEVICE_TILT_SMOOTHING
      )
      deviceTiltPitchRef.current = nextPitch

      // Map device yaw into holo pointer so shine tracks the turn (when enabled).
      const pointerX = clamp(
        round(50 + (nextYaw / MAX_HOVER_YAW_DEG) * 38),
        HOLO_POINTER_MIN,
        HOLO_POINTER_MAX
      )
      const pointerY = 46
      api.start({
        tiltYaw: nextYaw,
        tiltPitch: nextPitch,
        glareX: pointerX,
        glareY: pointerY,
        glareO: getTiltHoloOpacity('touch'),
        bgX: mapPointerToBackground(pointerX),
        bgY: mapPointerToBackgroundY(pointerY),
        config: DEVICE_TILT_FOLLOW_CONFIG,
      })
    })
  }, [active, api, motionEnabled, motionPermission, subscribeMotion])

  useEffect(() => {
    // Don't fight a live rotate scrub or button flip animation.
    if (flipDraggingRef.current || rotateScrub.current || buttonFlipRef.current) {
      return
    }
    // Ignore no-op prop echoes after the animated flip button.
    if (Math.abs(flipAngleRef.current - flipAngle) < 0.5) {
      flipAngleRef.current = flipAngle
      return
    }
    flipAngleRef.current = flipAngle
    api.start({ flipDeltaX: flipAngle, immediate: true })
  }, [flipAngle, api])

  const setFlipYLive = useCallback(
    (angle: number) => {
      // Keep continuous angles during scrub (no ±180 wrap) so back→front
      // never jumps 360° mid-gesture.
      flipAngleRef.current = angle
      api.start({ flipDeltaX: angle, immediate: true })
    },
    [api]
  )

  /**
   * Normalize into (-180, 180] for face tests only (not for animation targets).
   */
  const normalize180 = (angle: number) => {
    let a = angle
    while (a > 180) a -= 360
    while (a <= -180) a += 360
    return a
  }

  /**
   * Pick target + 360k closest to `from` so springs never take the long way
   * (e.g. -170 → +180 would spin almost a full turn).
   */
  const nearestAngle = (from: number, target: number) => {
    let best = target
    let bestDist = Math.abs(from - target)
    for (let k = -2; k <= 2; k++) {
      const candidate = target + 360 * k
      const dist = Math.abs(from - candidate)
      if (dist < bestDist) {
        bestDist = dist
        best = candidate
      }
    }
    return best
  }

  const commitFlipAngle = useCallback(
    (
      angle: number,
      opts: { animate?: boolean } = {}
    ) => {
      const current = angle
      const norm = normalize180(current)
      // Which face are we closer to?
      const wantBack = Math.abs(norm) >= ROTATE_SNAP_MIDPOINT_DEG
      // Canonical persisted face: always 0 or +180.
      const canonical = wantBack ? 180 : 0
      // Animate to the nearest equivalent so -170→-180 (not +180) and 350→360 (not 0).
      const animTarget = wantBack
        ? nearestAngle(current, current >= 0 ? 180 : -180)
        : nearestAngle(current, 0)

      if (opts.animate) {
        flipAngleRef.current = canonical
        api.start({
          flipDeltaX: animTarget,
          tiltYaw: 0,
          tiltPitch: 0,
          immediate: false,
          config: FLIP_SCRUB_RELEASE_SPRING,
          onRest: () => {
            // Collapse to canonical 0/180 after the short settle (no visual change).
            if (
              !rotateScrub.current &&
              !buttonFlipRef.current &&
              Math.abs(normalize180(flipAngleRef.current)) ===
                Math.abs(canonical)
            ) {
              flipAngleRef.current = canonical
              api.start({ flipDeltaX: canonical, immediate: true })
            }
          },
        })
      } else {
        flipAngleRef.current = canonical
        api.start({ flipDeltaX: canonical, immediate: true })
      }
    },
    [api]
  )

  /**
   * Animate to the other face (flip button + desktop `\` shortcut).
   * Front → back spins one way (0 → +180).
   * Back → front spins the reverse way (-180 → 0), so it never feels one-directional.
   * Rapid triggers reverse mid-flight from the live spring angle (no wait for settle).
   */
  const flipCardFace = useCallback(() => {
    if (!active || !onFlipAngleChange) return
    // Don't interrupt a live scrub/drag — button/keyboard flips may interrupt each other.
    if (rotateScrub.current || selectDraggingRef.current) return

    // Prefer the live animated angle so a mid-flip re-press reverses smoothly.
    let live = flipAngleRef.current
    try {
      live = springs.flipDeltaX.get()
    } catch {
      // spring may not be ready; fall back to ref
    }

    // Target is the opposite of where we're currently heading / resting.
    // If mid-animation, flipAngleRef already holds the intended end face.
    const headingToBack =
      buttonFlipRef.current
        ? Math.abs(flipAngleRef.current) >= ROTATE_SNAP_MIDPOINT_DEG
        : Math.abs(live) >= ROTATE_SNAP_MIDPOINT_DEG
    const next = headingToBack ? 0 : 180

    // Don't sticky-suppress card clicks — flip lives outside the rotator,
    // and a sticky suppressClick was locking deselect until another click.
    buttonFlipRef.current = true
    flipAngleRef.current = next
    onFlipAngleChange(next)

    // Seed from the current visual angle (not a face snap) so reverse is continuous.
    let from = live
    if (next === 0) {
      // Going to front: approach 0 from the negative side when possible.
      if (from > 0) from = from - 360
      // Keep near -180..0 for a short reverse path.
      while (from < -180) from += 360
      while (from > 0) from -= 360
      if (from > -0.5 && from < 0.5) from = -180
    } else {
      // Going to back: approach +180 from the positive side when possible.
      if (from < 0) from = from + 360
      while (from > 180) from -= 360
      while (from < 0) from += 360
      if (from > 179.5) from = 0
    }

    api.start({
      flipDeltaX: from,
      tiltYaw: 0,
      immediate: true,
    })
    api.start({
      flipDeltaX: next === 0 ? 0 : 180,
      tiltYaw: 0,
      config: FLIP_SPRING,
      onRest: () => {
        // Only clear if this animation is still the latest target.
        if (Math.abs(flipAngleRef.current - next) < 0.5) {
          buttonFlipRef.current = false
          flipAngleRef.current = next
        }
      },
    })
  }, [active, api, onFlipAngleChange, springs.flipDeltaX])

  const handleFlipButton = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      flipCardFace()
    },
    [flipCardFace],
  )

  // Desktop: `\` flips the open motion card (same path as the circular flip button).
  useEffect(() => {
    if (!active) return

    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      if (el.isContentEditable) return true
      return Boolean(el.closest?.('[contenteditable="true"]'))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      // Nested overlays own their own keys.
      // Exclude the parent FeaturedCardOverlay dialog so flip (\) still works.
      if (
        document.querySelector(
          '.static-card-playing, [role="dialog"][aria-modal="true"]:not(.creator-featured-overlay)',
        )
      ) {
        return
      }
      // Backslash on most layouts; also accept the raw code for shifted variants.
      if (event.key !== '\\' && event.code !== 'Backslash') return
      event.preventDefault()
      flipCardFace()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, flipCardFace])

  const beginFlipDrag = useCallback(() => {
    flipDraggingRef.current = true
    rotatorRef.current?.classList.add('flipping')
    // Seed spring at the current live angle so promote-from-tilt is seamless.
    // Keep foil off when holo is disabled (Safari/mobile).
    api.start({
      glareO: shouldDisableHoloEffects() ? 0 : 0.85,
      flipDeltaX: flipAngleRef.current,
      immediate: true,
    })
  }, [api])

  const endFlipDragUi = useCallback(() => {
    flipDraggingRef.current = false
    rotatorRef.current?.classList.remove('flipping')
  }, [])

  const interact = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      // Pointer drives holo glare/foil only — no card tilt.
      // Holo is active-card only: ignore hover while browsing the carousel.
      if (e.buttons !== 0) return
      // Locked pointer mode: mouse does not override slider pose.
      if (holoTransformRef.current.lockPointer) return

      if (document.visibilityState !== 'visible') {
        setInteracting(false)
        return
      }

      // Only the open/active card may drive holo pointer pose.
      if (!activeRef.current || activeCardId !== cardId) {
        setInteracting(false)
        return
      }

      setInteracting(true)

      const rect = e.currentTarget.getBoundingClientRect()
      const absolute = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      let percentX = clamp(round((100 / rect.width) * absolute.x))
      let percentY = clamp(round((100 / rect.height) * absolute.y))

      const axis = holoTransformRef.current.pointerAxis
      if (axis === 'x') percentY = 50
      if (axis === 'y') percentX = 50

      pendingUpdate.current = {
        background: {
          x: adjust(percentX, 0, 100, 37, 63),
          y: adjust(percentY, 0, 100, 33, 67),
        },
        glare: {
          x: round(percentX),
          y: round(percentY),
          o: 1,
        },
      }

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          if (pendingUpdate.current) {
            const { background, glare } = pendingUpdate.current
            updateSprings(background, glare)
            pendingUpdate.current = null
          }
          rafId.current = null
        })
      }
    },
    [activeCardId, cardId, updateSprings]
  )

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    // While another card is active, ignore gestures on this card entirely
    // (mobile accidental taps / pulls were switching selection).
    if (activeCardId && activeCardId !== cardId) return

    setInteracting(false)
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    pendingUpdate.current = null

    // Physical vertical select drag on any interactive card (hero or side).
    // Side cards: pull up → lift, then scroll-to-hero + activate when far enough.
    // Active hero also allows horizontal scrub-tilt (3dpack degree lock).
    selectDrag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      vertical: false,
      tilting: false,
      rotating: false,
      scrubTilt: 0,
      lastScrubX: e.clientX,
      lastSpeedX: e.clientX,
      lastSpeedT: performance.now(),
      peakSpeedPxPerMs: 0,
      startProgress: active ? 1 : 0,
      progress: active ? 1 : 0,
      dragging: false,
      committed: false,
    }
    rotateScrub.current = null
    if (active) {
      reportScrubSpeed({
        currentPxPerMs: 0,
        peakPxPerMs: 0,
        mode: 'idle',
        active: true,
      })
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerMove = (
    e: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>
  ) => {
    if (isCarouselDragging()) return

    const sel = selectDrag.current
    const rot = rotateScrub.current
    const tracking =
      (sel && sel.pointerId === e.pointerId) ||
      (rot && rot.pointerId === e.pointerId)

    // Hover pointer pose is disabled for holo — foil only lights on tilt scrub
    // (or force-pin via holo debug). Don't call interact() here.
    if (!tracking) {
      return
    }

    // Sample horizontal scrub speed for the sidebar meter (px/ms + peak).
    const sampleScrubSpeed = (
      mode: 'tilt' | 'flip' | 'vertical' | 'idle'
    ): number => {
      if (!sel || sel.pointerId !== e.pointerId) return 0
      const now = performance.now()
      const dtMs = Math.max(now - sel.lastSpeedT, 1)
      const dx = e.clientX - sel.lastSpeedX
      const speed = Math.abs(dx) / dtMs
      sel.lastSpeedX = e.clientX
      sel.lastSpeedT = now
      sel.peakSpeedPxPerMs = Math.max(sel.peakSpeedPxPerMs, speed)
      reportScrubSpeed({
        currentPxPerMs: speed,
        peakPxPerMs: sel.peakSpeedPxPerMs,
        mode,
        active: true,
      })
      // Keep HUD live even before tilt/flip pose math runs.
      if (SHOW_TILT_SPEED_DEBUG) {
        setTiltDebug((prev) => ({
          ...prev,
          speed,
          peak: sel.peakSpeedPxPerMs,
          gate: getRotateSpeedThreshold(
            e.pointerType,
            motionEnabledRef.current && motionPermission === 'granted'
          ),
          dist: Math.abs(e.clientX - sel.startX),
          mode,
        }))
      }
      return speed
    }

    /**
     * Continuous face-rotate from scrub distance — additive model:
     *   angle = baseAngle - (dx / fullFlipPx) * 180
     * Finger-right (dx > 0) decreases angle; finger-left increases it.
     * Both directions always change the face (no one-way sign lock).
     *
     * Device yaw is hard-zeroed via isFlipScrubbing → CSS --rotate-x: 0.
     */
    const applyRotateScrub = (state: RotateScrubState) => {
      const dx = e.clientX - state.originX
      // Progress 0..1 along the scrub path.
      // Mobile: light ease-in (quadratic) so early travel is a bit gentler
      // without making the full flip feel like a long drag.
      const raw = clamp(Math.abs(dx) / Math.max(state.fullFlipPx, 1), 0, 1)
      const isTouch = isTouchLikePointer(e.pointerType)
      // easeInQuad — softer than cubic, still finishes sooner than linear on short swipes.
      const progress = isTouch ? raw * raw : raw
      // Continuous additive path — NEVER wrap across ±180 mid-scrub.
      // Wrapping 180.1 → -179.9 was the 360° flash on back→front.
      // left (dx < 0): angle decreases from base; right: increases.
      //   front 0: left → -180, right → +180
      //   back +180: left → 0, right → +360 (front, short path other way)
      //   back -180: right → 0, left → -360
      const signedProgress = (dx === 0 ? 0 : dx < 0 ? 1 : -1) * progress
      const angle = state.baseAngle - signedProgress * 180

      flipAngleRef.current = angle
      deviceTiltYawRef.current = 0
      deviceTiltPitchRef.current = 0
      api.start({
        flipDeltaX: angle,
        tiltYaw: 0,
        tiltPitch: 0,
        immediate: true,
      })
    }

    /** Promote horizontal scrub into continuous face-rotate when speed is high enough. */
    const beginRotateScrub = () => {
      if (!active || !onFlipAngleChange) return false
      // Prefer the *visual* active face width (scaled). Hit-pad rect can be wider
      // than the face; fall back to rotator, then the event target.
      const faceEl =
        rotatorRef.current ??
        (e.currentTarget as HTMLElement)
      const rect = faceEl.getBoundingClientRect()
      const motionOn =
        motionEnabledRef.current && motionPermission === 'granted'
      const isTouch = isTouchLikePointer(e.pointerType)
      // Use the on-screen (scaled) width so fullFlipPx matches the active look.
      // Mobile: longer path → more swipe = more complete (less snappy).
      const visualWidth = Math.max(rect.width, 1)
      const widthFrac = isTouch
        ? motionOn
          ? ROTATE_FULL_FLIP_WIDTH_FRAC_TOUCH_MOTION
          : ROTATE_FULL_FLIP_WIDTH_FRAC_TOUCH
        : ROTATE_FULL_FLIP_WIDTH_FRAC
      const fullFlipPx = Math.max(
        visualWidth * widthFrac,
        isTouch ? (motionOn ? 110 : 125) : 120
      )
      // Prefer live signed angle so we don't jump +180 ↔ -180 when starting a scrub.
      let live = flipAngleRef.current
      try {
        live = springs.flipDeltaX.get()
      } catch {
        // spring may not be ready
      }
      // Snap base to nearest face center, preserving sign of the back face.
      const baseAngle =
        Math.abs(live) >= ROTATE_SNAP_MIDPOINT_DEG
          ? live >= 0
            ? 180
            : -180
          : 0
      // IMPORTANT: origin at gesture start (not current X).
      const originX = sel?.startX ?? e.clientX
      rotateScrub.current = {
        pointerId: e.pointerId,
        originX,
        baseAngle,
        fullFlipPx,
      }
      // Freeze device soft-follow so it can't re-inject yaw mid-flip.
      deviceTiltYawRef.current = 0
      deviceTiltPitchRef.current = 0
      isFlipScrubbingRef.current = true
      setIsFlipScrubbing(true)
      beginFlipDrag()
      suppressClick.current = true
      setInteracting(false)
      setIsTilting(false)
      // Seed at base face; applyRotateScrub immediately applies traveled dx.
      flipAngleRef.current = baseAngle
      api.start({
        tiltYaw: 0,
        tiltPitch: 0,
        flipDeltaX: baseAngle,
        immediate: true,
      })
      if (sel) {
        sel.tilting = false
        sel.rotating = true
        sel.dragging = true
      }
      selectDraggingRef.current = true
      cardRef.current?.classList.remove('is-tilting')
      cardRef.current?.classList.add('is-flipping-scrub')
      rotatorRef.current?.classList.add('is-flipping-scrub')
      applyRotateScrub(rotateScrub.current)
      return true
    }

    // Continuous rotate scrub (speed-promoted) — angle follows scrub distance.
    if (rot && rot.pointerId === e.pointerId && active) {
      e.stopPropagation()
      e.preventDefault()
      sampleScrubSpeed('flip')
      applyRotateScrub(rot)
      return
    }

    // Physical vertical drag: card follows the pull toward active/rest pose.
    // Works on the hero AND on side cards (pull-up then scroll-to-hero).
    // Side cards are intentionally less sensitive (longer pull + higher commit).
    // Active hero horizontal scrub:
    //   speed <  3 px/ms → degree-locked tilt
    //   speed >= 3 px/ms → continuous face rotate
    if (sel && sel.pointerId === e.pointerId) {
      const dx = e.clientX - sel.startX
      const dy = e.clientY - sel.startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      const isSideCard = !expandable
      const lockPx = isSideCard ? VERTICAL_LOCK_SIDE_PX : VERTICAL_LOCK_HERO_PX
      const dragDistance = isSideCard
        ? ACTIVATE_DRAG_DISTANCE_SIDE_PX
        : ACTIVATE_DRAG_DISTANCE_HERO_PX
      const commitAt = isSideCard ? COMMIT_PROGRESS_SIDE : COMMIT_PROGRESS_HERO

      // Active hero horizontal scrub — lock axis first, then branch.
      // Mobile (touch): speed gate / motion-on flip-only (DO NOT CHANGE values).
      // Desktop (mouse): continuous drag-to-rotate — no speed gate, no finger tilt
      // (holo is off, so degree-locked tilt has no foil benefit).
      const motionOn =
        motionEnabledRef.current && motionPermission === 'granted'
      const isTouch = isTouchLikePointer(e.pointerType)
      // Motion-on mobile: lock horizontal earlier so short swipes still start a flip.
      const horizontalLockPx =
        motionOn && isTouch ? Math.min(TILT_LOCK_PX, 6) : TILT_LOCK_PX

      if (
        active &&
        !sel.vertical &&
        !sel.tilting &&
        !sel.rotating &&
        absX > horizontalLockPx &&
        absX > absY * (motionOn && isTouch ? 1.0 : VERTICAL_AXIS_RATIO)
      ) {
        sel.dragging = true
        selectDraggingRef.current = true
        suppressClick.current = true
        sel.lastScrubX = e.clientX
        sel.scrubTilt = 0
        e.stopPropagation()
        e.preventDefault()

        // Desktop: always continuous face-rotate with the drag (no speed swipe).
        if (!isTouch) {
          sampleScrubSpeed('flip')
          if (beginRotateScrub()) return
          return
        }

        // --- Mobile-only paths below (leave thresholds/behavior as-is) ---

        // Motion-on mobile: any horizontal drag is a flip swipe (no tilt zone).
        if (motionOn) {
          sampleScrubSpeed('flip')
          if (beginRotateScrub()) return
          // If flip couldn't start, don't fall into finger-tilt while motion owns tilt.
          return
        }

        // Seed speed sample before branching.
        const speed = sampleScrubSpeed('tilt')
        const flipSpeedGate = getRotateSpeedThreshold(e.pointerType, motionOn)
        // Mobile: speed-only gate.
        if (
          speed >= flipSpeedGate ||
          sel.peakSpeedPxPerMs >= flipSpeedGate
        ) {
          beginRotateScrub()
          return
        }

        sel.tilting = true
        setIsTilting(true)
        setInteracting(true)
        // Seed holo at center so the foil is visible immediately on tilt lock.
        // Touch uses a softer overlay so the art stays readable.
        const tiltOpacity = getTiltHoloOpacity(e.pointerType)
        api.start({
          glareX: 50,
          glareY: 46,
          glareO: tiltOpacity,
          bgX: 50,
          bgY: mapPointerToBackgroundY(46),
          immediate: true,
        })
      }

      if (sel.tilting && active) {
        e.stopPropagation()
        const motionOn =
          motionEnabledRef.current && motionPermission === 'granted'
        const isTouch = isTouchLikePointer(e.pointerType)

        // Desktop should never linger in finger-tilt — promote to face rotate.
        if (!isTouch) {
          setIsTilting(false)
          sampleScrubSpeed('flip')
          if (beginRotateScrub()) return
          return
        }

        // Safety: if motion turns on mid-gesture, promote out of finger tilt.
        if (motionOn) {
          setIsTilting(false)
          sampleScrubSpeed('flip')
          if (beginRotateScrub()) return
          return
        }

        const speed = sampleScrubSpeed('tilt')
        const flipSpeedGate = getRotateSpeedThreshold(e.pointerType, motionOn)
        // Fast scrub mid-tilt → promote into continuous face rotate.
        // Mobile: speed/peak only (unchanged).
        if (
          speed >= flipSpeedGate ||
          sel.peakSpeedPxPerMs >= flipSpeedGate
        ) {
          setIsTilting(false)
          beginRotateScrub()
          return
        }

        // Same accumulator as 3dpack: deltaX / (stageWidth * TILT_SENSITIVITY), clamp [-1, 1].
        const stageWidth =
          (e.currentTarget.closest('.coverflow') as HTMLElement | null)
            ?.clientWidth || window.innerWidth
        const deltaX = e.clientX - sel.lastScrubX
        sel.lastScrubX = e.clientX
        const tiltDelta = deltaX / (stageWidth * TILT_SENSITIVITY)
        sel.scrubTilt = clamp(sel.scrubTilt + tiltDelta, -1, 1)
        // Soft-limit yaw so spring targets never sit on the hard edge.
        const yawDeg =
          Math.tanh(sel.scrubTilt * 1.15) * MAX_HOVER_YAW_DEG
        // Map tilt scrub into holo pointer pose so shine/glare tracks the turn.
        // Keep pointer off 0/100 — Safari can flip blend/background sampling there.
        const pointerX = clamp(
          round(50 - sel.scrubTilt * 38),
          HOLO_POINTER_MIN,
          HOLO_POINTER_MAX
        )
        const pointerY = 46
        const nextBgX = mapPointerToBackground(pointerX)
        const nextBgY = mapPointerToBackgroundY(pointerY)
        const fromCenter = clamp(
          Math.sqrt((pointerY - 50) ** 2 + (pointerX - 50) ** 2) / 50,
          0,
          1
        )
        if (SHOW_TILT_SPEED_DEBUG) {
          setTiltDebug({
            scrub: sel.scrubTilt,
            yaw: -yawDeg,
            px: pointerX,
            py: pointerY,
            bgx: nextBgX,
            bgy: nextBgY,
            center: fromCenter,
            speed,
            peak: sel.peakSpeedPxPerMs,
            gate: flipSpeedGate,
            dist: absX,
            mode: 'tilt',
          })
        }
        const tiltOpacity = getTiltHoloOpacity(e.pointerType)
        // CSS --rotate-x drives rotateY; invert so drag-right tilts face right.
        api.start({
          tiltYaw: -yawDeg,
          glareX: pointerX,
          glareY: pointerY,
          glareO: tiltOpacity,
          bgX: nextBgX,
          bgY: nextBgY,
          config: TILT_FOLLOW_CONFIG,
          immediate: false,
        })
        return
      }

      if (!sel.vertical && absY > lockPx && absY > absX * VERTICAL_AXIS_RATIO) {
        sel.vertical = true
        sel.dragging = true
        selectDraggingRef.current = true
        suppressClick.current = true
        e.stopPropagation()
        // Lift this card above neighbors while pulling.
        cardRef.current?.classList.add('is-pulling')
        // Drop any partial tilt / holo if the gesture became vertical.
        setIsTilting(false)
        setInteracting(false)
        api.start({
          tiltYaw: 0,
          tiltPitch: 0,
          glareO: 0,
          config: TILT_RETURN_CONFIG,
        })
        if (active) {
          reportScrubSpeed({
            currentPxPerMs: 0,
            peakPxPerMs: sel.peakSpeedPxPerMs,
            mode: 'vertical',
            active: true,
          })
        }
      }

      if (sel.vertical && !sel.committed) {
        e.stopPropagation()
        if (active) sampleScrubSpeed('vertical')
        // Up (negative dy) increases progress toward active; down decreases.
        // Side cards also ease the first part of the pull (less immediate lift).
        const rawDelta = -dy / dragDistance
        const deltaProgress = isSideCard
          ? rawDelta * 0.72 // damp response on non-focused cards
          : rawDelta
        let next = sel.startProgress + deltaProgress
        // Soft rubber past 0..1 so it feels like a physical pull.
        if (next < 0) next = next * 0.35
        if (next > 1) next = 1 + (next - 1) * DRAG_OVERSHOOT
        sel.progress = next

        const visual = clamp01(next)
        const extra = Math.max(0, next - 1)
        const pose = poseFromProgress(visual)
        // Side cards lift a bit less while scrubbing so they feel heavier.
        const liftScale = isSideCard ? 0.85 : 1
        api.start({
          scale: 1 + (pose.scale - 1) * liftScale + extra * 0.02,
          translateY: pose.translateY * liftScale - extra * 8,
          translateX: 0,
          immediate: true,
        })

        // Side card: once pulled far enough, catch into scroll-to-hero + activate.
        if (isSideCard && clamp01(next) >= commitAt) {
          sel.committed = true
          selectDraggingRef.current = false
          suppressClick.current = true
          cardRef.current?.classList.remove('is-pulling')
          // Keep lifted pose; parent re-homes this card as the hero.
          applySelectPose(1)
          onSelect?.()
          selectDrag.current = null
        }
      }
    }
  }

  const handlePointerUp = (
    e: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>
  ) => {
    const rot = rotateScrub.current
    const sel = selectDrag.current

    // Continuous rotate scrub: soft-settle along the shortest path to a face.
    if (rot && rot.pointerId === e.pointerId && onFlipAngleChange) {
      const current = flipAngleRef.current
      // commitFlipAngle picks nearest 0 / ±180 so we never spin the long way.
      let norm = current
      while (norm > 180) norm -= 360
      while (norm <= -180) norm += 360
      const snapped = Math.abs(norm) >= ROTATE_SNAP_MIDPOINT_DEG ? 180 : 0
      onFlipAngleChange(snapped)
      // Soft settle from live scrub angle (desktop + mobile) — no hard snap.
      commitFlipAngle(current, { animate: true })
      deviceTiltYawRef.current = 0
      deviceTiltPitchRef.current = 0
      isFlipScrubbingRef.current = false
      setIsFlipScrubbing(false)
      // Keep device yaw killed; commitFlipAngle owns the flip settle.
      api.start({
        tiltYaw: 0,
        tiltPitch: 0,
        immediate: true,
      })
      interactEnd(100, { keepHolo: activeCardId === cardId })
      suppressClick.current = true
      rotateScrub.current = null
      cardRef.current?.classList.remove('is-flipping-scrub')
      rotatorRef.current?.classList.remove('is-flipping-scrub')
      endFlipDragUi()
    }

    // Finish physical vertical drag: commit or snap back.
    if (sel && sel.pointerId === e.pointerId) {
      const dx = e.clientX - sel.startX
      const dy = e.clientY - sel.startY
      const moved =
        Math.hypot(dx, dy) > TAP_MAX_MOVE_PX ||
        sel.vertical ||
        sel.tilting ||
        sel.rotating

      if (sel.rotating) {
        // Face snap already handled above via rotateScrub.
        suppressClick.current = true
        selectDraggingRef.current = false
        setIsTilting(false)
        isFlipScrubbingRef.current = false
        setIsFlipScrubbing(false)
        cardRef.current?.classList.remove('is-flipping-scrub')
        rotatorRef.current?.classList.remove('is-flipping-scrub')
        // Keep device soft-follow zeroed so motion resumes cleanly after flip.
        deviceTiltYawRef.current = 0
        deviceTiltPitchRef.current = 0
        endFlipDragUi()
      } else if (sel.tilting) {
        // 3dpack: slow scrub release eases upright only.
        suppressClick.current = true
        selectDraggingRef.current = false
        setIsTilting(false)
        // If phone motion is still enabled, hand control back to device tilt.
        if (motionEnabledRef.current && motionPermission === 'granted') {
          setInteracting(false)
        } else {
          api.start({
            tiltYaw: 0,
            tiltPitch: 0,
            glareX: 50,
            glareY: 50,
            glareO: 0,
            bgX: 50,
            bgY: 50,
            config: TILT_RETURN_CONFIG,
          })
          setInteracting(false)
        }
      } else if (sel.vertical) {
        suppressClick.current = true
        selectDraggingRef.current = false
        cardRef.current?.classList.remove('is-pulling')
        const progress = clamp01(sel.progress)
        const commitAt = expandable
          ? COMMIT_PROGRESS_HERO
          : COMMIT_PROGRESS_SIDE
        const shouldBeActive = progress >= commitAt

        if (!expandable) {
          // Side card: commit → scroll to hero + activate; else drop back.
          if (shouldBeActive) {
            applySelectPose(1)
            onSelect?.()
          } else {
            applySelectPose(0)
          }
        } else {
          // Hero card: open/close based on pull distance.
          applySelectPose(shouldBeActive ? 1 : 0)
          if (shouldBeActive && !activeRef.current) {
            if (activeCardId !== cardId) toggleActiveCard(cardId)
            wasActive.current = true
          } else if (!shouldBeActive && activeRef.current) {
            if (activeCardId === cardId) toggleActiveCard(cardId)
            wasActive.current = false
          } else {
            wasActive.current = shouldBeActive
          }
        }
      } else if (moved) {
        suppressClick.current = true
      }
    }

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    // Keep last peak visible after release; mark sample inactive.
    if (activeRef.current || sel?.peakSpeedPxPerMs) {
      reportScrubSpeed({
        currentPxPerMs: 0,
        peakPxPerMs: sel?.peakSpeedPxPerMs ?? 0,
        mode: 'idle',
        active: false,
      })
    }

    const wasTilting = Boolean(sel?.tilting)
    rotateScrub.current = null
    selectDrag.current = null
    selectDraggingRef.current = false
    cardRef.current?.classList.remove('is-pulling')
    cardRef.current?.classList.remove('is-flipping-scrub')
    // Safety: if a cancel path skipped the tilt branch, still drop holo.
    if (wasTilting) setIsTilting(false)
    endFlipDragUi()
  }

  /**
   * Single click / tap:
   * - focused card → toggle active
   * - side card → parent onSelect scrolls it to left hero + activates
   * - while another card is already open, ignore (prevents accidental switch)
   */
  const handleActivate = () => {
    // Only ignore clicks that are the tail of a just-finished carousel scrub
    // (same pointer gesture). A later intentional click must still activate.
    if (isCarouselDragging()) return
    if (consumeCarouselDrag()) return
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    // While a hero is open, only that hero may receive activate/close taps.
    if (activeCardId && activeCardId !== cardId) return
    if (!expandable) {
      // Card to the right of the hero: bring it left and open it.
      onSelect?.()
      return
    }
    toggleActiveCard(cardId)
  }

  const handleMediaLoad = () => {
    setLoading(false)
    setFrontVideoReady(true)
  }

  const handleFrontMediaError = () => {
    setFrontMediaFailed(true)
    setFrontVideoReady(false)
    setLoading(false)
  }

  /**
   * Pause face videos while the carousel is scrubbing (card-row drag or dots
   * hold-scrub). Resume only for the selected card after settle — neighbors
   * stay on their poster and must not autoplay.
   */
  useEffect(() => {
    const resumeVideo = (video: HTMLVideoElement) => {
      if (video.readyState >= 2) {
        void video.play().catch(() => {
          // Autoplay may still be blocked; leave the poster/frame.
        })
        return
      }
      // Mounted mid-scrub with only partial data — wait for a frame, then play.
      const onReady = () => {
        video.removeEventListener('loadeddata', onReady)
        video.removeEventListener('canplay', onReady)
        if (!isCarouselScrubbing() && activeRef.current) {
          void video.play().catch(() => {
            // ignore
          })
        }
      }
      video.addEventListener('loadeddata', onReady)
      video.addEventListener('canplay', onReady)
      // Nudge decode if the element is still idle.
      try {
        if (video.networkState === HTMLMediaElement.NETWORK_IDLE) {
          video.load()
        }
      } catch {
        // ignore
      }
    }

    const setPlayback = (scrubbing: boolean) => {
      const videos = [frontVideoRef.current, backVideoRef.current]
      for (const video of videos) {
        if (!video) continue
        if (scrubbing || !playFrontVideo) {
          if (!video.paused) video.pause()
        } else {
          resumeVideo(video)
        }
      }
    }

    // Sync immediately in case we mounted mid-scrub.
    setPlayback(isCarouselScrubbing())
    return subscribeScrubbing(setPlayback)
  }, [isCarouselScrubbing, playFrontVideo, subscribeScrubbing])

  useEffect(() => {
    setFrontMediaFailed(false)
    setFrontVideoReady(false)
  }, [src, mediaType])

  useEffect(() => {
    setLoading(true)
    let cancelled = false

    // Still face (image or poster-while-browsing): CSS background, not <img>,
    // so iOS can't long-press-save them.
    if (!mountFrontVideo) {
      setFrontVideoReady(false)
      const imageSrc = facePosterUrl || frontDisplayUrl
      if (!imageSrc) {
        setLoading(false)
        return
      }
      const img = new Image()
      img.onload = () => {
        if (!cancelled) setLoading(false)
      }
      img.onerror = () => {
        if (cancelled) return
        // Poster-only browse: don't mark the motion URL failed — just keep the
        // placeholder underlay. Image faces without a poster still fall back.
        if (!showFrontVideo) setFrontMediaFailed(true)
        setLoading(false)
      }
      img.src = imageSrc
      return () => {
        cancelled = true
        img.onload = null
        img.onerror = null
      }
    }

    // Video: don't leave the card stuck in .loading (front opacity: 0).
    // Safari often won't re-fire loadeddata for a cached src (hero preload),
    // so poll readyState, nudge load(), and start playback here — the select
    // effect can miss that path if it only waits for media events.
    const clearLoading = () => {
      if (!cancelled) {
        setLoading(false)
        setFrontVideoReady(true)
      }
    }
    // Fallback so a missing/blocked video never blanks the card forever —
    // leave the placeholder underlay showing (don't mark video ready).
    const fallback = window.setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 2500)
    let didNudgeLoad = false
    const tryReveal = () => {
      const el =
        frontVideoRef.current ??
        (rotatorRef.current?.querySelector(
          '.card__front video'
        ) as HTMLVideoElement | null)
      if (!el) return
      if (el.readyState >= 2) {
        clearLoading()
        if (
          shouldPlayFromDecodePoll({
            playFrontVideo,
            scrubbing: isCarouselScrubbing(),
            readyState: el.readyState,
            paused: el.paused,
          })
        ) {
          void el.play().catch(() => {
            // Autoplay may be blocked until a gesture; first frame still shows.
          })
        }
        return
      }
      if (
        !didNudgeLoad &&
        shouldNudgeCachedSrcLoad({
          readyState: el.readyState,
          networkState: el.networkState,
          networkIdle: HTMLMediaElement.NETWORK_IDLE,
        })
      ) {
        didNudgeLoad = true
        try {
          el.load()
        } catch {
          // ignore
        }
      }
    }
    // Next frames: video node is mounted after this effect runs.
    const raf1 = requestAnimationFrame(() => {
      tryReveal()
      requestAnimationFrame(tryReveal)
    })
    const interval = window.setInterval(tryReveal, 120)
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      window.clearInterval(interval)
      cancelAnimationFrame(raf1)
    }
  }, [
    facePosterUrl,
    frontDisplayUrl,
    isCarouselScrubbing,
    mountFrontVideo,
    playFrontVideo,
    showFrontVideo,
  ])

  // Start / stop the face clip when selection changes (poster-first browse).
  useEffect(() => {
    let cancelled = false
    let raf = 0
    let waiting: HTMLVideoElement | null = null
    const onReady = () => {
      if (waiting) {
        waiting.removeEventListener('loadeddata', onReady)
        waiting.removeEventListener('canplay', onReady)
      }
      if (cancelled) return
      const video = frontVideoRef.current
      if (!video) return
      if (activeRef.current && !isCarouselScrubbing()) {
        void video.play().catch(() => {
          // ignore
        })
      }
    }
    const run = () => {
      const video = frontVideoRef.current
      if (!video) return false
      if (!playFrontVideo || isCarouselScrubbing()) {
        if (!video.paused) video.pause()
        return true
      }
      if (video.readyState >= 2) {
        void video.play().catch(() => {
          // Autoplay may be blocked; poster / first frame stays visible.
        })
        return true
      }
      waiting = video
      video.addEventListener('loadeddata', onReady)
      video.addEventListener('canplay', onReady)
      if (
        shouldNudgeCachedSrcLoad({
          readyState: video.readyState,
          networkState: video.networkState,
          networkIdle: HTMLMediaElement.NETWORK_IDLE,
        })
      ) {
        try {
          video.load()
        } catch {
          // ignore
        }
      }
      return true
    }
    if (!run()) {
      // Same mount timing as decode polling — ref can still be null this tick.
      raf = requestAnimationFrame(() => {
        if (!cancelled) run()
      })
    }
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (waiting) {
        waiting.removeEventListener('loadeddata', onReady)
        waiting.removeEventListener('canplay', onReady)
      }
    }
  }, [isCarouselScrubbing, playFrontVideo])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        interactEnd(0)
        api.start({
          scale: 1,
          translateX: 0,
          translateY: 0,
          immediate: true,
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (repositionTimer.current) clearTimeout(repositionTimer.current)
    }
  }, [api, interactEnd])

  // Recompute whenever sliders/toggles change so CSS updates in realtime.
  const holoCssVars = useMemo(
    () => holoTransformToCssVars(holoTransform),
    [holoTransform]
  )
  const holoClassNames = useMemo(
    () => holoTransformToClassNames(holoTransform),
    [holoTransform]
  )

  const frontStyle: CSSProperties = {
    ['--seedx' as string]: randomSeed.x,
    ['--seedy' as string]: randomSeed.y,
    ['--cosmosbg' as string]: `${cosmosPosition.x}px ${cosmosPosition.y}px`,
    ...(foil ? { ['--foil' as string]: `url(${foil})` } : {}),
    ...(mask ? { ['--mask' as string]: `url(${mask})` } : {}),
  }

  const isMasked = effect.masked || !!mask
  const types = effect.types ?? 'fire'
  const subtypes = effect.subtypes ?? 'basic'
  const supertype = effect.supertype ?? 'pokémon'
  const rarity = effect.rarity.toLowerCase()

  // Clip window is always driven by holoTransform sliders (--clip etc).
  // fullBleed is kept as a display flag for UI/defaults; slider vars win.

  return (
    <animated.div
      ref={cardRef}
      className={`card ${types} interactive${active ? ' active' : ''}${
        isTilting || pinHolo ? ' interacting' : ''
      }${isTilting ? ' is-tilting' : ''}${
        isFlipScrubbing ? ' is-flipping-scrub' : ''
      }${loading ? ' loading' : ''}${isMasked ? ' masked' : ''}${
        pinHolo ? ' holo-pinned' : ''
      }${fullBleed ? ' full-bleed' : ''}${
        holoDisabled ? ' holo-disabled' : ''
      }${isCollected ? ' is-collected' : ' is-locked'}${
        holoClassNames ? ` ${holoClassNames}` : ''
      }`}
      data-number=""
      data-set=""
      data-subtypes={subtypes}
      data-supertype={supertype}
      data-rarity={rarity}
      data-trainer-gallery={effect.trainerGallery ? 'true' : 'false'}
      style={
        {
          // Slider-driven clip vars (and invert polygons) always applied.
          ...holoCssVars,
          // Clamp every holo CSS % so Safari never samples blend layers outside 0–100.
          ['--pointer-x']: springs.glareX.to(
            (v) => `${clamp(v, HOLO_POINTER_MIN, HOLO_POINTER_MAX)}%`
          ),
          ['--pointer-y']: springs.glareY.to(
            (v) => `${clamp(v, HOLO_POINTER_MIN, HOLO_POINTER_MAX)}%`
          ),
          ['--pointer-from-center']: to(
            [springs.glareX, springs.glareY],
            (gx, gy) => {
              const x = clamp(gx, HOLO_POINTER_MIN, HOLO_POINTER_MAX)
              const y = clamp(gy, HOLO_POINTER_MIN, HOLO_POINTER_MAX)
              return clamp(
                Math.sqrt((y - 50) ** 2 + (x - 50) ** 2) / 50,
                0,
                1
              )
            }
          ),
          ['--pointer-from-top']: springs.glareY.to(
            (v) => clamp(v, HOLO_POINTER_MIN, HOLO_POINTER_MAX) / 100
          ),
          ['--pointer-from-left']: springs.glareX.to(
            (v) => clamp(v, HOLO_POINTER_MIN, HOLO_POINTER_MAX) / 100
          ),
          // Safari/mobile: foil off. Else pin forces full foil; tilt uses glareO.
          ['--card-opacity']: holoDisabled
            ? 0
            : pinHolo
              ? 1
              : springs.glareO,
          ['--flip-y']: springs.flipDeltaX.to((v) => `${v}deg`),
          // Scrub yaw (degree-locked). base.css: rotateY(var(--rotate-x)).
          // Cap yaw so WebKit doesn't recompose blend layers at extreme 3D angles.
          // While finger-flipping, FORCE 0 so device tilt can't cancel a direction.
          ['--rotate-x']: isFlipScrubbing
            ? '0deg'
            : springs.tiltYaw.to(
                (v) =>
                  `${clamp(v, -MAX_HOVER_YAW_DEG, MAX_HOVER_YAW_DEG)}deg`
              ),
          // Device front/back pitch (finger scrub keeps this near 0).
          ['--rotate-y']: isFlipScrubbing
            ? '0deg'
            : springs.tiltPitch.to(
                (v) =>
                  `${clamp(v, -MAX_DEVICE_PITCH_DEG, MAX_DEVICE_PITCH_DEG)}deg`
              ),
          ['--tilt-x']: '0deg',
          ['--tilt-y']: '0deg',
          ['--background-x']: springs.bgX.to(
            (v) => `${clamp(v, 30, 70)}%`
          ),
          ['--background-y']: springs.bgY.to(
            (v) => `${clamp(v, 30, 70)}%`
          ),
          ['--card-scale']: springs.scale,
          ['--translate-x']: springs.translateX.to((v) => `${v}px`),
          ['--translate-y']: springs.translateY.to((v) => `${v}px`),
        } as unknown as CSSProperties
      }
    >
      <div className="card__translater">
        {SHOW_TILT_SPEED_DEBUG && (active || isTilting) && (
          <div className="card__tilt-debug" aria-hidden="true">
            <div>
              mode {tiltDebug.mode}
              {isTilting ? ' / TILT' : ''}
              {motionEnabled && motionPermission === 'granted' ? ' / MOTION' : ''}
            </div>
            <div>
              perm {motionSupported ? motionPermission : 'unsupported'}
            </div>
            <div>
              spd {tiltDebug.speed.toFixed(2)} px/ms
            </div>
            <div>
              peak {tiltDebug.peak.toFixed(2)} px/ms
            </div>
            <div>
              gate {tiltDebug.gate.toFixed(2)} px/ms
            </div>
            <div>
              dist {tiltDebug.dist.toFixed(0)}px
              {tiltDebug.gate > ROTATE_SCRUB_SPEED_TOUCH_PX_MS
                ? ` / ${ROTATE_PROMOTE_DISTANCE_PX}px`
                : ' (speed-only)'}
            </div>
            <div>
              flip?{' '}
              {tiltDebug.speed >= tiltDebug.gate ||
              tiltDebug.peak >= tiltDebug.gate ||
              (tiltDebug.gate > ROTATE_SCRUB_SPEED_TOUCH_PX_MS &&
                tiltDebug.dist >= ROTATE_PROMOTE_DISTANCE_PX)
                ? 'YES'
                : 'no'}
            </div>
            <div>scrub {tiltDebug.scrub.toFixed(3)}</div>
            <div>yaw {tiltDebug.yaw.toFixed(2)}°</div>
            <div>
              ptr {tiltDebug.px.toFixed(1)}% / {tiltDebug.py.toFixed(1)}%
            </div>
            <div>
              bg {tiltDebug.bgx.toFixed(1)}% / {tiltDebug.bgy.toFixed(1)}%
            </div>
            <div>fromC {tiltDebug.center.toFixed(3)}</div>
          </div>
        )}
        {SHOW_SWIPE_ZONE_OVERLAY && active && (
          <div
            className={`card__swipe-zone${
              motionEnabled && motionPermission === 'granted'
                ? ' is-motion-on is-flip-only'
                : ''
            }`}
            aria-hidden="true"
          >
            <div className="card__swipe-zone-label">
              {motionEnabled && motionPermission === 'granted'
                ? 'full card swipe'
                : 'swipe zone'}
              <span>
                {motionEnabled && motionPermission === 'granted'
                  ? ' left/right → flip · phone owns tilt'
                  : ' ≥0.8 px/ms → flip · slow = tilt'}
              </span>
            </div>
            {!(motionEnabled && motionPermission === 'granted') && (
              <>
                <div className="card__swipe-zone-band card__swipe-zone-band--left" />
                <div className="card__swipe-zone-band card__swipe-zone-band--right" />
                <div className="card__swipe-zone-center">
                  slow drag = tilt
                </div>
              </>
            )}
            {motionEnabled && motionPermission === 'granted' && (
              <div className="card__swipe-zone-full">
                swipe left / right to flip
              </div>
            )}
          </div>
        )}
        {active && onFlipAngleChange && (
          <button
            type="button"
            className="card__flip-btn"
            onClick={handleFlipButton}
            onPointerDown={(e) => {
              // Keep stage/card drag from stealing the flip control.
              e.stopPropagation()
            }}
            aria-label={
              Math.abs(flipAngle) >= ROTATE_SNAP_MIDPOINT_DEG
                ? 'Flip to front'
                : 'Flip to back'
            }
            title={
              Math.abs(flipAngle) >= ROTATE_SNAP_MIDPOINT_DEG
                ? 'Flip to front'
                : 'Flip to back'
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
            >
              {/* Path is drawn ~[1,15]×[1,15]; center it in a square viewBox. */}
              <g transform="translate(8 8) translate(-8 -8)">
                <path
                  fill="currentColor"
                  transform="translate(0.5 0.5)"
                  d="M3 3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3h-.5a1.5 1.5 0 0 0-1.227 2.363C10.505 8.716 9.443 9 8 9s-2.505-.284-3.273-.637A1.5 1.5 0 0 0 3.5 6H3zm5 9c2.148 0 3.785-.495 5-1.147V13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.147C4.215 11.505 5.852 12 8 12M6 3a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1zm-.5 3a.5.5 0 0 0 .5.5h2.5a.5.5 0 0 0 0-1H6a.5.5 0 0 0-.5.5m-4 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-.585a7 7 0 0 0 .575.485C3.662 10.215 5.392 11 8 11s4.339-.785 5.425-1.6q.326-.246.575-.485V9.5a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 0 0 1h1.001a5.4 5.4 0 0 1-.676.6C11.912 9.285 10.392 10 8 10s-3.912-.715-4.825-1.4a5.4 5.4 0 0 1-.676-.6H3.5a.5.5 0 0 0 0-1z"
                />
              </g>
            </svg>
          </button>
        )}
        {/*
          Flat hit pad above the 3D face. On iOS/WebKit, preserve-3d + scale makes
          the rotator's hit box lag the *visual* active size — swipes near the
          edges of the scaled-up card miss. This pad is transform-style:flat and
          oversized so the active swipe zone matches the on-screen card.
        */}
        {active && (
          <div
            className={`card__hit-pad${
              motionEnabled && motionPermission === 'granted'
                ? ' is-motion-on'
                : ''
            }`}
            onClick={handleActivate}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => {
              e.preventDefault()
            }}
            aria-hidden="true"
          />
        )}
        {!isCollected ? (
          <div className="card__collect-lock" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
        ) : null}
        <button
          ref={rotatorRef}
          type="button"
          className="card__rotator"
          onClick={handleActivate}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => {
            // Prevent long-press / right-click image menus on iOS Safari.
            e.preventDefault()
          }}
          onMouseOut={() => {
            if (pinHoloRef.current || flipDraggingRef.current) return
            interactEnd(active ? 200 : 500, { keepHolo: active })
          }}
          aria-label={
            active
              ? 'Selected. Drag down to close, or click. Scrub left/right to tilt; drag farther sideways to flip.'
              : expandable
                ? 'Drag up like a physical card to open, or click. Swipe sideways to browse.'
                : 'Swipe to browse. Tap to focus.'
          }
        >
          <div className="card__back" style={frontStyle}>
            {backMediaType === 'video' ? (
              <video
                key={back}
                ref={backVideoRef}
                src={back}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                controls={false}
                disablePictureInPicture
                draggable={false}
                width={251}
                height={475}
              />
            ) : (
              // Background-image face: no <img> for iOS long-press "Save Image".
              <div
                className="card__media card__media--image"
                role="img"
                aria-label="Card back"
                style={{ backgroundImage: `url(${back})` }}
              />
            )}
            {backHolo && (
              <>
                <div className="card__shine" />
                <div className="card__glare" />
              </>
            )}
          </div>
          <div className="card__front" style={frontStyle}>
            {/* Always under the face so blank/loading videos never show gray. */}
            <div
              className="card__media card__media--image card__media--placeholder"
              role="presentation"
              aria-hidden="true"
              style={{ backgroundImage: `url(${frontPlaceholderUrl})` }}
            />
            {mountFrontVideo ? (
              <video
                key={frontDisplayUrl}
                className={
                  frontVideoReady ? 'is-media-ready' : 'is-media-loading'
                }
                src={frontDisplayUrl}
                poster={facePosterUrl || undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                controls={false}
                disablePictureInPicture
                draggable={false}
                onLoadedData={handleMediaLoad}
                onLoadedMetadata={handleMediaLoad}
                onCanPlay={handleMediaLoad}
                onError={handleFrontMediaError}
                ref={(node) => {
                  frontVideoRef.current = node
                  // Older iOS Safari needs the webkit attribute form.
                  if (node) {
                    node.setAttribute('webkit-playsinline', 'true')
                    node.setAttribute('playsinline', 'true')
                    node.muted = true
                    // Honor live scrub state immediately on attach.
                    if (isCarouselScrubbing()) node.pause()
                  }
                }}
                width={251}
                height={475}
              />
            ) : showFrontVideo ? (
              // Browse / unselected: still poster only — no video decode.
              <div
                className="card__media card__media--image is-media-ready"
                role="img"
                aria-label="Card artwork"
                style={{
                  backgroundImage: `url(${facePosterUrl || frontPlaceholderUrl})`,
                }}
              />
            ) : frontDisplayUrl !== PLACEHOLDER_MEDIA_URL ? (
              // Background-image face: no <img> for iOS long-press "Save Image".
              <div
                className="card__media card__media--image"
                role="img"
                aria-label="Card artwork"
                style={{ backgroundImage: `url(${frontDisplayUrl})` }}
              />
            ) : null}
            <div className="card__shine" />
            <div className="card__glare" />
            {showFaceOverlay && overlay ? (
              <CardFaceOverlay
                name={overlay.name || cardName}
                city={overlay.city}
                country={overlay.country}
                flagEmoji={overlay.flagEmoji}
                flagSvgUrl={overlay.flagSvgUrl}
                gradientColor={overlay.gradientColor}
                gradientColorEnd={overlay.gradientColorEnd}
                cardNumber={overlay.cardNumber}
              />
            ) : null}
          </div>
        </button>
        {/*
          Keep mounted after deactivate so the exit fade/slide can finish.
          ActiveCardPanel unmounts itself after EXIT_MS.
        */}
        <ActiveCardPanel
          cardName={cardName}
          cardKey={cardId}
          videoCardCount={videoCardCount}
          photoFilledCount={photoFilledCount}
          photoUrls={photoUrls}
          rolePhotoFilledCount={rolePhotoFilledCount}
          giftVideoUrl={giftVideoUrl}
          visible={active}
          actionsOnly
          onPlayGame={() => {
            const card = cardId.trim()
            const model = (modelId || '').trim()
            if (!card || !model) return
            unlockCountdownSound()
            if (actions.onPlayGame) {
              actions.onPlayGame(model, card, cardName)
              return
            }
            navigate(
              `/game?model=${encodeURIComponent(model)}&card=${encodeURIComponent(card)}`,
            )
          }}
          onViewCard={() => {
            if (actions.onViewCard) {
              actions.onViewCard(cardName)
              return
            }
            console.info('View Card', cardName)
          }}
          onGiftUnlocked={() => console.info('Gift Unlocked', cardName)}
        />
      </div>
    </animated.div>
  )
}
