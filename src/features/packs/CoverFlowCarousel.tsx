import { Html, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useDrag } from '@use-gesture/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
	  Suspense,
	  useCallback,
	  useEffect,
	  useLayoutEffect,
	  useMemo,
	  useRef,
	  useState,
	  type CSSProperties,
	} from 'react'
import type { Group, Object3D, PerspectiveCamera } from 'three'
import { Box3, Group as ThreeGroup, MathUtils, Vector3 } from 'three'
import {
  applyPackFaceMaterial,
  cloneSceneWithMaterials,
  DEFAULT_VIDEO_TEXTURE_TRANSFORM,
  PACK_MODEL_URL,
  PACK_TEXTURE_SIZE,
  PACK_VIDEO_FIT_MODE,
  PACK_VIDEO_URL,
  resolveTargetMaterial,
  useVideoTexture,
  type VideoTextureTransform,
} from '@/shared/pack3d'
import {
  ownerIdFromPackId,
  parsePackId,
  type CharacterId,
  type PackFaceSlot,
} from '@/shared/catalog/characters'
import { useCatalog } from '@/shared/catalog/CatalogContext'
import { BuyButton } from '@/features/reveal/components/BuyButton'
import {
  CtaButton,
  ctaButtonPropsFromTemplate,
} from '@/shared/ui/cta'
import { CardFan } from '@/features/reveal/components/CardFan'
import {
  PackLights,
  PackStageExposure,
} from '@/features/reveal/components/PackStage'
import { useRevealSequence } from '@/features/reveal/hooks/useRevealSequence'
import { createMixedCategoryPackCards, type RevealCard } from '@/features/reveal/lib/cards'
import {
  loadDuckInTimeline,
  sampleDuckInPose,
  type DuckInTimeline,
} from '@/features/reveal/lib/duckInTimeline'
import { loadFanDrag } from '@/features/reveal/lib/fanDrag'
import { loadFanLayout } from '@/features/reveal/lib/fanLayout'
import {
  loadPackTimeline,
  type PackPose,
  type PackTimeline,
} from '@/features/reveal/lib/packFraming'
import { POST_SHAKE_MOVE_MS } from '@/features/reveal/lib/revealTiming'
import {
  fetchPackFanCatalog,
  type BackendFanCatalog,
} from '@/shared/backend/collection'
import {
  formatPackCollectionLabel,
  formatPackNumberLabel,
  formatPackPrice,
  type Iteration,
} from './types'

// Keep the cover-flow light by mounting only nearby packs.
// Mobile: 5 packs (center ± 2). Desktop: 10 packs (center ± 5).
const MAX_VISIBLE_OFFSET_MOBILE = 2
const MAX_VISIBLE_OFFSET_DESKTOP = 5
// Match reveal start pose scale (DEFAULT_PACK_TIMELINE.start.scale = 0.73).
const FOCUS_SCALE = 0.73
const SIDE_SCALE = 0.66
// Stronger "hero" presentation when a pack is tapped active.
// Active scale ~ reveal end scale (0.81) relative to focus (0.73).
const ACTIVE_Y_LIFT = 0.12
const ACTIVE_SCALE_BOOST = 1.11
const ACTIVE_Z_FORWARD = 0.18

// --- In-place open sequence (same beats as reveal PackMesh, local coverflow space) ---
// Durations ~10% faster than the original reveal timing.
const OPEN_SPIN_TURNS = 2
const OPEN_SPIN_MS = 810
const OPEN_SPIN_BLUR_PX = 1.5
const OPEN_ANTICIPATION_MS = 144
const OPEN_ANTICIPATION_DEG = 28
/**
 * How far body travels live→End during wind-up (0..1 of full drop).
 * Scale-down and drop share this beat so Buy never "shrinks, waits, then falls".
 */
const OPEN_ANTICIPATION_DROP = 0.22
const OPEN_SPIN_SCALE = 0.8
const OPEN_SCALE_ANTICIPATION_MUL = 0.9
const OPEN_OVERSHOOT_DEG = 12
/** 0 = drop with the spin immediately (no early hold after scale-down). */
const OPEN_SPIN_DROP_START_T = 0
const OPEN_SPIN_TO_DUCK_OVERLAP = 0.24
const OPEN_POST_SHAKE_SCALE = 0.7
const OPEN_POST_SHAKE_OPACITY = 0.4
const OPEN_DUCK_HANDOFF_BLEND = 0.28
const OPEN_DUCK_DEPTH_BLUR_PX = 9
const OPEN_DUCK_BLUR_LEAD_IN_MS = 47
const OPEN_DUCK_BLUR_FULL_AT = 1

type OpenAnimPhase = 'idle' | 'anticipation' | 'spin' | 'duck'

type OpenAnimState = {
  phase: OpenAnimPhase
  startMs: number
  baseRotY: number
  fromX: number
  fromY: number
  fromZ: number
  fromScale: number
  fromRotX: number
  fromRotY: number
  fromRotZ: number
  fromOpacity: number
}

function emptyOpenAnim(): OpenAnimState {
  return {
    phase: 'idle',
    startMs: 0,
    baseRotY: 0,
    fromX: 0,
    fromY: 0,
    fromZ: 0,
    fromScale: 1,
    fromRotX: 0,
    fromRotY: 0,
    fromRotZ: 0,
    fromOpacity: 1,
  }
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function easeInCubic(t: number) {
  const x = clamp01(t)
  return x * x * x
}

function easeOutCubic(t: number) {
  const x = clamp01(t)
  return 1 - Math.pow(1 - x, 3)
}

function easeInOutCubic(t: number) {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

function easeInOutQuint(t: number) {
  const x = clamp01(t)
  return x < 0.5
    ? 16 * x * x * x * x * x
    : 1 - Math.pow(-2 * x + 2, 5) / 2
}

/**
 * Body drop with non-zero early speed so scale+fall never restart from a hold.
 * Linear early, soft ease-out late.
 */
function easeBodyTravel(t: number) {
  const x = clamp01(t)
  const out = 1 - Math.pow(1 - x, 2.4)
  return lerp(x, out, 0.55)
}

function easeOutBackSlow(t: number, overshoot = 1.35) {
  const x = clamp01(t)
  const c1 = overshoot
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function easeDuckProgress(t: number) {
  const x = clamp01(t)
  const out = 1 - Math.pow(1 - x, 2.15)
  const terminal = easeInOutCubic(x)
  return lerp(out, terminal, 0.22)
}

/** Convert reveal world pose into coverflow local space (packs group origin). */
function worldPoseToLocal(
  pose: PackPose,
  packsX: number,
  packsY: number,
): PackPose {
  return {
    x: pose.x - packsX,
    y: pose.y - packsY,
    z: pose.z,
    scale: pose.scale,
    rotX: pose.rotX,
    rotY: pose.rotY,
    rotZ: pose.rotZ,
  }
}


export interface CoverFlowLayoutSettings {
  spacingX: number
  focusZ: number
  sideZ: number
  sideZStep: number
  sideYaw: number
}

export const DEFAULT_COVERFLOW_LAYOUT: CoverFlowLayoutSettings = {
  spacingX: 0.95,
  // Match reveal start pack z.
  focusZ: 0.09,
  sideZ: -0.95,
  sideZStep: 0.12,
  sideYaw: 32,
}

export const MOBILE_COVERFLOW_LAYOUT: CoverFlowLayoutSettings = {
  spacingX: 0.62,
  focusZ: 0.09,
  sideZ: -0.95,
  sideZStep: 0.12,
  sideYaw: 46,
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches
}

function getPreferredCoverFlowLayout(): CoverFlowLayoutSettings {
  return isMobileViewport() ? MOBILE_COVERFLOW_LAYOUT : DEFAULT_COVERFLOW_LAYOUT
}

export interface CoverFlowCameraSettings {
  cameraX: number
  cameraY: number
  cameraZ: number
  fov: number
  lookAtY: number
  packsX: number
  packsY: number
  modelY: number
}

// Match reveal PackStage camera + start pose placement (same card2.glb).
export const DEFAULT_COVERFLOW_CAMERA: CoverFlowCameraSettings = {
  cameraX: 0.11,
  cameraY: 0.27,
  cameraZ: 6.7,
  fov: 36,
  lookAtY: 0.1,
  packsX: -0.01,
  packsY: -0.94,
  modelY: -0.02,
}

export const MOBILE_COVERFLOW_CAMERA: CoverFlowCameraSettings = {
  cameraX: 0.11,
  cameraY: 0.27,
  cameraZ: 6.45,
  fov: 36,
  lookAtY: 0,
  packsX: -0.01,
  packsY: -0.94,
  modelY: -0.3,
}

export interface CoverFlowLightingSettings {
  ambient: number
  hemi: number
  keyX: number
  keyY: number
  keyZ: number
  keyIntensity: number
  fillX: number
  fillY: number
  fillZ: number
  fillIntensity: number
  pointX: number
  pointY: number
  pointZ: number
  pointIntensity: number
}

export const DEFAULT_COVERFLOW_LIGHTING: CoverFlowLightingSettings = {
  ambient: 1.1,
  hemi: 0.85,
  keyX: 2.5,
  keyY: 4,
  keyZ: 3,
  keyIntensity: 1.8,
  fillX: -3,
  fillY: 1.5,
  fillZ: 1.5,
  fillIntensity: 0.75,
  pointX: 0,
  pointY: 2.2,
  pointZ: 2.5,
  pointIntensity: 0.9,
}

// Device orientation maps into the same tilt family as scrub/hover.
// Higher range = less sensitive / slower-feeling response.
const DEVICE_TILT_GAMMA_RANGE = 42
const DEVICE_TILT_BETA_RANGE = 36
// Slight X-axis pitch from phone front/back tilt (smaller than yaw).
const MAX_DEVICE_PITCH = Math.PI / 14
// Lower = smoother/slower catch-up to phone orientation.
const DEVICE_TILT_SMOOTHING = 0.1
// Desktop chevron hold-to-cycle timing.
const CHEVRON_HOLD_INITIAL_MS = 180
const CHEVRON_HOLD_REPEAT_MS = 90
// Hovering a chevron for this long starts auto-cycling in that direction.
const CHEVRON_HOVER_HOLD_MS = 500

/** Packs hex CTA size — slightly shorter on mobile to reduce inner padding. */
const BUY_PACK_CTA_SIZE_DESKTOP = { width: 187, height: 63, fontSize: 12, strokeWidth: 2 }
const BUY_PACK_CTA_SIZE_MOBILE = { width: 176, height: 52, fontSize: 14, strokeWidth: 2 }

/** Local-space bottom-center of the pack mesh (after model rotation, scale 1). */
type PackLocalBottom = {
  x: number
  y: number
  z: number
}

interface CoverFlowCarouselProps {
  items: Iteration[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onDeselect?: () => void
  /** Fires when the centered coverflow pack changes (browse or select). */
  onFocusChange?: (item: Iteration | null, index: number) => void
  /** Product CTA when the focused pack is active. */
  onBuy?: (item: Iteration) => void
  formatPrice?: (price: number) => string
  /** When set, run reveal open sequence in-canvas for this character. */
  revealingCharacterId?: CharacterId | null
  /** Exact coverflow pack id being opened (supports foil slot 1 + 2). */
  revealingPackId?: string | null
  onPlayNow?: (characterId: CharacterId, revealCards: RevealCard[]) => void
  onRevealCancel?: () => void
  /** Override the built-in desktop/mobile camera (homepage debug, etc). */
  cameraSettings?: CoverFlowCameraSettings
  /** Override the built-in desktop/mobile cover-flow spacing. */
  layout?: CoverFlowLayoutSettings
  /** Homepage: ignore swipe-down deactivate so the page can keep scrolling. */
  disableSwipeDownDeactivate?: boolean
  /** Homepage: ignore wheel so it neither pages packs nor traps page scroll. */
  disableWheelPaging?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const MAX_HOVER_YAW = Math.PI / 5.5
// Snappy cover-flow motion with a light bounce on settle.
// ~2x faster swipe transitions between packs.
const SPRING_STIFFNESS = 120
const SPRING_DAMPING = 16
// Active hero pop (Y/Z/scale) should feel unified, fast, and lightly bouncy.
const ACTIVE_SPRING_STIFFNESS = 600
const ACTIVE_SPRING_DAMPING = 28
// Smaller divisor = more sensitive hold-tilt response.
const TILT_SENSITIVITY = 0.11
// Fast follow for hold-tilt so it doesn't feel laggy behind the finger.
const TILT_FOLLOW = 24
// Softer ease back to upright when scrub ends.
const TILT_RETURN = 5.5
// Desktop hover tilt: track the cursor quickly, settle upright gently on leave.
const HOVER_FOLLOW = 14
const HOVER_RETURN = 4.2

/**
	 * Canvas height the base coverflow FOV was tuned against.
	 * Below this, FOV shrinks so pack pixel size does not collapse with height.
	 * (objectPx ∝ height / tan(fov/2) — keep that ratio stable when shorter.)
	 */
	const COVERFLOW_FOV_REF_HEIGHT_PX = 900
	/** Don't collapse framing on very short windows. */
	const COVERFLOW_FOV_MIN_DEG = 20

	function coverflowFovForHeight(baseFovDeg: number, heightPx: number): number {
	  if (heightPx <= 0) return baseFovDeg
	  // Only compensate when shorter than the design height; taller keeps base FOV.
	  if (heightPx >= COVERFLOW_FOV_REF_HEIGHT_PX) return baseFovDeg
	  const baseHalfRad = (baseFovDeg * Math.PI) / 360
	  const targetHalfRad = Math.atan(
	    Math.tan(baseHalfRad) * (heightPx / COVERFLOW_FOV_REF_HEIGHT_PX),
	  )
	  const next = (targetHalfRad * 360) / Math.PI
	  return MathUtils.clamp(next, COVERFLOW_FOV_MIN_DEG, baseFovDeg)
	}

	function CoverFlowCameraController({
	  settings,
	}: {
	  settings: CoverFlowCameraSettings
	}) {
	  const camera = useThree((state) => state.camera) as PerspectiveCamera
	  const size = useThree((state) => state.size)

	  useEffect(() => {
	    // Height-compensated FOV keeps pack on-screen size stable when the
	    // browser gets shorter (stage still fills 100%, packs don't shrink).
	    camera.fov = coverflowFovForHeight(settings.fov, size.height)
	    camera.position.set(settings.cameraX, settings.cameraY, settings.cameraZ)
	    // Match reveal PackStage: look along camera X at fixed Y so pack Y moves in-frame.
	    camera.lookAt(settings.cameraX, settings.lookAtY, 0)
	    camera.updateProjectionMatrix()
	  }, [camera, settings, size.height])

	  return null
	}

function getPackTarget(
  offset: number,
  isActive: boolean,
  _hasActiveSelection: boolean,
  layout: CoverFlowLayoutSettings,
  _isMobile: boolean,
) {
  const absOffset = Math.abs(offset)
  const direction = Math.sign(offset) || 0

  const baseZ =
    absOffset === 0 ? layout.focusZ : layout.sideZ - absOffset * layout.sideZStep
  const baseScale =
    absOffset === 0
      ? FOCUS_SCALE
      : Math.max(FOCUS_SCALE * 0.72, SIDE_SCALE - absOffset * 0.03)

  return {
    x: offset * layout.spacingX,
    // Active pack rises, scales up, and steps closer to camera.
    y: isActive ? ACTIVE_Y_LIFT : 0,
    z: isActive ? baseZ + ACTIVE_Z_FORWARD : baseZ,
    rotY: absOffset === 0 ? 0 : direction * -MathUtils.degToRad(layout.sideYaw),
    scale: isActive ? baseScale * ACTIVE_SCALE_BOOST : baseScale,
  }
}

/**
   * Measure pack bottom-center in the model group's local space
   * (after model rotation, before pack scale/pose). Used to parent the HUD.
   */
function measurePackLocalBottom(
  scene: Object3D,
  modelRotation: { x: number; y: number; z: number },
  modelY: number,
): PackLocalBottom | null {
  const probe = new ThreeGroup()
  const model = new ThreeGroup()
  model.rotation.set(
    MathUtils.degToRad(modelRotation.x),
    MathUtils.degToRad(modelRotation.y),
    MathUtils.degToRad(modelRotation.z),
  )
  // Clone so we never mutate the live pack scene graph.
  const mesh = scene.clone(true)
  mesh.position.set(0, modelY, 0)
  model.add(mesh)
  probe.add(model)
  probe.updateMatrixWorld(true)

  const box = new Box3().setFromObject(probe)
  if (box.isEmpty()) return null

  // Bottom-center of the axis-aligned bounds in probe local space.
  const bottom = new Vector3(
    (box.min.x + box.max.x) * 0.5,
    box.min.y,
    (box.min.z + box.max.z) * 0.5,
  )
  return { x: bottom.x, y: bottom.y, z: bottom.z }
}

function CoverFlowPack({
	  item,
	  index,
	  focusIndex,
	  isActive,
	  hasActiveSelection,
	  modelY,
	  layout,
	  textureTransform,
	  centerTiltYaw,
	  centerTiltPitch,
	  isMobile,
	  shortHudGlass,
	  revealMode,
	  isRevealHero,
	  playOpenSequence,
	  packsX,
	  packsY,
	  openTimeline,
	  openDuckInTimeline,
	  onSelect,
	  onOpenSequenceComplete,
	  onOpenPackBehindFan,
	  onOpenPackBlurChange,
	  formatPrice,
	  onBuy,
	}: {
	  item: Iteration
	  index: number
	  focusIndex: number
	  isActive: boolean
	  hasActiveSelection: boolean
	  modelY: number
	  layout: CoverFlowLayoutSettings
	  textureTransform: VideoTextureTransform
	  centerTiltYaw: number
	  centerTiltPitch: number
	  isMobile: boolean
	  /** Browser height < 550px — frosted glass behind pack HUD. */
	  shortHudGlass: boolean
	  /** True while any pack open sequence is running. */
	  revealMode: boolean
	  /** This pack is the one being opened. */
	  isRevealHero: boolean
	  playOpenSequence: boolean
	  packsX: number
	  packsY: number
	  openTimeline: PackTimeline
	  openDuckInTimeline: DuckInTimeline
	  onSelect: (id: string) => void
	  onOpenSequenceComplete?: () => void
	  onOpenPackBehindFan?: () => void
	  onOpenPackBlurChange?: (blurPx: number) => void
	  formatPrice: (price: number) => string
	  onBuy?: (item: Iteration) => void
	}) {
const groupRef = useRef<Group>(null)
	  const modelRef = useRef<Group>(null)
  // Cursor target vs displayed hover yaw — applied eases so leave isn't a snap.
  const hoverYawTargetRef = useRef(0)
  const hoverYawRef = useRef(0)
  // Applied touch tilt eases toward the live target so release isn't snappy.
  const appliedTiltRef = useRef(0)
  const appliedPitchRef = useRef(0)
  const isHoveredRef = useRef(false)
  // Keep latest focus in a ref so useFrame can animate smoothly without
  // hard-snapping transforms on every React re-render.
  const focusIndexRef = useRef(focusIndex)
  const isActiveRef = useRef(isActive)
  const hasActiveSelectionRef = useRef(hasActiveSelection)
  const layoutRef = useRef(layout)
  const centerTiltYawRef = useRef(centerTiltYaw)
  const centerTiltPitchRef = useRef(centerTiltPitch)
  const isMobileRef = useRef(isMobile)
  const revealModeRef = useRef(revealMode)
  const isRevealHeroRef = useRef(isRevealHero)
  const playOpenSequenceRef = useRef(playOpenSequence)
  const packsXRef = useRef(packsX)
  const packsYRef = useRef(packsY)
  const openTimelineRef = useRef(openTimeline)
  const openDuckInTimelineRef = useRef(openDuckInTimeline)
  const onOpenSequenceCompleteRef = useRef(onOpenSequenceComplete)
  const onOpenPackBehindFanRef = useRef(onOpenPackBehindFan)
  const onOpenPackBlurChangeRef = useRef(onOpenPackBlurChange)
  const lastBlurRef = useRef(0)
  const seededRef = useRef(false)
  const sideFadeRef = useRef(1)
  const openAnimRef = useRef<OpenAnimState>(emptyOpenAnim())
  const wasPlayingOpenRef = useRef(false)
  // Stays true after spin/duck finish so the hero holds the tucked pose
  // instead of snapping back into coverflow springs.
  const openHoldRef = useRef(false)
  const modelRotRef = useRef({
    x: item.modelRotation.x,
    y: item.modelRotation.y,
    z: item.modelRotation.z,
  })
  const opacityRef = useRef(1)
  const motionRef = useRef({
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    scale: 1,
    vx: 0,
    vy: 0,
    vz: 0,
    vRotY: 0,
    vScale: 0,
  })

  useEffect(() => {
    focusIndexRef.current = focusIndex
  }, [focusIndex])

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    hasActiveSelectionRef.current = hasActiveSelection
  }, [hasActiveSelection])

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    centerTiltYawRef.current = centerTiltYaw
  }, [centerTiltYaw])

  useEffect(() => {
    centerTiltPitchRef.current = centerTiltPitch
  }, [centerTiltPitch])

  useEffect(() => {
    isMobileRef.current = isMobile
  }, [isMobile])

  useEffect(() => {
    revealModeRef.current = revealMode
  }, [revealMode])

  useEffect(() => {
    isRevealHeroRef.current = isRevealHero
  }, [isRevealHero])

  useEffect(() => {
    playOpenSequenceRef.current = playOpenSequence
  }, [playOpenSequence])

  useEffect(() => {
    packsXRef.current = packsX
  }, [packsX])

  useEffect(() => {
    packsYRef.current = packsY
  }, [packsY])

  useEffect(() => {
    openTimelineRef.current = openTimeline
  }, [openTimeline])

  useEffect(() => {
    openDuckInTimelineRef.current = openDuckInTimeline
  }, [openDuckInTimeline])

  useEffect(() => {
    onOpenSequenceCompleteRef.current = onOpenSequenceComplete
  }, [onOpenSequenceComplete])

  useEffect(() => {
    onOpenPackBehindFanRef.current = onOpenPackBehindFan
  }, [onOpenPackBehindFan])

  useEffect(() => {
    onOpenPackBlurChangeRef.current = onOpenPackBlurChange
  }, [onOpenPackBlurChange])

  // Fresh open run when playOpenSequence rises on the hero.
  useEffect(() => {
    if (!isRevealHero) {
      wasPlayingOpenRef.current = false
      openHoldRef.current = false
      openAnimRef.current = emptyOpenAnim()
      // Leaving reveal: restore full opacity / model rest rotation for browse.
      opacityRef.current = 1
      sideFadeRef.current = 1
      modelRotRef.current = {
        x: item.modelRotation.x,
        y: item.modelRotation.y,
        z: item.modelRotation.z,
      }
      if (modelRef.current) {
        modelRef.current.rotation.set(
          MathUtils.degToRad(item.modelRotation.x),
          MathUtils.degToRad(item.modelRotation.y),
          MathUtils.degToRad(item.modelRotation.z),
        )
      }
      if (groupRef.current) {
        groupRef.current.traverse((object) => {
          const mesh = object as { isMesh?: boolean; material?: any }
          if (!mesh.isMesh) return
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          for (const material of materials) {
            if (!material || !('opacity' in material)) continue
            material.transparent = false
            material.opacity = 1
            material.depthWrite = true
            material.needsUpdate = true
          }
        })
      }
      lastBlurRef.current = 0
      onOpenPackBlurChangeRef.current?.(0)
      return
    }
    if (playOpenSequence && !wasPlayingOpenRef.current) {
      const motion = motionRef.current
      const modelRot = modelRotRef.current
      openAnimRef.current = {
        ...emptyOpenAnim(),
        phase: 'anticipation',
        startMs: performance.now(),
        baseRotY: modelRot.y,
        fromX: motion.x,
        fromY: motion.y,
        fromZ: motion.z,
        fromScale: motion.scale,
        fromRotX: modelRot.x,
        fromRotY: modelRot.y,
        fromRotZ: modelRot.z,
        fromOpacity: opacityRef.current,
      }
      hoverYawTargetRef.current = 0
      hoverYawRef.current = 0
      appliedTiltRef.current = 0
      appliedPitchRef.current = 0
      lastBlurRef.current = -1
      openHoldRef.current = false
      wasPlayingOpenRef.current = true
      return
    }
    if (!playOpenSequence) {
      wasPlayingOpenRef.current = false
    }
  }, [isRevealHero, playOpenSequence, item.modelRotation.x, item.modelRotation.y, item.modelRotation.z])

  const offset = index - focusIndex
  const isCenter = offset === 0
  const modelUrl = item.modelUrl || PACK_MODEL_URL
  const gltf = useGLTF(modelUrl)
  // Local pack-bottom anchor for DOM HUD (title / pack Nº / CTA).
  const hudLocalBottom = useMemo(
    () =>
      measurePackLocalBottom(gltf.scene, item.modelRotation, modelY) ?? {
        x: 0,
        y: -0.95,
        z: 0,
      },
    [
      gltf.scene,
      item.modelRotation.x,
      item.modelRotation.y,
      item.modelRotation.z,
      modelY,
    ],
  )
// Sit slightly in front of the pack face, raised above the mesh bottom.
	  const activeHudPosition = useMemo(
	    () =>
	      [
	        hudLocalBottom.x,
	        hudLocalBottom.y + 0.69,
	        hudLocalBottom.z + 0.12,
	      ] as [number, number, number],
	    [hudLocalBottom.x, hudLocalBottom.y, hudLocalBottom.z],
	  )
	  // Inactive browse label sits ~20% higher on Y than the active stack anchor.
	  const browseHudPosition = useMemo(
	    () =>
	      [
	        hudLocalBottom.x,
	        hudLocalBottom.y + 0.828,
	        hudLocalBottom.z + 0.12,
	      ] as [number, number, number],
	    [hudLocalBottom.x, hudLocalBottom.y, hudLocalBottom.z],
	  )
const ctaSize = isMobile ? BUY_PACK_CTA_SIZE_MOBILE : BUY_PACK_CTA_SIZE_DESKTOP
	  // Keep HUDs mounted through exit transitions (browse hide + active stack out).
	  // Seed centered browse HUD mounted on first paint so reload doesn't wait for hover.
	  const [browseHudMounted, setBrowseHudMounted] = useState(
	    () => isCenter && !revealMode,
	  )
	  const [browseHudVisible, setBrowseHudVisible] = useState(false)
	  const [activeHudMounted, setActiveHudMounted] = useState(
	    () => isActive && !revealMode,
	  )
	  const [activeHudVisible, setActiveHudVisible] = useState(false)
	  const invalidate = useThree((state) => state.invalidate)
	  // First centered appearance can animate in immediately; return-from-active waits a beat.
	  const browseEverVisibleRef = useRef(false)

	  // Match CSS exit durations so unmount doesn't cut transitions short.
	  const BROWSE_HUD_EXIT_MS = 520
	  const ACTIVE_HUD_EXIT_MS = 560
	  // After deselect, let active stack start exiting before browse fades back in.
	  const BROWSE_REENTER_DELAY_MS = 70

	  useEffect(() => {
	    if (revealMode) {
	      setBrowseHudMounted(false)
	      setBrowseHudVisible(false)
	      browseEverVisibleRef.current = false
	      return
	    }

	    let raf1 = 0
	    let raf2 = 0
	    let showTimer = 0
	    let hideTimer = 0

	    const clearRafs = () => {
	      window.cancelAnimationFrame(raf1)
	      window.cancelAnimationFrame(raf2)
	    }

	    const revealBrowse = (delayMs: number) => {
	      showTimer = window.setTimeout(() => {
	        // Two rAFs so CSS can paint the hidden state before is-visible.
	        raf1 = window.requestAnimationFrame(() => {
	          raf2 = window.requestAnimationFrame(() => {
	            setBrowseHudVisible(true)
	            browseEverVisibleRef.current = true
	            // Demand a frame so drei Html projects before any pointer event.
	            invalidate()
	          })
	        })
	      }, delayMs)
	    }

	    // Mount while centered (including active, so hide-out can play).
	    if (isCenter) {
	      setBrowseHudMounted(true)
	      if (isActive) {
	        // Active wins: fade browse out with blur (CSS is-active-hidden).
	        setBrowseHudVisible(false)
	        return () => {
	          clearRafs()
	          window.clearTimeout(showTimer)
	          window.clearTimeout(hideTimer)
	        }
	      }

	      // First load: animate in quickly. Return from active: short handoff delay.
	      const delayMs = browseEverVisibleRef.current ? BROWSE_REENTER_DELAY_MS : 32
	      revealBrowse(delayMs)

	      return () => {
	        clearRafs()
	        window.clearTimeout(showTimer)
	        window.clearTimeout(hideTimer)
	      }
	    }

	    // Leaving center: play exit, then unmount.
	    setBrowseHudVisible(false)
	    hideTimer = window.setTimeout(
	      () => setBrowseHudMounted(false),
	      BROWSE_HUD_EXIT_MS,
	    )
	    return () => {
	      clearRafs()
	      window.clearTimeout(showTimer)
	      window.clearTimeout(hideTimer)
	    }
	  }, [isCenter, isActive, revealMode, item.id, invalidate])

	  useEffect(() => {
	    if (revealMode) {
	      setActiveHudMounted(false)
	      setActiveHudVisible(false)
	      return
	    }

	    let raf1 = 0
	    let raf2 = 0
	    let hideTimer = 0

	    if (isActive) {
	      setActiveHudMounted(true)
	      raf1 = window.requestAnimationFrame(() => {
	        raf2 = window.requestAnimationFrame(() => {
	          setActiveHudVisible(true)
	          invalidate()
	        })
	      })
	      return () => {
	        window.cancelAnimationFrame(raf1)
	        window.cancelAnimationFrame(raf2)
	        window.clearTimeout(hideTimer)
	      }
	    }

	    // Deselect: reverse stagger + blur, then unmount after exit settles.
	    setActiveHudVisible(false)
	    hideTimer = window.setTimeout(
	      () => setActiveHudMounted(false),
	      ACTIVE_HUD_EXIT_MS,
	    )
	    return () => {
	      window.cancelAnimationFrame(raf1)
	      window.cancelAnimationFrame(raf2)
	      window.clearTimeout(hideTimer)
	    }
	  }, [isActive, revealMode, item.id, invalidate])
  // Hero keeps playing during open; others freeze.
  const { texture } = useVideoTexture(
    item.videoUrl || PACK_VIDEO_URL,
    item.fitMode || PACK_VIDEO_FIT_MODE,
    textureTransform,
    {
      flipY: true,
      playing:
        (isCenter && (!hasActiveSelection || isActive)) ||
        (isRevealHero && revealMode),
      textureSize: PACK_TEXTURE_SIZE,
      enabled: true,
      soft: false,
    },
  )

const scene = useMemo(() => cloneSceneWithMaterials(gltf.scene), [gltf.scene])
	  const targetMaterial = useMemo(() => resolveTargetMaterial(scene), [scene])

	  // Seed pack pose before first paint so pack-attached Html isn't stuck at origin
	  // until the first pointer/frame interaction.
	  useLayoutEffect(() => {
	    if (!groupRef.current || seededRef.current) return
	    const target = getPackTarget(
	      index - focusIndex,
	      isActive,
	      hasActiveSelection,
	      layout,
	      isMobile,
	    )
	    groupRef.current.position.set(target.x, target.y, target.z)
	    groupRef.current.rotation.x = 0
	    groupRef.current.rotation.y = target.rotY
	    groupRef.current.scale.setScalar(target.scale)
	    groupRef.current.visible = true
	    motionRef.current = {
	      x: target.x,
	      y: target.y,
	      z: target.z,
	      rotY: target.rotY,
	      scale: target.scale,
	      vx: 0,
	      vy: 0,
	      vz: 0,
	      vRotY: 0,
	      vScale: 0,
	    }
	    sideFadeRef.current = 1
	    seededRef.current = true
	    invalidate()
	  }, [
	    focusIndex,
	    hasActiveSelection,
	    index,
	    invalidate,
	    isActive,
	    isMobile,
	    layout,
	  ])

	  useEffect(() => {
	    if (!targetMaterial || !texture) return
	    return applyPackFaceMaterial(targetMaterial, texture)
	  }, [targetMaterial, texture])

  const setPackBlur = (blurPx: number) => {
    const next = Math.max(0, blurPx)
    if (Math.abs(lastBlurRef.current - next) < 0.05) return
    lastBlurRef.current = next
    onOpenPackBlurChangeRef.current?.(next)
  }

  const applyOpacity = (opacity: number) => {
    opacityRef.current = opacity
    if (!groupRef.current) return
    groupRef.current.traverse((object) => {
      const mesh = object as { isMesh?: boolean; material?: any }
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      for (const material of materials) {
        if (!material || !('opacity' in material)) continue
        material.transparent = opacity < 0.999
        material.opacity = opacity
        material.depthWrite = opacity > 0.95
        material.needsUpdate = true
      }
    })
  }

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return
    }

    const liveOffset = index - focusIndexRef.current
    const isLiveCenter = liveOffset === 0
    const dt = Math.min(delta, 1 / 30)

    // ---- Hero open sequence: same pack, spin/duck in place ----
    if (isRevealHeroRef.current && openAnimRef.current.phase !== 'idle') {
      const openAnim = openAnimRef.current
      const tl = openTimelineRef.current
      const packsX = packsXRef.current
      const packsY = packsYRef.current
      const end = worldPoseToLocal(tl.end, packsX, packsY)
      const motion = motionRef.current
      const modelRot = modelRotRef.current

      // Kill coverflow yaw/tilt while opening.
      motion.rotY = 0
      motion.vx = 0
      motion.vy = 0
      motion.vz = 0
      motion.vRotY = 0
      motion.vScale = 0

      if (openAnim.phase === 'anticipation') {
        const elapsed = performance.now() - openAnim.startMs
        const t = clamp01(elapsed / OPEN_ANTICIPATION_MS)
        const wind = easeInCubic(t)
        // One motion from Buy: scale dips while body already falls live→End.
        // Ease-in builds drop speed into the spin so there's no shrink-then-wait.
        const dropT = easeInCubic(t) * OPEN_ANTICIPATION_DROP
        motion.x = lerp(openAnim.fromX, end.x, dropT)
        motion.y = lerp(openAnim.fromY, end.y, dropT)
        motion.z = lerp(openAnim.fromZ, end.z, dropT)
        const anticScale = openAnim.fromScale * OPEN_SCALE_ANTICIPATION_MUL
        // Scale-down finishes as drop speed builds — same beat, not before it.
        motion.scale = lerp(openAnim.fromScale, anticScale, wind)
        modelRot.x = lerp(openAnim.fromRotX, end.rotX, dropT)
        modelRot.z = lerp(openAnim.fromRotZ, end.rotZ, dropT)
        modelRot.y =
          openAnim.baseRotY - wind * OPEN_ANTICIPATION_DEG
        applyOpacity(1)
        setPackBlur(0)

        groupRef.current.position.set(motion.x, motion.y, motion.z)
        groupRef.current.rotation.set(0, 0, 0)
        groupRef.current.scale.setScalar(motion.scale)
        if (modelRef.current) {
          modelRef.current.rotation.set(
            MathUtils.degToRad(modelRot.x),
            MathUtils.degToRad(modelRot.y),
            MathUtils.degToRad(modelRot.z),
          )
        }
        groupRef.current.visible = true

        if (t < 1) return

        openAnim.phase = 'spin'
        openAnim.startMs = performance.now()
        openAnim.baseRotY = modelRot.y
        openAnim.fromX = motion.x
        openAnim.fromY = motion.y
        openAnim.fromZ = motion.z
        openAnim.fromScale = motion.scale
        openAnim.fromRotX = modelRot.x
        openAnim.fromRotY = modelRot.y
        openAnim.fromRotZ = modelRot.z
        // Fall through into spin this frame — no parked hold after scale-down.
      }

      if (openAnim.phase === 'spin') {
        // Always recompute from spin startMs (including the fall-through frame).
        const elapsed = performance.now() - openAnim.startMs
        const t = clamp01(elapsed / OPEN_SPIN_MS)
        const spinEased = easeInOutCubic(t)
        // Continue drop from the live anticipation pose so scale+fall never restart.
        const dropSpan = Math.max(1e-4, 1 - OPEN_SPIN_DROP_START_T)
        const dropRaw = clamp01((t - OPEN_SPIN_DROP_START_T) / dropSpan)
        const spinDropPortion = easeBodyTravel(dropRaw)
        // Remap remaining travel: live pose → end over the spin drop curve.
        const remainT =
          spinDropPortion * (1 - OPEN_SPIN_TO_DUCK_OVERLAP * 0.35)
        motion.x = lerp(openAnim.fromX, end.x, remainT)
        motion.y = lerp(openAnim.fromY, end.y, remainT)
        motion.z = lerp(openAnim.fromZ, end.z, remainT)
        modelRot.x = lerp(openAnim.fromRotX, end.rotX, remainT)
        modelRot.z = lerp(openAnim.fromRotZ, end.rotZ, remainT)

        // Scale keeps moving with the drop: soft recover toward spin peak, then end.
        const spinScale = lerp(openAnim.fromScale, OPEN_SPIN_SCALE, spinEased)
        motion.scale = lerp(spinScale, end.scale, spinDropPortion)

        const spinPathDeg = OPEN_ANTICIPATION_DEG + OPEN_SPIN_TURNS * 360
        const spunY = openAnim.baseRotY + spinEased * spinPathDeg
        const turns = Math.round((spunY - end.rotY) / 360)
        const spunNorm = spunY - turns * 360
        const overshootTarget = end.rotY + OPEN_OVERSHOOT_DEG
        const yawSettle = easeOutCubic(clamp01((t - 0.5) / 0.5))
        const yawEased = easeOutBackSlow(yawSettle, 1.15)
        modelRot.y = lerp(spunNorm, overshootTarget, yawEased)
        if (t > 0.78) {
          const finalSettle = easeOutCubic((t - 0.78) / 0.22) * 0.72
          modelRot.y = lerp(modelRot.y, end.rotY, finalSettle)
        }

        const handoffT = 1 - OPEN_SPIN_TO_DUCK_OVERLAP
        const spinBlurAmt = Math.sin(Math.PI * Math.min(1, t / handoffT))
        const handoffFade = clamp01(
          (t - handoffT) / Math.max(1e-4, OPEN_SPIN_TO_DUCK_OVERLAP),
        )
        const spinBlur =
          spinBlurAmt * OPEN_SPIN_BLUR_PX * (1 - handoffFade)
        const blurLeadInT = OPEN_DUCK_BLUR_LEAD_IN_MS / OPEN_SPIN_MS
        const blurLeadStart = handoffT - blurLeadInT
        const depthLead = easeInCubic(
          clamp01(
            (t - blurLeadStart) /
            Math.max(1e-4, blurLeadInT + OPEN_SPIN_TO_DUCK_OVERLAP),
          ),
        )
        setPackBlur(Math.max(spinBlur, depthLead * OPEN_DUCK_DEPTH_BLUR_PX * 0.16))
        applyOpacity(1)

        groupRef.current.position.set(motion.x, motion.y, motion.z)
        groupRef.current.rotation.set(0, 0, 0)
        groupRef.current.scale.setScalar(motion.scale)
        if (modelRef.current) {
          modelRef.current.rotation.set(
            MathUtils.degToRad(modelRot.x),
            MathUtils.degToRad(modelRot.y),
            MathUtils.degToRad(modelRot.z),
          )
        }
        groupRef.current.visible = true

        if (t < handoffT) return

        onOpenPackBehindFanRef.current?.()
        openAnim.phase = 'duck'
        openAnim.startMs = performance.now()
        openAnim.fromX = motion.x
        openAnim.fromY = motion.y
        openAnim.fromZ = motion.z
        openAnim.fromScale = motion.scale
        openAnim.fromRotX = modelRot.x
        openAnim.fromRotY = modelRot.y
        openAnim.fromRotZ = modelRot.z
        openAnim.fromOpacity = 1
        // fall through into duck this frame
      }

      if (openAnim.phase === 'duck') {
        const duckElapsed = performance.now() - openAnim.startMs
        const t = clamp01(duckElapsed / POST_SHAKE_MOVE_MS)
        const duckT = easeDuckProgress(t)
        const duckWorld = sampleDuckInPose(openDuckInTimelineRef.current, duckT)
        const duckPose = worldPoseToLocal(duckWorld as PackPose, packsX, packsY)
        const blendU = clamp01(t / OPEN_DUCK_HANDOFF_BLEND)
        const blend = blendU * blendU * (3 - 2 * blendU)
        const fadeT = easeInOutQuint(t)
        const depthT = easeInCubic(clamp01(t / OPEN_DUCK_BLUR_FULL_AT))
        setPackBlur(lerp(0.16, 1, depthT) * OPEN_DUCK_DEPTH_BLUR_PX)

        const carryEase = easeOutCubic(t)
        const carryX = lerp(openAnim.fromX, end.x, carryEase)
        const carryY = lerp(openAnim.fromY, end.y, carryEase)
        const carryZ = lerp(openAnim.fromZ, end.z, carryEase)
        const carryRotX = lerp(openAnim.fromRotX, end.rotX, carryEase)
        const carryRotY = lerp(openAnim.fromRotY, end.rotY, carryEase)
        const carryRotZ = lerp(openAnim.fromRotZ, end.rotZ, carryEase)

        if (blend < 1) {
          motion.x = lerp(carryX, duckPose.x, blend)
          motion.y = lerp(carryY, duckPose.y, blend)
          motion.z = lerp(carryZ, duckPose.z, blend)
          modelRot.x = lerp(carryRotX, duckPose.rotX, blend)
          modelRot.y = lerp(carryRotY, duckPose.rotY, blend)
          modelRot.z = lerp(carryRotZ, duckPose.rotZ, blend)
        } else {
          motion.x = duckPose.x
          motion.y = duckPose.y
          motion.z = duckPose.z
          modelRot.x = duckPose.rotX
          modelRot.y = duckPose.rotY
          modelRot.z = duckPose.rotZ
        }

        const scaleT = easeOutCubic(t) * 0.35 + easeInOutQuint(t) * 0.65
        motion.scale = lerp(openAnim.fromScale, OPEN_POST_SHAKE_SCALE, scaleT)
        const opacity = lerp(1, OPEN_POST_SHAKE_OPACITY, fadeT)
        applyOpacity(opacity)

        groupRef.current.position.set(motion.x, motion.y, motion.z)
        groupRef.current.rotation.set(0, 0, 0)
        groupRef.current.scale.setScalar(motion.scale)
        if (modelRef.current) {
          modelRef.current.rotation.set(
            MathUtils.degToRad(modelRot.x),
            MathUtils.degToRad(modelRot.y),
            MathUtils.degToRad(modelRot.z),
          )
        }
        groupRef.current.visible = true

        if (t < 1) return

        const endDuck = sampleDuckInPose(openDuckInTimelineRef.current, 1)
        const endLocal = worldPoseToLocal(endDuck as PackPose, packsX, packsY)
        motion.x = endLocal.x
        motion.y = endLocal.y
        motion.z = endLocal.z
        motion.scale = OPEN_POST_SHAKE_SCALE
        modelRot.x = endLocal.rotX
        modelRot.y = endLocal.rotY
        modelRot.z = endLocal.rotZ
        applyOpacity(OPEN_POST_SHAKE_OPACITY)
        setPackBlur(OPEN_DUCK_DEPTH_BLUR_PX)
        groupRef.current.position.set(motion.x, motion.y, motion.z)
        groupRef.current.rotation.set(0, 0, 0)
        groupRef.current.scale.setScalar(motion.scale)
        if (modelRef.current) {
          modelRef.current.rotation.set(
            MathUtils.degToRad(modelRot.x),
            MathUtils.degToRad(modelRot.y),
            MathUtils.degToRad(modelRot.z),
          )
        }
        openAnim.phase = 'idle'
        openHoldRef.current = true
        onOpenSequenceCompleteRef.current?.()
        return
      }
    }

    // Hold tucked pose after open finishes — freeze completely (no coverflow springs).
    // Keep holding even if reveal flags flicker during Play-now route exit.
    if (
      openHoldRef.current &&
      openAnimRef.current.phase === 'idle' &&
      (isRevealHeroRef.current || revealModeRef.current)
    ) {
      groupRef.current.visible = true
      return
    }

    // ---- Normal coverflow motion ----
    const target = getPackTarget(
      liveOffset,
      isActiveRef.current,
      hasActiveSelectionRef.current,
      layoutRef.current,
      isMobileRef.current,
    )

    // Seed only once on first frame so later focus changes can ease.
    if (!seededRef.current) {
      groupRef.current.position.set(target.x, target.y, target.z)
      groupRef.current.rotation.x = 0
      groupRef.current.rotation.y = target.rotY
      groupRef.current.scale.setScalar(target.scale)
      motionRef.current = {
        x: target.x,
        y: target.y,
        z: target.z,
        rotY: target.rotY,
        scale: target.scale,
        vx: 0,
        vy: 0,
        vz: 0,
        vRotY: 0,
        vScale: 0,
      }
      modelRotRef.current = {
        x: item.modelRotation.x,
        y: item.modelRotation.y,
        z: item.modelRotation.z,
      }
      if (modelRef.current) {
        modelRef.current.rotation.set(
          MathUtils.degToRad(item.modelRotation.x),
          MathUtils.degToRad(item.modelRotation.y),
          MathUtils.degToRad(item.modelRotation.z),
        )
      }
      sideFadeRef.current = 1
      applyOpacity(1)
      seededRef.current = true
      return
    }

    // Desktop hover tilt (touch tilt is driven by centerTiltYaw from stage gestures).
    // Target jumps with the cursor; displayed yaw eases toward it / back to 0.
    if (
      !isLiveCenter ||
      !isHoveredRef.current ||
      Math.abs(centerTiltYawRef.current) > 0.001 ||
      revealModeRef.current
    ) {
      hoverYawTargetRef.current = 0
    }
    const hoverTarget = hoverYawTargetRef.current
    const hoverFollow =
      Math.abs(hoverTarget) > 0.0001 ? HOVER_FOLLOW : HOVER_RETURN
    hoverYawRef.current = MathUtils.lerp(
      hoverYawRef.current,
      hoverTarget,
      1 - Math.exp(-hoverFollow * delta),
    )
    if (Math.abs(hoverYawRef.current) < 0.00005) {
      hoverYawRef.current = 0
    }

    const targetTouchTilt =
      isLiveCenter && !revealModeRef.current ? centerTiltYawRef.current : 0
    const targetPitch =
      isLiveCenter && !revealModeRef.current ? centerTiltPitchRef.current : 0
    const tiltFollow =
      Math.abs(targetTouchTilt) > 0.0001 || Math.abs(targetPitch) > 0.0001
        ? TILT_FOLLOW
        : TILT_RETURN
    appliedTiltRef.current = MathUtils.lerp(
      appliedTiltRef.current,
      targetTouchTilt,
      1 - Math.exp(-tiltFollow * delta),
    )
    appliedPitchRef.current = MathUtils.lerp(
      appliedPitchRef.current,
      targetPitch,
      1 - Math.exp(-tiltFollow * delta),
    )
    if (Math.abs(appliedTiltRef.current) < 0.00005) {
      appliedTiltRef.current = 0
    }
    if (Math.abs(appliedPitchRef.current) < 0.00005) {
      appliedPitchRef.current = 0
    }

    const touchTilt = appliedTiltRef.current
    // Keep easing hover yaw even after pointer-out so the settle stays visible.
    const hoverTilt =
      isLiveCenter && Math.abs(touchTilt) < 0.0001 ? hoverYawRef.current : 0
    const interactiveTilt = touchTilt || hoverTilt
    const interactivePitch = appliedPitchRef.current

    const motion = motionRef.current
    const isActiveMotion = isActiveRef.current
    const baseDamp = Math.exp(-SPRING_DAMPING * dt)
    const activeDamp = Math.exp(-ACTIVE_SPRING_DAMPING * dt)
    const baseStiff = SPRING_STIFFNESS
    const activeStiff = ACTIVE_SPRING_STIFFNESS

    motion.vx = (motion.vx + (target.x - motion.x) * baseStiff * dt) * baseDamp
    motion.vRotY =
      (motion.vRotY + (target.rotY - motion.rotY) * baseStiff * dt) * baseDamp

    const isHeroPoseMotion =
      isActiveMotion ||
      Math.abs(target.y) > 0.001 ||
      Math.abs(target.scale - FOCUS_SCALE) > 0.001 ||
      Math.abs(motion.y) > 0.001 ||
      Math.abs(motion.scale - FOCUS_SCALE) > 0.001 ||
      Math.abs(motion.vy) > 0.001 ||
      Math.abs(motion.vz) > 0.001 ||
      Math.abs(motion.vScale) > 0.001
    const heroStiff = isHeroPoseMotion ? activeStiff : baseStiff
    const heroDamp = isHeroPoseMotion ? activeDamp : baseDamp
    motion.vy = (motion.vy + (target.y - motion.y) * heroStiff * dt) * heroDamp
    motion.vz = (motion.vz + (target.z - motion.z) * heroStiff * dt) * heroDamp
    motion.vScale =
      (motion.vScale + (target.scale - motion.scale) * heroStiff * dt) * heroDamp

    motion.x += motion.vx * dt
    motion.y += motion.vy * dt
    motion.z += motion.vz * dt
    motion.rotY += motion.vRotY * dt
    motion.scale += motion.vScale * dt

groupRef.current.position.set(motion.x, motion.y, motion.z)
	    groupRef.current.rotation.x = interactivePitch
	    groupRef.current.rotation.y = motion.rotY + interactiveTilt
	    groupRef.current.scale.setScalar(motion.scale)

	    // Restore default model rotation while browsing.
    modelRotRef.current = {
      x: item.modelRotation.x,
      y: item.modelRotation.y,
      z: item.modelRotation.z,
    }
    if (modelRef.current) {
      modelRef.current.rotation.set(
        MathUtils.degToRad(item.modelRotation.x),
        MathUtils.degToRad(item.modelRotation.y),
        MathUtils.degToRad(item.modelRotation.z),
      )
    }

    // Side packs fade out during reveal; hero stays fully opaque.
    const fadeTarget =
      revealModeRef.current && !isRevealHeroRef.current ? 0 : 1
    sideFadeRef.current = MathUtils.lerp(
      sideFadeRef.current,
      fadeTarget,
      1 - Math.exp(-8 * delta),
    )
    const maxVisibleOffset = isMobileRef.current
      ? MAX_VISIBLE_OFFSET_MOBILE
      : MAX_VISIBLE_OFFSET_DESKTOP
    const inRange = Math.abs(liveOffset) <= maxVisibleOffset
    const opacity = sideFadeRef.current
    applyOpacity(opacity)
    groupRef.current.visible =
      inRange && (isRevealHeroRef.current || opacity > 0.02)
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (revealModeRef.current) return
    onSelect(item.id)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.pointerType === 'touch' ||
      !isCenter ||
      !groupRef.current ||
      revealModeRef.current
    ) {
      return
    }

    const localX = event.point.x - groupRef.current.position.x
    const normalizedX = MathUtils.clamp(localX / 0.9, -1, 1)
    // Only update the target; useFrame eases the visible yaw toward it.
    hoverYawTargetRef.current = normalizedX * MAX_HOVER_YAW
  }

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerMove={isCenter ? handlePointerMove : undefined}
      onPointerOver={(event) => {
        if (event.pointerType === 'touch' || revealModeRef.current) {
          return
        }
        if (isCenter) {
          isHoveredRef.current = true
        }
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(event) => {
        if (event.pointerType === 'touch') {
          return
        }
        isHoveredRef.current = false
        document.body.style.cursor = 'auto'
      }}
    >
      <group
        ref={modelRef}
        rotation={[
          MathUtils.degToRad(item.modelRotation.x),
          MathUtils.degToRad(item.modelRotation.y),
          MathUtils.degToRad(item.modelRotation.z),
        ]}
      >
        <primitive object={scene} position={[0, modelY, 0]} />
      </group>

{/*
	        Screen-space HUD parented for position only.
	        transform=false + no distanceFactor => constant CSS size
	        (labels/CTA never scale with pack pop, FOV, or camera distance).
	      */}
{browseHudMounted ? (
		        <Html
		          position={browseHudPosition}
		          center
		          transform={false}
		          sprite={false}
		          zIndexRange={[20, 0]}
		          style={{ pointerEvents: 'none' }}
wrapperClass={`coverflow-pack-html coverflow-pack-html--browse${
	            isActive
	              ? ' is-active-hidden'
	              : browseHudVisible
	                ? ' is-visible'
	                : ''
	          }${shortHudGlass ? ' is-short-glass' : ''}`}
	        >
	          <div
	            className={`coverflow-pack-html-label${
	              isActive
	                ? ' is-active-hidden'
	                : browseHudVisible
	                  ? ' is-visible'
	                  : ''
	            }${shortHudGlass ? ' is-short-glass' : ''}`}
	            aria-hidden={isActive || !browseHudVisible}
	          >
	            <p className="coverflow-pack-label__collection">
	              {formatPackCollectionLabel(item.girlName)}
	            </p>
	            <p className="coverflow-pack-label__pack">
	              {formatPackNumberLabel(item.girlName, item.packNumber)}
	            </p>
	          </div>
	        </Html>
	      ) : null}

{activeHudMounted ? (
		        <Html
		          position={activeHudPosition}
		          center
		          transform={false}
		          sprite={false}
		          zIndexRange={[30, 0]}
		          style={{ pointerEvents: 'none' }}
wrapperClass={`coverflow-pack-html coverflow-pack-html--active${
	            activeHudVisible ? ' is-visible' : ''
	          }${shortHudGlass ? ' is-short-glass' : ''}`}
	        >
	          <div
	            className={`coverflow-active-stack coverflow-active-stack--html${
	              activeHudVisible ? ' is-visible' : ''
	            }${shortHudGlass ? ' is-short-glass' : ''}`}
	            style={{ ['--active-stack-gap' as string]: '1rem' }}
	            aria-hidden={!activeHudVisible}
	          >
	            <div className="coverflow-active-pack-label">
	              <p className="coverflow-pack-label__collection">
	                {formatPackCollectionLabel(item.girlName)}
	              </p>
	              <p className="coverflow-pack-label__pack">
	                {formatPackNumberLabel(item.girlName, item.packNumber)}
	              </p>
	            </div>
	            <div className="coverflow-buy-pack-cta">
	              <CtaButton
	                {...ctaButtonPropsFromTemplate('hexGoldCTA')}
	                {...ctaSize}
	                auroraPaused={isMobile}
	                glowOuterBloom={isMobile ? 'lite' : 'full'}
	                label="Buy Pack"
	                costAmount={formatPrice(item.price ?? 4.99)}
	                className="coverflow-buy-pack-cta__button"
	                tabIndex={0}
	                onClick={(event) => {
	                  event.stopPropagation()
	                  onBuy?.(item)
	                }}
	              />
	            </div>
	          </div>
	        </Html>
	      ) : null}
    </group>
  )
}

function CoverFlowScene({
	  items,
	  focusIndex,
	  selectedId,
	  cameraSettings,
	  layout,
	  textureTransform,
	  centerTiltYaw,
	  centerTiltPitch,
	  isMobile,
	  shortHudGlass,
	  revealMode,
	  revealingPackId,
	  revealPlaySequence,
	  revealTimeline,
	  revealDuckInTimeline,
	  onSelect,
	  onRevealSequenceComplete,
	  onRevealPackBehindFan,
	  onRevealPackBlurChange,
	  formatPrice,
	  onBuy,
	}: {
	  items: Iteration[]
	  focusIndex: number
	  selectedId: string | null
	  cameraSettings: CoverFlowCameraSettings
	  layout: CoverFlowLayoutSettings
	  textureTransform: VideoTextureTransform
	  centerTiltYaw: number
	  centerTiltPitch: number
	  isMobile: boolean
	  shortHudGlass: boolean
	  revealMode: boolean
	  revealingPackId: string | null
	  revealPlaySequence: boolean
	  revealTimeline: PackTimeline
	  revealDuckInTimeline: DuckInTimeline
	  onSelect: (id: string) => void
	  onRevealSequenceComplete?: () => void
	  onRevealPackBehindFan?: () => void
	  onRevealPackBlurChange?: (blurPx: number) => void
	  formatPrice: (price: number) => string
	  onBuy?: (item: Iteration) => void
	}) {
	  const hasActiveSelection = selectedId !== null

	  return (
	    <>
	      <CoverFlowCameraController settings={cameraSettings} />
	      <PackStageExposure />
	      <PackLights />

	      <group position={[cameraSettings.packsX, cameraSettings.packsY, 0]}>
	        {items.map((item, index) => {
	          const maxVisibleOffset = isMobile
	            ? MAX_VISIBLE_OFFSET_MOBILE
	            : MAX_VISIBLE_OFFSET_DESKTOP
	          if (Math.abs(index - focusIndex) > maxVisibleOffset + 1) {
	            return null
	          }

	          const isRevealHero = revealMode && item.id === revealingPackId

	          return (
	            <CoverFlowPack
	              key={item.id}
	              item={item}
	              index={index}
	              focusIndex={focusIndex}
	              isActive={item.id === selectedId}
	              hasActiveSelection={hasActiveSelection}
	              modelY={cameraSettings.modelY}
	              layout={layout}
	              textureTransform={textureTransform}
	              centerTiltYaw={centerTiltYaw}
	              centerTiltPitch={centerTiltPitch}
	              isMobile={isMobile}
	              shortHudGlass={shortHudGlass}
	              revealMode={revealMode}
	              isRevealHero={Boolean(isRevealHero)}
	              playOpenSequence={Boolean(isRevealHero && revealPlaySequence)}
	              packsX={cameraSettings.packsX}
	              packsY={cameraSettings.packsY}
	              openTimeline={revealTimeline}
	              openDuckInTimeline={revealDuckInTimeline}
	              onSelect={onSelect}
	              onOpenSequenceComplete={
	                isRevealHero ? onRevealSequenceComplete : undefined
	              }
              onOpenPackBehindFan={
                isRevealHero ? onRevealPackBehindFan : undefined
              }
              onOpenPackBlurChange={
                isRevealHero ? onRevealPackBlurChange : undefined
              }
              formatPrice={formatPrice}
              onBuy={onBuy}
            />
          )
        })}
      </group>
    </>
  )
}

// pmndrs/use-gesture thresholds
const TAP_MAX_MOVE_PX = 12
const SWIPE_DISTANCE_PX = 50
// Velocity units from use-gesture: px/ms.
// >= this speed pages coverflow; below it is scrub/tilt.
// Lowered so normal finger flicks swipe instead of accidentally tilting.
const SWIPE_VELOCITY = 1.15
const SCRUB_VELOCITY = 1.15
const SWIPE_DURATION_MS = 250
const SCRUB_START_DISTANCE_PX = 8
const AXIS_LOCK_RATIO = 1.15
// Upward swipe activates the focused pack (same as tap).
const ACTIVATE_UP_DISTANCE_PX = 48
const ACTIVATE_UP_VELOCITY = 0.45
// Downward swipe while active returns packs to default.
const DEACTIVATE_DOWN_DISTANCE_PX = 48
const DEACTIVATE_DOWN_VELOCITY = 0.45

type LiveGestureMode =
  | 'idle'
  | 'scrub'
  | 'swipe'
  | 'tap'
  | 'activate'
  | 'deactivate'

type MotionTiltStatus = 'off' | 'on' | 'denied' | 'unsupported'

function PhoneIcon() {
  return (
    <svg
      className="coverflow-motion-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="7"
        y="2.5"
        width="10"
        height="19"
        rx="2.2"
        ry="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="17.8" r="1" fill="currentColor" />
      <path
        d="M9.4 5.2h5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CoverFlowCarousel({
  items,
  selectedId: selectedIdProp,
  onSelect: onSelectProp,
  onDeselect: onDeselectProp,
  onFocusChange,
  onBuy,
  formatPrice = formatPackPrice,
  revealingCharacterId = null,
  revealingPackId: revealingPackIdProp = null,
  onPlayNow,
  cameraSettings: cameraSettingsProp,
  layout: layoutProp,
  disableSwipeDownDeactivate = false,
  disableWheelPaging = false,
}: CoverFlowCarouselProps) {
  const catalog = useCatalog()
  const [backendFan, setBackendFan] = useState<BackendFanCatalog | null>(null)

  // Controlled when parent passes selectedId (including null = deselected).
  // Don't use `??` with a defaulted prop — null would fall back to stale internal state
  // and make ↓ / Esc appear to do nothing after a pack was open.
  const isSelectionControlled = selectedIdProp !== undefined
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null,
  )
  const selectedId = isSelectionControlled
    ? selectedIdProp
    : internalSelectedId
  const onSelect =
    onSelectProp ??
    ((id: string) => {
      setInternalSelectedId(id)
    })
  const onDeselect =
    onDeselectProp ??
    (() => {
      setInternalSelectedId(null)
    })
  const stageRef = useRef<HTMLDivElement>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [centerTiltYaw, setCenterTiltYaw] = useState(0)
  const [centerTiltPitch, setCenterTiltPitch] = useState(0)
  const [gestureMode, setGestureMode] = useState<LiveGestureMode>('idle')
  const [, setLastGestureSpeed] = useState(0)
const [isMobileViewportActive, setIsMobileViewportActive] = useState(() =>
	    isMobileViewport(),
	  )
	  // Short browser height: frosted glass behind pack title / pack Nº / CTA.
	  const [isShortHudGlass, setIsShortHudGlass] = useState(() =>
	    typeof window !== 'undefined'
	      ? window.matchMedia('(max-height: 549px)').matches
	      : false,
	  )
	  const [layout, setLayout] = useState<CoverFlowLayoutSettings>(() =>
	    getPreferredCoverFlowLayout(),
	  )
  const textureTransform = DEFAULT_VIDEO_TEXTURE_TRANSFORM
  const [motionTiltStatus, setMotionTiltStatus] = useState<MotionTiltStatus>('off')
  const [revealTimeline] = useState(() => loadPackTimeline())
  const [revealDuckInTimeline] = useState(() => loadDuckInTimeline())
  const [fanLayout] = useState(() => loadFanLayout())
  const [fanDrag] = useState(() => loadFanDrag())
  const revealMode = revealingCharacterId != null
  // Prefer the exact pack id (foil slot 1 or 2); fall back to slot-1 id.
  const revealingPackId =
    revealingPackIdProp ??
    (revealingCharacterId ? `pack-${revealingCharacterId}` : null)
  const revealingPackMeta = revealingPackId
    ? parsePackId(revealingPackId)
    : null
  const revealingPackSlot: PackFaceSlot = revealingPackMeta?.slot ?? 1
  // Model packs use owner ids like `glauca`; role packs keep catalog CharacterIds.
  const revealingModelId =
    revealingPackMeta && !revealingPackMeta.characterId
      ? revealingPackMeta.ownerId
      : null
  const revealShared = catalog.resolveProductSharedMedia(revealingModelId)

  // Foil pack lights follow the centered (or revealing) pack's model colors.
  const focusedPackId =
    revealingPackId || items[focusIndex]?.id || selectedId || items[0]?.id || null
  const focusedOwnerId = focusedPackId ? ownerIdFromPackId(focusedPackId) : null
  catalog.resolveProductSharedMedia(revealingModelId ?? focusedOwnerId)

  // One random motion card per theme for the open fan. Scope to the pack's
  // model when known so every theme belongs to the same girl.
  useEffect(() => {
    let cancelled = false
    void fetchPackFanCatalog(revealingModelId).then((result) => {
      if (!cancelled) setBackendFan(result)
    })
    return () => {
      cancelled = true
    }
  }, [revealingModelId])

  const sequence = useRevealSequence({
    autoStart: revealMode,
    autoStartKey: revealingPackId ?? revealingCharacterId,
    autoStartDelayMs: 80,
  })
  // Always-random shuffler: one motion card per theme, shuffled fan order.
  // runId forces a fresh Math.random draw on every open / Replay open.
  const revealCards = useMemo(
    () =>
      revealMode
        ? createMixedCategoryPackCards({
          characters: catalog.characters,
          backendFan,
          packSlot: revealingPackSlot,
          seed: sequence.runId,
          girlName: revealShared.girlName,
          overlay: {
            name: revealShared.girlName,
            city: revealShared.influencerCity,
            country: revealShared.influencerCountry,
            flagEmoji: revealShared.flagEmoji,
            flagSvgUrl: revealShared.flagSvgUrl,
            gradientColor: revealShared.overlayBackgroundColor,
            gradientColorEnd: revealShared.overlayBackgroundColorEnd,
          },
        })
        : [],
    // Refresh card variants when replaying the open sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      revealMode,
      revealingPackId,
      revealingPackSlot,
      sequence.runId,
      backendFan,
      catalog.characters,
      revealShared,
    ],
  )
const selectedIdRef = useRef(selectedId)
  const onDeselectRef = useRef(onDeselect)
  const onSelectRef = useRef(onSelect)
  const onBuyRef = useRef(onBuy)
  const onPlayNowRef = useRef(onPlayNow)
  const revealCardsRef = useRef(revealCards)
  const revealModeRef = useRef(revealMode)
  const disableSwipeDownDeactivateRef = useRef(disableSwipeDownDeactivate)
  const revealShowPlayRef = useRef(false)
  const revealingCharacterIdRef = useRef(revealingCharacterId)
  const focusIndexRef = useRef(0)
  const itemsRef = useRef(items)
  const gestureModeRef = useRef<LiveGestureMode>('idle')
  // Peak speed during the current gesture (px/ms).
  const peakSpeedRef = useRef(0)
  // Accumulated scrub tilt so max angle holds when user keeps dragging past limit.
  const scrubTiltRef = useRef(0)
  const lastScrubXRef = useRef(0)
  const motionTiltEnabledRef = useRef(false)
  const deviceTiltYawRef = useRef(0)
  const deviceTiltPitchRef = useRef(0)
  const lastAppliedDeviceTiltRef = useRef(0)
  const lastAppliedDevicePitchRef = useRef(0)
  const chevronHoldTimeoutRef = useRef<number | null>(null)
  const chevronHoldIntervalRef = useRef<number | null>(null)
  const chevronHoldDirectionRef = useRef<-1 | 1 | 0>(0)
  const chevronHoverTimeoutRef = useRef<number | null>(null)
  const chevronHoverDirectionRef = useRef<-1 | 1 | 0>(0)
  const chevronPointerDownRef = useRef(false)
  // Once a chevron is clicked, suppress hover-auto-cycle until the pointer leaves and re-enters.
  const chevronHoverSuppressedDirectionRef = useRef<-1 | 1 | 0>(0)

  // Keep keyboard/gesture handlers on the latest selection immediately.
  // selectedId only lands in selectedIdRef after paint via effect, so a fast
  // ↑ then ↓ (especially while the pointer is hovering the pack / CTA) used to
  // see a stale null ref and skip deactivate.
  const selectPack = useCallback(
    (id: string) => {
      selectedIdRef.current = id
      onSelect(id)
    },
    [onSelect],
  )
  const deselectPack = useCallback(() => {
    selectedIdRef.current = null
    onDeselect()
  }, [onDeselect])

  const cameraSettings =
    cameraSettingsProp ??
    (isMobileViewportActive
      ? MOBILE_COVERFLOW_CAMERA
      : DEFAULT_COVERFLOW_CAMERA)
  const resolvedLayout = layoutProp ?? layout

useEffect(() => {
		    if (typeof window === 'undefined') {
		      return
		    }

		    const media = window.matchMedia('(max-width: 980px)')
		    const applyPreferredDefaults = () => {
		      setIsMobileViewportActive(media.matches)
		      setLayout(media.matches ? MOBILE_COVERFLOW_LAYOUT : DEFAULT_COVERFLOW_LAYOUT)
		    }

		    applyPreferredDefaults()
		    media.addEventListener('change', applyPreferredDefaults)
		    return () => media.removeEventListener('change', applyPreferredDefaults)
		  }, [])

		  useEffect(() => {
		    if (typeof window === 'undefined') return
		    const media = window.matchMedia('(max-height: 549px)')
		    const apply = () => setIsShortHudGlass(media.matches)
		    apply()
		    media.addEventListener('change', apply)
		    return () => media.removeEventListener('change', apply)
		  }, [])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    revealModeRef.current = revealMode
  }, [revealMode])

  useEffect(() => {
    disableSwipeDownDeactivateRef.current = disableSwipeDownDeactivate
  }, [disableSwipeDownDeactivate])

  useEffect(() => {
    revealShowPlayRef.current = sequence.showPlay
  }, [sequence.showPlay])

  useEffect(() => {
    revealingCharacterIdRef.current = revealingCharacterId
  }, [revealingCharacterId])

  useEffect(() => {
    if (!revealMode) {
      sequence.reset()
      return
    }
    // Clear interactive tilt so open starts clean.
    setCenterTiltYaw(0)
    setCenterTiltPitch(0)
    scrubTiltRef.current = 0
    setGestureMode('idle')
    gestureModeRef.current = 'idle'
  }, [revealMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDeselectRef.current = deselectPack
  }, [deselectPack])

  useEffect(() => {
    onSelectRef.current = selectPack
  }, [selectPack])

  useEffect(() => {
    onBuyRef.current = onBuy
  }, [onBuy])

  useEffect(() => {
    onPlayNowRef.current = onPlayNow
  }, [onPlayNow])
  useEffect(() => {
    revealCardsRef.current = revealCards
  }, [revealCards])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    focusIndexRef.current = focusIndex
  }, [focusIndex])

  useEffect(() => {
    gestureModeRef.current = gestureMode
  }, [gestureMode])

  useEffect(() => {
    motionTiltEnabledRef.current = motionTiltStatus === 'on'
    if (motionTiltStatus !== 'on') {
      deviceTiltYawRef.current = 0
      deviceTiltPitchRef.current = 0
      lastAppliedDeviceTiltRef.current = 0
      lastAppliedDevicePitchRef.current = 0
      setCenterTiltPitch(0)
    }
  }, [motionTiltStatus])

  useEffect(() => {
    if (items.length === 0) {
      setFocusIndex(0)
      return
    }

    if (selectedId) {
      const selectedIndex = items.findIndex((item) => item.id === selectedId)
      if (selectedIndex >= 0) {
        setFocusIndex(selectedIndex)
        return
      }
    }

    setFocusIndex((current) => clamp(current, 0, items.length - 1))
  }, [items, selectedId])

  // Bubble centered pack changes so the stage glow can follow each model.
  useEffect(() => {
    if (!onFocusChange) return
    if (items.length === 0) {
      onFocusChange(null, 0)
      return
    }
    const index = clamp(focusIndex, 0, items.length - 1)
    onFocusChange(items[index] ?? null, index)
  }, [focusIndex, items, onFocusChange])

  // Phone tilt drives the same center-pack yaw used by scrub/hover.
  // Finger scrub/swipe temporarily wins while a gesture is active.
  useEffect(() => {
    if (motionTiltStatus !== 'on' || typeof window === 'undefined') {
      return
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma
      const beta = event.beta
      if (typeof gamma !== 'number' || Number.isNaN(gamma)) {
        return
      }

      // gamma: left/right phone tilt in degrees.
      // Inverted so phone-left tilts the pack right, and phone-right tilts left.
      const normalizedYaw = MathUtils.clamp(
        gamma / DEVICE_TILT_GAMMA_RANGE,
        -1,
        1,
      )
      const targetYaw = -normalizedYaw * MAX_HOVER_YAW
      // Soft follow so device tilt feels slower and less twitchy.
      const nextYaw = MathUtils.lerp(
        deviceTiltYawRef.current,
        targetYaw,
        DEVICE_TILT_SMOOTHING,
      )
      deviceTiltYawRef.current = nextYaw

      // beta: front/back phone tilt → slight X-axis pitch (not yaw).
      let nextPitch = deviceTiltPitchRef.current
      if (typeof beta === 'number' && !Number.isNaN(beta)) {
        // Center around a natural handheld upright (~55°) so small tips feel intentional.
        const betaOffset = beta - 55
        const normalizedPitch = MathUtils.clamp(
          betaOffset / DEVICE_TILT_BETA_RANGE,
          -1,
          1,
        )
        // Invert so tipping the phone toward you pitches the pack face toward you.
        const targetPitch = -normalizedPitch * MAX_DEVICE_PITCH
        nextPitch = MathUtils.lerp(
          deviceTiltPitchRef.current,
          targetPitch,
          DEVICE_TILT_SMOOTHING,
        )
        deviceTiltPitchRef.current = nextPitch
      }

      // Don't fight active finger scrub/swipe/tap gestures.
      if (gestureModeRef.current !== 'idle') {
        return
      }

      const yawChanged =
        Math.abs(nextYaw - lastAppliedDeviceTiltRef.current) >= 0.0025
      const pitchChanged =
        Math.abs(nextPitch - lastAppliedDevicePitchRef.current) >= 0.002
      if (!yawChanged && !pitchChanged) {
        return
      }

      if (yawChanged) {
        lastAppliedDeviceTiltRef.current = nextYaw
        setCenterTiltYaw(nextYaw)
      }
      if (pitchChanged) {
        lastAppliedDevicePitchRef.current = nextPitch
        setCenterTiltPitch(nextPitch)
      }
    }

    window.addEventListener('deviceorientation', handleOrientation, true)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [motionTiltStatus])

  const enableMotionTilt = useCallback(async () => {
    if (typeof window === 'undefined') {
      setMotionTiltStatus('unsupported')
      return
    }

    const DeviceOrientationEventCtor = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
      })
      | undefined

    if (!DeviceOrientationEventCtor) {
      setMotionTiltStatus('unsupported')
      return
    }

    try {
      // iOS 13+ requires a user gesture + explicit permission.
      if (typeof DeviceOrientationEventCtor.requestPermission === 'function') {
        const permission = await DeviceOrientationEventCtor.requestPermission()
        if (permission !== 'granted') {
          setMotionTiltStatus('denied')
          return
        }
      }

      setMotionTiltStatus('on')
    } catch {
      setMotionTiltStatus('denied')
    }
  }, [])

  const toggleMotionTilt = useCallback(() => {
    if (motionTiltStatus === 'on') {
      setMotionTiltStatus('off')
      setCenterTiltYaw(0)
      setCenterTiltPitch(0)
      return
    }

    void enableMotionTilt()
  }, [enableMotionTilt, motionTiltStatus])

  // Important for Safari smoothness: scrolling only moves focus.
  // Selecting (and reloading the main editor preview) happens on tap/click.
  // Exception: if a pack is already active, swipe keeps the open state and
  // activates the next/previous pack so Buy Pack stays visible.
  const moveFocus = useCallback(
    (delta: number) => {
      if (items.length === 0) {
        return
      }

      const nextIndex = clamp(
        focusIndexRef.current + delta,
        0,
        items.length - 1,
      )
      const nextItem = items[nextIndex]
      const wasActive = selectedIdRef.current !== null

      setCenterTiltYaw(0)
      setFocusIndex(nextIndex)

      if (wasActive && nextItem && nextItem.id !== selectedIdRef.current) {
        selectedIdRef.current = nextItem.id
        onSelectRef.current(nextItem.id)
      }
    },
    [items],
  )

  // Desktop keyboard (window-level so the stage doesn't need DOM focus):
  // - ← / → browse coverflow (keeps Buy Pack open when already selected)
  // - ↑ opens the focused pack
  // - Enter buys when open; after reveal, Enter hits Play now
  // - ↓ / Esc closes the open pack
  useEffect(() => {
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

      const key = event.key
      const revealActive = revealModeRef.current
      const hasSelection = selectedIdRef.current !== null
      const focused = itemsRef.current[focusIndexRef.current]

      // Post-reveal CTA: Enter / Return → Play now
      if (revealActive) {
        if (
          (key === 'Enter' || key === 'Return') &&
          revealShowPlayRef.current &&
          revealingCharacterIdRef.current
        ) {
          event.preventDefault()
          onPlayNowRef.current?.(
            revealingCharacterIdRef.current,
            revealCardsRef.current,
          )
        }
        return
      }

      if (key === 'ArrowRight' || key === 'Right') {
        event.preventDefault()
        moveFocus(1)
        return
      }

      if (key === 'ArrowLeft' || key === 'Left') {
        event.preventDefault()
        moveFocus(-1)
        return
      }

      if (key === 'ArrowUp' || key === 'Up') {
        if (!focused) return
        event.preventDefault()
        // Eager so a same-frame / next-key ↓ sees the open pack.
        selectedIdRef.current = focused.id
        onSelectRef.current(focused.id)
        return
      }

      if (key === 'ArrowDown' || key === 'Down' || key === 'Escape') {
        if (!hasSelection) return
        event.preventDefault()
        // Eager clear so rapid ↑↓ / Esc can't read a stale open id.
        selectedIdRef.current = null
        onDeselectRef.current()
        return
      }

      if (key === 'Enter' || key === 'Return') {
        if (!hasSelection || !focused) return
        event.preventDefault()
        onBuyRef.current?.(focused)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moveFocus])

  const clearChevronHoverTimer = useCallback(() => {
    if (chevronHoverTimeoutRef.current !== null) {
      window.clearTimeout(chevronHoverTimeoutRef.current)
      chevronHoverTimeoutRef.current = null
    }
    chevronHoverDirectionRef.current = 0
  }, [])

  const stopChevronHold = useCallback(() => {
    if (chevronHoldTimeoutRef.current !== null) {
      window.clearTimeout(chevronHoldTimeoutRef.current)
      chevronHoldTimeoutRef.current = null
    }
    if (chevronHoldIntervalRef.current !== null) {
      window.clearInterval(chevronHoldIntervalRef.current)
      chevronHoldIntervalRef.current = null
    }
    chevronHoldDirectionRef.current = 0
    chevronPointerDownRef.current = false
  }, [])

  const startChevronHold = useCallback(
    (direction: -1 | 1, options?: { immediate?: boolean }) => {
      const immediate = options?.immediate ?? true
      clearChevronHoverTimer()
      stopChevronHold()
      chevronHoldDirectionRef.current = direction

      // Immediate step on press, then keep cycling while held/hovered.
      if (immediate) {
        moveFocus(direction)
      }

      chevronHoldTimeoutRef.current = window.setTimeout(() => {
        chevronHoldIntervalRef.current = window.setInterval(() => {
          if (chevronHoldDirectionRef.current === 0) {
            return
          }

          const atStart =
            chevronHoldDirectionRef.current === -1 &&
            focusIndexRef.current <= 0
          const atEnd =
            chevronHoldDirectionRef.current === 1 &&
            focusIndexRef.current >= itemsRef.current.length - 1

          if (atStart || atEnd) {
            stopChevronHold()
            return
          }

          moveFocus(chevronHoldDirectionRef.current)
        }, CHEVRON_HOLD_REPEAT_MS)
      }, immediate ? CHEVRON_HOLD_INITIAL_MS : 0)
    },
    [clearChevronHoverTimer, moveFocus, stopChevronHold],
  )

  const armChevronHoverHold = useCallback(
    (direction: -1 | 1) => {
      // Clicking cancels hover-auto-cycle for this chevron until the pointer re-enters.
      if (chevronHoverSuppressedDirectionRef.current === direction) {
        return
      }

      // Press-and-hold already owns cycling; don't also arm hover dwell.
      if (chevronPointerDownRef.current || chevronHoldDirectionRef.current !== 0) {
        return
      }

      clearChevronHoverTimer()
      chevronHoverDirectionRef.current = direction
      chevronHoverTimeoutRef.current = window.setTimeout(() => {
        if (chevronHoverDirectionRef.current !== direction) {
          return
        }
        if (chevronHoverSuppressedDirectionRef.current === direction) {
          return
        }
        // Hovering for 500ms counts as a hold: start continuous cycling.
        startChevronHold(direction, { immediate: true })
      }, CHEVRON_HOVER_HOLD_MS)
    },
    [clearChevronHoverTimer, startChevronHold],
  )

  const handleChevronPointerEnter = useCallback(
    (direction: -1 | 1) => {
      // Leaving and re-entering resets hover behavior for that chevron.
      if (chevronHoverSuppressedDirectionRef.current === direction) {
        chevronHoverSuppressedDirectionRef.current = 0
      }
      armChevronHoverHold(direction)
    },
    [armChevronHoverHold],
  )

  const handleChevronPointerDown = useCallback(
    (direction: -1 | 1) => {
      // A click cancels hover-auto-cycle for this chevron until re-entry.
      chevronHoverSuppressedDirectionRef.current = direction
      clearChevronHoverTimer()
      chevronPointerDownRef.current = true
      startChevronHold(direction)
    },
    [clearChevronHoverTimer, startChevronHold],
  )

  const releaseChevronInteraction = useCallback(() => {
    clearChevronHoverTimer()
    stopChevronHold()
  }, [clearChevronHoverTimer, stopChevronHold])

  useEffect(() => {
    return () => {
      releaseChevronInteraction()
      chevronHoverSuppressedDirectionRef.current = 0
    }
  }, [releaseChevronInteraction])

  const wheelLockUntilRef = useRef(0)

  // Native non-passive wheel listener so we can fully block page scroll while
  // the pointer is over the coverflow stage and only drive carousel paging.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || disableWheelPaging) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      // Always capture wheel over the stage so the page doesn't also scroll.
      event.preventDefault()
      event.stopPropagation()

      if (revealModeRef.current) {
        return
      }

      if (itemsRef.current.length <= 1) {
        return
      }

      const dominantDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY

      if (Math.abs(dominantDelta) < 12) {
        return
      }

      // Coalesce trackpad wheel spam into discrete steps, then ease in 3D.
      const now = performance.now()
      if (now < wheelLockUntilRef.current) {
        return
      }

      // Slightly longer than the ease so one gesture = one smooth card move.
      wheelLockUntilRef.current = now + 220
      moveFocus(dominantDelta > 0 ? 1 : -1)
    }

    stage.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      stage.removeEventListener('wheel', handleWheel)
    }
  }, [disableWheelPaging, moveFocus])

  // Official pmndrs/use-gesture pattern:
  // - state.swipe for carousel paging
  // - state.movement for slow scrub/tilt
  // - state.tap for select
  // When phone motion tilt is enabled, finger scrub is disabled and swipes only cycle packs.
  const bindStageDrag = useDrag(
    ({
      first,
      last,
      movement: [mx, my],
      velocity: [vx, vy],
      swipe: [swipeX, swipeY],
      cancel,
      canceled,
      tap,
      event,
    }) => {
      if (revealModeRef.current) {
        return
      }

      const absX = Math.abs(mx)
      const absY = Math.abs(my)
      const stageWidth = stageRef.current?.clientWidth || window.innerWidth
      const horizontal = absX >= absY * AXIS_LOCK_RATIO
      const vertical = absY > absX * AXIS_LOCK_RATIO
      const speed = Math.abs(vx)
      const verticalSpeed = Math.abs(vy)
      // Keep a usable gap even if thresholds are set equal.
      const scrubMaxSpeed = Math.min(SCRUB_VELOCITY, SWIPE_VELOCITY)
      const motionTiltEnabled = motionTiltEnabledRef.current

      if (first) {
        // With motion tilt on, keep current phone yaw; otherwise reset for scrub start.
        if (!motionTiltEnabled) {
          setCenterTiltYaw(0)
        }
        scrubTiltRef.current = 0
        lastScrubXRef.current = mx
        peakSpeedRef.current = speed
        setLastGestureSpeed(0)
        setGestureMode('idle')
        gestureModeRef.current = 'idle'
      } else {
        peakSpeedRef.current = Math.max(peakSpeedRef.current, speed)
      }

      const finishGesture = (mode: LiveGestureMode) => {
        setLastGestureSpeed(peakSpeedRef.current)
        scrubTiltRef.current = 0
        lastScrubXRef.current = 0
        // Hand tilt control back to the phone if motion tilt is enabled.
        const restoredYaw = motionTiltEnabledRef.current
          ? deviceTiltYawRef.current
          : 0
        const restoredPitch = motionTiltEnabledRef.current
          ? deviceTiltPitchRef.current
          : 0
        lastAppliedDeviceTiltRef.current = restoredYaw
        lastAppliedDevicePitchRef.current = restoredPitch
        setCenterTiltYaw(restoredYaw)
        setCenterTiltPitch(restoredPitch)
        setGestureMode(mode)
        gestureModeRef.current = mode
        if (mode === 'idle') {
          return
        }
        window.setTimeout(() => {
          if (gestureModeRef.current === mode) {
            setGestureMode('idle')
            gestureModeRef.current = 'idle'
          }
        }, 160)
      }

      const commitSwipe = (direction: number) => {
        moveFocus(direction)
        finishGesture('swipe')
      }

      const commitActivate = (mode: LiveGestureMode = 'activate') => {
        const focused = itemsRef.current[focusIndexRef.current]
        if (focused) {
          selectPack(focused.id)
        }
        finishGesture(mode)
      }

      const commitDeactivate = () => {
        if (selectedIdRef.current) {
          deselectPack()
        }
        // Keep phone tilt if motion is enabled; otherwise clear scrub tilt.
        if (!motionTiltEnabledRef.current) {
          setCenterTiltYaw(0)
        }
        scrubTiltRef.current = 0
        finishGesture('deactivate')
      }

      // Library swipe is only a hint; speed threshold is the source of truth.
      // With motion tilt on, treat any clear library swipe as carousel paging.
      const librarySwipe =
        swipeX !== 0 &&
        (motionTiltEnabled ||
          speed >= SWIPE_VELOCITY ||
          peakSpeedRef.current >= SWIPE_VELOCITY)
      if (librarySwipe && !last) {
        setGestureMode('swipe')
        gestureModeRef.current = 'swipe'
        if (!motionTiltEnabled) {
          setCenterTiltYaw(0)
        }
        scrubTiltRef.current = 0
        return
      }

      // Scrub can upgrade into a coverflow swipe when the finger accelerates.
      // Disabled entirely while phone motion tilt owns the tilt axis.
      if (gestureModeRef.current === 'scrub' && !motionTiltEnabled) {
        const fastEnoughToSwipe =
          horizontal &&
          absX >= SWIPE_DISTANCE_PX * 0.6 &&
          (speed >= SWIPE_VELOCITY || peakSpeedRef.current >= SWIPE_VELOCITY)

        if (!last && !canceled) {
          if (fastEnoughToSwipe) {
            setGestureMode('swipe')
            gestureModeRef.current = 'swipe'
            setCenterTiltYaw(0)
            scrubTiltRef.current = 0
            return
          }

          const deltaX = mx - lastScrubXRef.current
          lastScrubXRef.current = mx
          const tiltDelta = deltaX / (stageWidth * TILT_SENSITIVITY)
          scrubTiltRef.current = MathUtils.clamp(
            scrubTiltRef.current + tiltDelta,
            -1,
            1,
          )
          setCenterTiltYaw(scrubTiltRef.current * MAX_HOVER_YAW)
          return
        }

        // Fast flick out of a scrub still pages the coverflow.
        if (
          !canceled &&
          horizontal &&
          absX >= SWIPE_DISTANCE_PX &&
          (speed >= SWIPE_VELOCITY || peakSpeedRef.current >= SWIPE_VELOCITY)
        ) {
          const direction =
            swipeX !== 0 ? (swipeX < 0 ? 1 : -1) : mx < 0 ? 1 : -1
          commitSwipe(direction)
          event?.preventDefault?.()
          return
        }

        // Slow scrub release: ease upright only.
        finishGesture('idle')
        event?.preventDefault?.()
        return
      }

      // Ignore downward page-scroll when nothing is active.
      // When a pack is active, keep the gesture so swipe-down can deactivate
      // unless the homepage asked to leave that to page scroll.
      if (
        !horizontal &&
        absY > 18 &&
        my > 0 &&
        (!selectedIdRef.current || disableSwipeDownDeactivateRef.current)
      ) {
        if (!motionTiltEnabled) {
          setCenterTiltYaw(0)
        }
        scrubTiltRef.current = 0
        setGestureMode('idle')
        gestureModeRef.current = 'idle'
        cancel()
        return
      }

      if (!last) {
        // Fast movement should never begin tilt.
        // With motion tilt on, horizontal drag is treated as carousel swipe intent.
        if (
          horizontal &&
          absX >= SWIPE_DISTANCE_PX * 0.6 &&
          (motionTiltEnabled || speed >= SWIPE_VELOCITY)
        ) {
          setGestureMode('swipe')
          gestureModeRef.current = 'swipe'
          if (!motionTiltEnabled) {
            setCenterTiltYaw(0)
          }
          scrubTiltRef.current = 0
          return
        }

        // Slow intentional horizontal drag => enter scrub/tilt.
        // Disabled while phone motion tilt is active.
        if (
          !motionTiltEnabled &&
          horizontal &&
          absX >= SCRUB_START_DISTANCE_PX &&
          speed < scrubMaxSpeed &&
          peakSpeedRef.current < SWIPE_VELOCITY
        ) {
          if (gestureModeRef.current !== 'scrub') {
            setGestureMode('scrub')
            gestureModeRef.current = 'scrub'
            lastScrubXRef.current = mx
            scrubTiltRef.current = 0
          }

          const deltaX = mx - lastScrubXRef.current
          lastScrubXRef.current = mx
          const tiltDelta = deltaX / (stageWidth * TILT_SENSITIVITY)
          scrubTiltRef.current = MathUtils.clamp(
            scrubTiltRef.current + tiltDelta,
            -1,
            1,
          )
          setCenterTiltYaw(scrubTiltRef.current * MAX_HOVER_YAW)
        }
        return
      }

      // ===== release path =====
      if (canceled) {
        finishGesture('idle')
        return
      }

      // Tap to activate.
      if (tap || Math.hypot(mx, my) <= TAP_MAX_MOVE_PX) {
        commitActivate('tap')
        return
      }

      // Swipe up to activate (same result as tap).
      // use-gesture: negative Y is up.
      const isUpwardActivate =
        vertical &&
        my < 0 &&
        absY >= ACTIVATE_UP_DISTANCE_PX &&
        (swipeY < 0 ||
          verticalSpeed >= ACTIVATE_UP_VELOCITY ||
          absY >= ACTIVATE_UP_DISTANCE_PX * 1.35)
      if (isUpwardActivate) {
        commitActivate('activate')
        event?.preventDefault?.()
        return
      }

      // Swipe down while active returns the pack to default.
      // use-gesture: positive Y is down.
      const isDownwardDeactivate =
        !!selectedIdRef.current &&
        vertical &&
        my > 0 &&
        absY >= DEACTIVATE_DOWN_DISTANCE_PX &&
        (swipeY > 0 ||
          verticalSpeed >= DEACTIVATE_DOWN_VELOCITY ||
          absY >= DEACTIVATE_DOWN_DISTANCE_PX * 1.35)
      if (isDownwardDeactivate && !disableSwipeDownDeactivateRef.current) {
        commitDeactivate()
        event?.preventDefault?.()
        return
      }

      // Commit swipe if we already locked into swipe mode, or library + speed agree.
      // With motion tilt on, any clear horizontal drag pages the carousel.
      if (
        gestureModeRef.current === 'swipe' ||
        (swipeX !== 0 &&
          (motionTiltEnabled ||
            speed >= SWIPE_VELOCITY ||
            peakSpeedRef.current >= SWIPE_VELOCITY)) ||
        (motionTiltEnabled &&
          horizontal &&
          absX >= SWIPE_DISTANCE_PX * 0.75)
      ) {
        // swipeX: -1 left, 1 right. Our carousel: left swipe => next (+1).
        const direction = swipeX !== 0 ? (swipeX < 0 ? 1 : -1) : mx < 0 ? 1 : -1
        commitSwipe(direction)
        return
      }

      // Fallback: long horizontal drag with enough speed on release.
      // Uses peak speed so a fast flick still counts even if release slows.
      if (
        horizontal &&
        absX >= SWIPE_DISTANCE_PX &&
        (motionTiltEnabled ||
          speed >= SWIPE_VELOCITY ||
          peakSpeedRef.current >= SWIPE_VELOCITY)
      ) {
        commitSwipe(mx < 0 ? 1 : -1)
        return
      }

      // Non-swipe release (including unfinished scrub) eases upright.
      finishGesture('idle')
      event?.preventDefault?.()
    },
    {
      // pmndrs recommended drag config shape
      filterTaps: true,
      threshold: 3,
      // axisThreshold typing differs across @use-gesture versions
      axisThreshold: { touch: 8, mouse: 8, pen: 8 } as any,
      pointer: { touch: true, capture: true },
      eventOptions: { passive: false },
      swipe: {
        distance: [SWIPE_DISTANCE_PX, SWIPE_DISTANCE_PX],
        velocity: [SWIPE_VELOCITY, SWIPE_VELOCITY],
        duration: SWIPE_DURATION_MS,
      },
    },
  ) as any

  const stageDragBindings = (bindStageDrag as any)()
  // Product: solid black stage — no per-pack gradient backgrounds.

  if (items.length === 0) {
    return (
      <div className="coverflow-empty">
        <p>No card packs yet. Add a video to create your first pack.</p>
      </div>
    )
  }

  const canMovePrev = focusIndex > 0
  const canMoveNext = focusIndex < items.length - 1

  return (
    <div
      className={`coverflow-shell${revealMode ? ' is-revealing' : ''}`}
    >
      <div
        ref={stageRef}
        className={`coverflow-stage gesture-${gestureMode}${revealMode ? ' is-revealing' : ''
          }`}
        {...(revealMode ? {} : stageDragBindings)}
        role="listbox"
        aria-label="Card pack cover flow"
        tabIndex={0}
      >
        <div
          className="coverflow-stage-backdrop"
          aria-hidden="true"
        />

        <div
          className={`coverflow-stage__pack${sequence.packBehindFan ? ' is-behind-fan' : ''
            }${sequence.packBlurPx > 0.05 ? ' is-blurred' : ''}`}
          style={
            {
              ['--pack-blur' as string]: `${Math.max(0, sequence.packBlurPx)}px`,
            } as CSSProperties
          }
        >
<Canvas
	            camera={{
	              fov: cameraSettings.fov,
	              position: [
	                cameraSettings.cameraX,
	                cameraSettings.cameraY,
	                cameraSettings.cameraZ,
	              ],
	              near: 0.1,
	              far: 40,
	            }}
	            dpr={[1, 1.5]}
	            // Keep a short always-on loop so pack Html projects on first load
	            // without waiting for hover/pointer invalidation.
	            frameloop="always"
	            gl={{
	              antialias: true,
	              alpha: true,
	              premultipliedAlpha: false,
	            }}
	            onCreated={({ gl, scene }) => {
	              // Keep the WebGL clear fully transparent so the CSS gradient is visible.
	              scene.background = null
	              gl.setClearColor(0x000000, 0)
	            }}
	            style={{
	              width: '100%',
	              height: '100%',
	              background: 'transparent',
	            }}
	          >
            <Suspense fallback={null}>
              <CoverFlowScene
                items={items}
                focusIndex={focusIndex}
                selectedId={selectedId}
                cameraSettings={cameraSettings}
                layout={resolvedLayout}
                textureTransform={textureTransform}
                centerTiltYaw={centerTiltYaw}
                centerTiltPitch={centerTiltPitch}
isMobile={isMobileViewportActive}
	                shortHudGlass={isShortHudGlass}
	                revealMode={revealMode}
	                revealingPackId={revealingPackId}
	                revealPlaySequence={sequence.playSequence}
	                revealTimeline={revealTimeline}
                revealDuckInTimeline={revealDuckInTimeline}
                onSelect={selectPack}
                onRevealSequenceComplete={sequence.handleSequenceComplete}
                onRevealPackBehindFan={sequence.handlePackBehindFan}
                onRevealPackBlurChange={sequence.handlePackBlurChange}
                formatPrice={formatPrice}
                onBuy={onBuy}
              />
            </Suspense>
          </Canvas>
        </div>

        {revealMode && sequence.showFan ? (
          <div className="reveal-stage__fan coverflow-reveal-fan">
            <CardFan
              key={`fan-${revealingCharacterId}-${sequence.runId}`}
              cards={revealCards}
              active={sequence.fanActive}
              layout={fanLayout}
              dragConfig={fanDrag}
              liveEdit={false}
              syncDrop={sequence.packBehindFan}
              onComplete={sequence.handleFanComplete}
            />
          </div>
        ) : null}

        {revealMode && sequence.showPlay && revealingCharacterId ? (
          <div
            className="reveal-stage__cta is-enter coverflow-reveal-cta"
            key={`play-cta-${sequence.runId}`}
          >
            <BuyButton
              label="Play now"
              onClick={() => {
                // Leave the open pose frozen; page transition owns the exit.
                onPlayNow?.(revealingCharacterId, revealCards)
              }}
              visible
            />
            <button
              type="button"
              className="reveal-replay"
              onClick={sequence.handleReplay}
            >
              Replay open
            </button>
          </div>
        ) : null}

        {!isMobileViewportActive && !revealMode ? (
          <div className="coverflow-nav">
            <button
              type="button"
              className="coverflow-nav-chevron is-left glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
              aria-label="Previous pack"
              disabled={!canMovePrev}
              onPointerEnter={(event) => {
                event.stopPropagation()
                handleChevronPointerEnter(-1)
              }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (event.button !== 0) {
                  return
                }
                event.currentTarget.setPointerCapture(event.pointerId)
                handleChevronPointerDown(-1)
              }}
              onPointerUp={(event) => {
                event.stopPropagation()
                releaseChevronInteraction()
              }}
              onPointerCancel={(event) => {
                event.stopPropagation()
                releaseChevronInteraction()
              }}
              onPointerLeave={(event) => {
                event.stopPropagation()
                // Leaving cancels current cycle and allows hover behavior to re-arm on re-entry.
                if (chevronHoverSuppressedDirectionRef.current === -1) {
                  chevronHoverSuppressedDirectionRef.current = 0
                }
                releaseChevronInteraction()
              }}
              onContextMenu={(event) => {
                event.preventDefault()
              }}
            >
              <ChevronLeft className="coverflow-chevron-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="coverflow-nav-chevron is-right glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
              aria-label="Next pack"
              disabled={!canMoveNext}
              onPointerEnter={(event) => {
                event.stopPropagation()
                handleChevronPointerEnter(1)
              }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (event.button !== 0) {
                  return
                }
                event.currentTarget.setPointerCapture(event.pointerId)
                handleChevronPointerDown(1)
              }}
              onPointerUp={(event) => {
                event.stopPropagation()
                releaseChevronInteraction()
              }}
              onPointerCancel={(event) => {
                event.stopPropagation()
                releaseChevronInteraction()
              }}
              onPointerLeave={(event) => {
                event.stopPropagation()
                // Leaving cancels current cycle and allows hover behavior to re-arm on re-entry.
                if (chevronHoverSuppressedDirectionRef.current === 1) {
                  chevronHoverSuppressedDirectionRef.current = 0
                }
                releaseChevronInteraction()
              }}
              onContextMenu={(event) => {
                event.preventDefault()
              }}
            >
              <ChevronRight className="coverflow-chevron-icon" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div className={`coverflow-tools-bar${revealMode ? ' is-hidden' : ''}`}>
        <button
          type="button"
          className={`reset-button coverflow-motion-toggle ${motionTiltStatus === 'on' ? 'is-active' : ''
            } ${motionTiltStatus === 'denied' || motionTiltStatus === 'unsupported'
              ? 'is-disabled-look'
              : ''
            }`}
          onClick={toggleMotionTilt}
          aria-pressed={motionTiltStatus === 'on'}
          aria-label={
            motionTiltStatus === 'denied'
              ? 'Motion permission denied'
              : motionTiltStatus === 'unsupported'
                ? 'Motion not supported'
                : motionTiltStatus === 'on'
                  ? 'Disable phone tilt'
                  : 'Enable phone tilt'
          }
          title={
            motionTiltStatus === 'denied'
              ? 'Motion permission denied'
              : motionTiltStatus === 'unsupported'
                ? 'Motion not supported'
                : motionTiltStatus === 'on'
                  ? 'Disable phone tilt'
                  : 'Enable phone tilt'
          }
        >
          <PhoneIcon />
        </button>
      </div>

    </div>
  )
}

useGLTF.preload(PACK_MODEL_URL)
