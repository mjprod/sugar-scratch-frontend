import { Html, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useDrag } from '@use-gesture/react'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
	  Suspense,
	  useCallback,
	  useEffect,
	  useLayoutEffect,
	  useMemo,
	  useRef,
	  useState,
	  type CSSProperties,
	  type ReactNode,
	} from 'react'
import type { Group, Object3D, PerspectiveCamera } from 'three'
import {
  Box3,
  CylinderGeometry,
  Euler,
  Group as ThreeGroup,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import {
		  applyPackFaceMaterial,
		  cloneSceneWithMaterials,
		  DEFAULT_VIDEO_TEXTURE_TRANSFORM,
			  PACK_VIDEO_FIT_MODE,
			  pauseAllVideoTextures,
			  resolvePackTextureSize,
			  resolveTargetMaterial,
			  uniquifyMeshMaterial,
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
import { useMotion } from '@/features/collection/hooks/useMotion'
import { BuyButton } from '@/features/reveal/components/BuyButton'
import {
  CtaButton,
  ctaButtonPropsFromTemplate,
} from '@/shared/ui/cta'
import { DiamondLottie } from '@/components/ui/DiamondLottie'
import { notifyCartRemoveIntent } from '@/services/cart'
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
import {
  DEFAULT_CARD_TOP_DEBUG,
  getCardTopDebug,
  reportCardTopBounds,
  subscribeCardTopDebug,
  type CardTopDebugState,
} from './cardTopDebug'
import {
  loadCardTopTearTimeline,
  sampleCardTopTear,
} from './cardTopTearTimeline'

/** Isolated v2 pack mesh — original coverflow still uses /assets/card2.glb. */
const PACK_MODEL_URL_V2 = '/assets/CardPack2-min.glb'

// Keep the cover-flow light by mounting only nearby packs.
// Mobile: 3 packs (center ± 1). Desktop: 10 packs (center ± 5).
const MAX_VISIBLE_OFFSET_MOBILE = 1
const MAX_VISIBLE_OFFSET_DESKTOP = 5
/** Brief always-on boot so drei Html projects before switching to demand. */
const FRAMELOOP_BOOT_MS = 450
const FRAME_SETTLE_EPS = 0.00012
type CoverFlowFrameLoop = 'always' | 'demand' | 'never'
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

// --- Cart remove exit: slight rise (anticipation), then drop out ---
const REMOVE_ANTICIPATION_MS = 95
const REMOVE_DROP_MS = 280
const REMOVE_ANTICIPATION_Y = 0.07
const REMOVE_ANTICIPATION_SCALE = 1.035
const REMOVE_DROP_Y = -1.85
const REMOVE_DROP_SCALE = 0.78
const REMOVE_DROP_ROT_X_DEG = 16

type OpenAnimPhase = 'idle' | 'anticipation' | 'spin' | 'duck'
type RemoveExitPhase = 'idle' | 'anticipation' | 'drop'

type RemoveExitState = {
  phase: RemoveExitPhase
  startMs: number
  fromX: number
  fromY: number
  fromZ: number
  fromScale: number
  fromRotY: number
  fromOpacity: number
}

function emptyRemoveExit(): RemoveExitState {
  return {
    phase: 'idle',
    startMs: 0,
    fromX: 0,
    fromY: 0,
    fromZ: 0,
    fromScale: 1,
    fromRotY: 0,
    fromOpacity: 1,
  }
}

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

/**
 * Unit cubic-bezier (x1,y1,x2,y2) like CSS / Apple UIKit curves.
 * Solves x(t) → y for monotonic x in [0,1].
 */
function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
) {
  const x = clamp01(t)
  if (x <= 0) return 0
  if (x >= 1) return 1

  let guess = x
  for (let i = 0; i < 6; i += 1) {
    const u = 1 - guess
    const cx =
      3 * u * u * guess * x1 + 3 * u * guess * guess * x2 + guess * guess * guess
    const dx =
      3 * u * u * x1 +
      6 * u * guess * (x2 - x1) +
      3 * guess * guess * (1 - x2)
    if (Math.abs(dx) < 1e-6) break
    guess = MathUtils.clamp(guess - (cx - x) / dx, 0, 1)
  }

  const v = 1 - guess
  return (
    3 * v * v * guess * y1 +
    3 * v * guess * guess * y2 +
    guess * guess * guess
  )
}

/** Apple-like springy ease-out — quick response, soft settle (≈ 0.16, 1, 0.3, 1). */
function easeAppleOut(t: number) {
  return cubicBezierEase(0.16, 1, 0.3, 1, t)
}

/** Apple-like dismiss drop — light hold, then decisive acceleration (custom). */
function easeAppleDrop(t: number) {
  return cubicBezierEase(0.48, 0.04, 0.72, 0.12, t)
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

// Locked from coverflow center debug (desktop + tear / pack pocket).
export const DEFAULT_COVERFLOW_CAMERA: CoverFlowCameraSettings = {
  cameraX: 0.11,
  cameraY: 0.27,
  cameraZ: 6.7,
  fov: 36,
  lookAtY: 0.1,
  packsX: 0.115,
  packsY: -0.94,
  modelY: -0.02,
}

	export const MOBILE_COVERFLOW_CAMERA: CoverFlowCameraSettings = {
	  cameraX: 0.11,
	  cameraY: 0.27,
	  cameraZ: 6.45,
	  fov: 36,
	  lookAtY: 0,
	  packsX: 0.115,
	  packsY: -0.58,
	  modelY: -0.08,
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

/** Packs hex CTA size — compact height so secondary text controls fit under it. */
const BUY_PACK_CTA_SIZE_DESKTOP = { width: 187, height: 48, fontSize: 12, strokeWidth: 2 }
const BUY_PACK_CTA_SIZE_MOBILE = { width: 176, height: 42, fontSize: 13, strokeWidth: 2 }

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
  /** Cart: remove this pack. Replaces the Buy Pack CTA when set. */
  onRemove?: (item: Iteration) => void
  /** Hide Buy Pack / remove CTA under the active pack (tear page). */
  hideActiveCta?: boolean
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
  /** Browse surfaces (cart): ignore global packOpenRequested / auto-open. */
  disablePackOpenReveal?: boolean
  /** Homepage: ignore wheel so it neither pages packs nor traps page scroll. */
  disableWheelPaging?: boolean
  /** Optional HUD pinned to the cardTop rotation point. */
  tearHud?: ReactNode
  /**
   * When false, tear progress does not enter coverflow revealMode.
   * Purchase Ready leaves this on so the 3D open spin plays in-canvas.
   */
  tearDrivesReveal?: boolean
  /** Live model id for backend fan cards / overlay colors. */
  revealModelId?: string | null
  revealGirlName?: string | null
  revealOverlay?: {
    city?: string | null
    country?: string | null
    flagEmoji?: string | null
    flagSvgUrl?: string | null
    gradientColor?: string | null
    gradientColorEnd?: string | null
  } | null
  onRevealCards?: (cards: RevealCard[]) => void
  onRevealContinue?: (cards: RevealCard[]) => void
  onRevealSaveLater?: () => void
  onRevealSaveAndOpenNext?: () => void
  revealContinueLabel?: string
  revealSaveLaterLabel?: string
  revealSaveAndOpenNextLabel?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function findNamedObject(root: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null
  root.traverse((object) => {
    if (!found && object.name === name) found = object
  })
  return found
}

type CardTopRestTransform = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

function measureCardTopLocalBounds(cardTop: Object3D) {
  cardTop.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(cardTop)
  if (box.isEmpty()) return null
  const inverse = cardTop.matrixWorld.clone().invert()
  const min = box.min.clone().applyMatrix4(inverse)
  const max = box.max.clone().applyMatrix4(inverse)
  return {
    min: { x: min.x, y: min.y, z: min.z },
    max: { x: max.x, y: max.y, z: max.z },
    center: {
      x: (min.x + max.x) * 0.5,
      y: (min.y + max.y) * 0.5,
      z: (min.z + max.z) * 0.5,
    },
    size: {
      x: Math.max(0.0001, max.x - min.x),
      y: Math.max(0.0001, max.y - min.y),
      z: Math.max(0.0001, max.z - min.z),
    },
  }
}

function createCardTopPivotGizmo(size: number) {
  const group = new ThreeGroup()
  group.name = 'cardTopPivotGizmo'
  const axis = Math.max(0.12, size * 0.22)
  const radius = axis * 0.045
  const axes: Array<{ color: string; rotation: [number, number, number] }> = [
    { color: '#ff4d6d', rotation: [0, 0, Math.PI / 2] },
    { color: '#3dff9a', rotation: [0, 0, 0] },
    { color: '#4da3ff', rotation: [Math.PI / 2, 0, 0] },
  ]
  for (const axisDef of axes) {
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, axis, 8),
      new MeshBasicMaterial({
        color: axisDef.color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.95,
      }),
    )
    mesh.rotation.set(...axisDef.rotation)
    mesh.renderOrder = 999
    mesh.raycast = () => {}
    group.add(mesh)
  }
  const nub = new Mesh(
    new SphereGeometry(radius * 2.4, 16, 16),
    new MeshBasicMaterial({
      color: '#ffe14d',
      depthTest: false,
      depthWrite: false,
    }),
  )
  nub.renderOrder = 1000
  nub.raycast = () => {}
  group.add(nub)
  group.raycast = () => {}
  return group
}

function isUnderObject(object: Object3D, ancestor: Object3D | null) {
  if (!ancestor) return false
  let current: Object3D | null = object
  while (current) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}

function applyCardTopOpacity(cardTop: Object3D, opacity: number) {
  const next = Math.min(1, Math.max(0, opacity))
  cardTop.traverse((object) => {
    const mesh = object as { isMesh?: boolean; material?: any }
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!material || !('opacity' in material)) continue
      material.transparent = true
      material.opacity = next
      material.depthWrite = next > 0.95
      material.visible = next > 0.001
      material.needsUpdate = true
    }
  })
  cardTop.visible = next > 0.001
}

function resolveCardTopDebugPose(debug: CardTopDebugState): CardTopDebugState {
  const tearing = debug.tearPlaying || debug.tearT > 0.001
  // Shared debug state keeps a leftover torn pose after rewind (position /
  // opacity persist independently of tearT). Active packs used to apply that
  // pose immediately, so the lid dropped as soon as a pack became selected.
  if (!tearing) {
    return debug.showGizmo ? debug : closedCardTopDebugPose(debug)
  }
  const pose = sampleCardTopTear(loadCardTopTearTimeline(), debug.tearT)
  return {
    ...debug,
    position: { x: pose.x, y: pose.y, z: pose.z },
    rotation: { x: pose.rotX, y: pose.rotY, z: pose.rotZ },
    scale: { x: pose.scaleX, y: pose.scaleY, z: pose.scaleZ },
    opacity: pose.opacity,
  }
}

/** Closed seal pose for non-active packs — ignore shared tear scrub state. */
function closedCardTopDebugPose(debug: CardTopDebugState): CardTopDebugState {
  return {
    ...debug,
    position: { ...DEFAULT_CARD_TOP_DEBUG.position },
    rotation: { ...DEFAULT_CARD_TOP_DEBUG.rotation },
    scale: { ...DEFAULT_CARD_TOP_DEBUG.scale },
    opacity: DEFAULT_CARD_TOP_DEBUG.opacity,
    tearT: 0,
    tearPlaying: false,
    packOpenRequested: false,
    showGizmo: false,
  }
}

function applyCardTopPivotDebug(
  cardTop: Object3D,
  rest: CardTopRestTransform,
  debug: CardTopDebugState,
  gizmoSize: number,
) {
  const parent =
    cardTop.parent?.name === 'cardTopPivot' ? cardTop.parent.parent : cardTop.parent
  if (!parent) return

  let pivot =
    cardTop.parent?.name === 'cardTopPivot'
      ? cardTop.parent
      : parent.getObjectByName('cardTopPivot')
  if (!pivot) {
    pivot = new ThreeGroup()
    pivot.name = 'cardTopPivot'
    parent.add(pivot)
    pivot.add(cardTop)
  } else if (cardTop.parent !== pivot) {
    pivot.add(cardTop)
  }

  const restQuat = new Quaternion().setFromEuler(
    new Euler(rest.rotation.x, rest.rotation.y, rest.rotation.z),
  )
  const scaledPivot = new Vector3(
    debug.pivot.x * rest.scale.x,
    debug.pivot.y * rest.scale.y,
    debug.pivot.z * rest.scale.z,
  ).applyQuaternion(restQuat)

  pivot.position.set(
    rest.position.x + scaledPivot.x + debug.position.x,
    rest.position.y + scaledPivot.y + debug.position.y,
    rest.position.z + scaledPivot.z + debug.position.z,
  )
  pivot.rotation.set(
    rest.rotation.x + MathUtils.degToRad(debug.rotation.x),
    rest.rotation.y + MathUtils.degToRad(debug.rotation.y),
    rest.rotation.z + MathUtils.degToRad(debug.rotation.z),
  )
  pivot.scale.set(
    rest.scale.x * debug.scale.x,
    rest.scale.y * debug.scale.y,
    rest.scale.z * debug.scale.z,
  )

  cardTop.position.set(-debug.pivot.x, -debug.pivot.y, -debug.pivot.z)
  cardTop.rotation.set(0, 0, 0)
  cardTop.scale.set(1, 1, 1)
  applyCardTopOpacity(cardTop, debug.opacity)

  let gizmo = pivot.getObjectByName('cardTopPivotGizmo')
  if (!gizmo) {
    gizmo = createCardTopPivotGizmo(gizmoSize)
    pivot.add(gizmo)
  }
  gizmo.visible = debug.showGizmo
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

function TearLottieHud({
  modelY,
  children,
}: {
  modelY: number
  children: ReactNode
}) {
  const [debug, setDebug] = useState(getCardTopDebug)
  useEffect(() => subscribeCardTopDebug(setDebug), [])
  return (
    <Html
      position={[
        debug.pivot.x + debug.lottieOffset.x,
        modelY + debug.pivot.y + debug.lottieOffset.y,
        debug.pivot.z + debug.lottieOffset.z,
      ]}
      center
      transform={false}
      sprite={false}
      zIndexRange={[40, 0]}
      style={{ pointerEvents: 'none' }}
      wrapperClass="coverflow-pack-html coverflow-pack-html--tear"
    >
      <div style={{ pointerEvents: 'auto' }}>{children}</div>
    </Html>
  )
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
		  stageActive,
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
					  onRemove,
					  hideActiveCta = false,
					  tearHud,
					  lockCardTopClosed = false,
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
						  stageActive: boolean
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
					  onRemove?: (item: Iteration) => void
					  hideActiveCta?: boolean
					  tearHud?: ReactNode
					  /** Browse-only surfaces: never apply shared tear pose to the lid. */
					  lockCardTopClosed?: boolean
					}) {
	const groupRef = useRef<Group>(null)
			  const modelRef = useRef<Group>(null)
			  const invalidate = useThree((state) => state.invalidate)
			  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
		  const [removeConfirmLeaving, setRemoveConfirmLeaving] = useState(false)
		  const [isRemoving, setIsRemoving] = useState(false)
		  const removeExitRef = useRef<RemoveExitState>(emptyRemoveExit())
		  const onRemoveRef = useRef(onRemove)

		  function closeRemoveConfirm() {
		    setRemoveConfirmOpen(false)
		    setRemoveConfirmLeaving(
		      typeof window === 'undefined' ||
		        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
		    )
		  }
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
  const stageActiveRef = useRef(stageActive)
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
	    onRemoveRef.current = onRemove
	  }, [onRemove])

		  useEffect(() => {
		    if (!isActive && index !== focusIndex) {
		      setRemoveConfirmOpen(false)
		      setRemoveConfirmLeaving(false)
		    }
		  }, [focusIndex, index, isActive])

		  useEffect(() => {
		    if (!removeConfirmOpen) return
		    const onKeyDown = (event: KeyboardEvent) => {
		      if (event.key === 'Escape') {
		        event.preventDefault()
		        closeRemoveConfirm()
		      }
		    }
		    window.addEventListener('keydown', onKeyDown)
		    return () => window.removeEventListener('keydown', onKeyDown)
		  }, [removeConfirmOpen])

		  useEffect(() => {
		    if (!removeConfirmLeaving) return
		    const timeout = window.setTimeout(() => setRemoveConfirmLeaving(false), 400)
		    return () => window.clearTimeout(timeout)
		  }, [removeConfirmLeaving])

			  function beginRemoveExit() {
			    if (isRemoving || removeExitRef.current.phase !== 'idle') return
			    closeRemoveConfirm()
			    setIsRemoving(true)
		    notifyCartRemoveIntent()
	    const motion = motionRef.current
	    removeExitRef.current = {
	      phase: 'anticipation',
	      startMs: performance.now(),
	      fromX: motion.x,
	      fromY: motion.y,
	      fromZ: motion.z,
	      fromScale: motion.scale,
	      fromRotY: motion.rotY,
	      fromOpacity: opacityRef.current,
	    }
	    motion.vx = 0
	    motion.vy = 0
	    motion.vz = 0
	    motion.vRotY = 0
	    motion.vScale = 0
    hoverYawTargetRef.current = 0
    hoverYawRef.current = 0
    invalidate()
  }

	  const removeControl =
	    onRemove && !isRemoving ? (
	      <div className="coverflow-cart-remove-wrap">
	        <button
	          type="button"
	          className="coverflow-cart-remove"
	          aria-label={`Remove ${item.packName || item.girlName} from cart`}
	          aria-expanded={removeConfirmOpen || removeConfirmLeaving}
	          aria-controls={`coverflow-cart-remove-confirm-${item.id}`}
	          onClick={(event) => {
	            event.stopPropagation()
	            if (removeConfirmOpen) closeRemoveConfirm()
	            else {
	              setRemoveConfirmLeaving(false)
	              setRemoveConfirmOpen(true)
	            }
	          }}
	        >
	          <span aria-hidden="true">×</span>
	        </button>
	        {removeConfirmOpen || removeConfirmLeaving ? (
	          <div
	            id={`coverflow-cart-remove-confirm-${item.id}`}
	            className={`coverflow-cart-remove-confirm${
	              removeConfirmLeaving ? ' is-leaving' : ''
	            }`}
	            role="dialog"
	            aria-label="Remove pack?"
	            aria-modal="false"
	            onAnimationEnd={(event) => {
	              if (event.target !== event.currentTarget) return
	              if (event.animationName !== 'coverflow-confirm-leave') return
	              setRemoveConfirmLeaving(false)
	            }}
	          >
	            <p className="coverflow-cart-remove-confirm__label">Remove</p>
	            <div className="coverflow-cart-remove-confirm__actions">
	              <button
	                type="button"
	                className="coverflow-cart-remove-confirm__btn is-cancel"
	                aria-label="Cancel remove"
	                onClick={(event) => {
	                  event.stopPropagation()
	                  closeRemoveConfirm()
	                }}
	              >
	                <X aria-hidden="true" strokeWidth={2.5} />
	              </button>
	              <button
	                type="button"
	                className="coverflow-cart-remove-confirm__btn is-confirm"
	                aria-label="Confirm remove"
	                onClick={(event) => {
	                  event.stopPropagation()
	                  beginRemoveExit()
	                }}
	              >
	                <Check aria-hidden="true" strokeWidth={2.5} />
	              </button>
	            </div>
	          </div>
	        ) : null}
	      </div>
	    ) : null

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
    stageActiveRef.current = stageActive
  }, [stageActive])

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
          if (isUnderObject(object, cardTop)) return
          const mesh = object as Mesh
          if (!mesh.isMesh) return
          const slots = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          for (const slot of slots) {
            if (!slot || !('opacity' in slot)) continue
            const material = uniquifyMeshMaterial(mesh, slot)
            material.transparent = false
            material.opacity = 1
            material.depthWrite = true
            material.needsUpdate = true
          }
        })
      }
      // Lids fade with the body on side packs — restore them the same way.
      if (cardTop) applyCardTopOpacity(cardTop, 1)
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
      invalidate()
      return
    }
    if (!playOpenSequence) {
      wasPlayingOpenRef.current = false
    }
  }, [invalidate, isRevealHero, playOpenSequence, item.modelRotation.x, item.modelRotation.y, item.modelRotation.z])

  const offset = index - focusIndex
  const isCenter = offset === 0
  const modelUrl = item.modelUrl || PACK_MODEL_URL_V2
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
		  // Mobile close control sits above the pack instead of under the labels.
		  const removeHudPosition = useMemo(
		    () =>
		      [
		        hudLocalBottom.x,
		        hudLocalBottom.y + 2.42,
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
  const facePlaying =
    stageActive &&
    ((isCenter && (!hasActiveSelection || isActive)) ||
      (isRevealHero && revealMode))
  const { texture } = useVideoTexture(
    item.videoUrl,
    item.fitMode || PACK_VIDEO_FIT_MODE,
    textureTransform,
    {
      flipY: true,
      playing: facePlaying,
      textureSize: resolvePackTextureSize(isMobile, offset),
      enabled: Boolean(item.videoUrl),
      soft: false,
    },
  )

const { scene, cardTop, cardTopRest, cardTopBounds } = useMemo(() => {
    const cloned = cloneSceneWithMaterials(gltf.scene)
    const nextCardTop = findNamedObject(cloned, 'cardTop')
    return {
      scene: cloned,
      cardTop: nextCardTop,
      cardTopRest: nextCardTop
        ? {
            position: {
              x: nextCardTop.position.x,
              y: nextCardTop.position.y,
              z: nextCardTop.position.z,
            },
            rotation: {
              x: nextCardTop.rotation.x,
              y: nextCardTop.rotation.y,
              z: nextCardTop.rotation.z,
            },
            scale: {
              x: nextCardTop.scale.x,
              y: nextCardTop.scale.y,
              z: nextCardTop.scale.z,
            },
          }
        : null,
      cardTopBounds: nextCardTop ? measureCardTopLocalBounds(nextCardTop) : null,
    }
  }, [gltf.scene])
			  const targetMaterial = useMemo(() => {
    const packBody = findNamedObject(scene, 'cardPack')
    return resolveTargetMaterial(packBody ?? scene)
  }, [scene])

useLayoutEffect(() => {
	    if (!cardTop || !cardTopRest) return
	    if (cardTopBounds && isCenter) reportCardTopBounds(cardTopBounds)
	    const gizmoSize = cardTopBounds
	      ? Math.max(cardTopBounds.size.x, cardTopBounds.size.y, cardTopBounds.size.z)
	      : 0.4
	    // Drag-to-tear is shared state; only the active/front pack should open.
	    // Non-hero packs also multiply lid opacity by the side-pack fade so tear
	    // ticks can't keep lids fully visible while the body disappears.
		    const poseForPack = (debug: CardTopDebugState) => {
		      if (isActive && !lockCardTopClosed) return resolveCardTopDebugPose(debug)
		      const closed = closedCardTopDebugPose(debug)
	      if (!revealModeRef.current) return closed
	      return {
	        ...closed,
	        opacity: closed.opacity * sideFadeRef.current,
	      }
	    }
	    applyCardTopPivotDebug(
	      cardTop,
	      cardTopRest,
	      poseForPack(getCardTopDebug()),
	      gizmoSize,
	    )
	    return subscribeCardTopDebug((debug) => {
	      applyCardTopPivotDebug(
	        cardTop,
	        cardTopRest,
	        poseForPack(debug),
	        gizmoSize,
	      )
	    })
		  }, [cardTop, cardTopBounds, cardTopRest, isActive, isCenter, lockCardTopClosed])

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
    const seedOffset = Math.abs(index - focusIndex)
    const seedVisible = isMobile
      ? MAX_VISIBLE_OFFSET_MOBILE
      : MAX_VISIBLE_OFFSET_DESKTOP
    sideFadeRef.current =
      seedOffset <= seedVisible && !(revealMode && !isRevealHero) ? 1 : 0
    groupRef.current.visible = sideFadeRef.current > 0.02
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
    const fade = opacity < 0.999
    groupRef.current.traverse((object) => {
      // Hero lid is driven by the tear pose; side packs fade lid + body together.
      if (cardTop && isUnderObject(object, cardTop)) return
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const slots = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      for (const slot of slots) {
        if (!slot || !('opacity' in slot)) continue
        const material = fade ? uniquifyMeshMaterial(mesh, slot) : slot
        material.transparent = fade
        material.opacity = opacity
        material.depthWrite = opacity > 0.95
        material.needsUpdate = true
      }
    })
    // Keep top-edge / lids in lockstep with the pack body on non-hero packs.
    // (Hero cardTop opacity stays on the tear timeline.)
    if (cardTop && !isRevealHeroRef.current) {
      applyCardTopOpacity(cardTop, opacity)
    }
  }

useFrame((state, delta) => {
		    if (!groupRef.current) {
		      return
		    }

		    const requestFrame = () => {
		      state.invalidate()
		    }

		    const liveOffset = index - focusIndexRef.current
		    const isLiveCenter = liveOffset === 0
		    const dt = Math.min(delta, 1 / 30)

	    // ---- Cart remove exit: rise (anticipation), then drop out ----
	    if (removeExitRef.current.phase !== 'idle') {
	      const exit = removeExitRef.current
	      const motion = motionRef.current
	      const modelRot = modelRotRef.current

	      motion.vx = 0
	      motion.vy = 0
	      motion.vz = 0
	      motion.vRotY = 0
	      motion.vScale = 0
	      hoverYawTargetRef.current = 0
	      hoverYawRef.current = 0

	      if (exit.phase === 'anticipation') {
	        const t = clamp01(
	          (performance.now() - exit.startMs) / REMOVE_ANTICIPATION_MS,
	        )
	        const wind = easeAppleOut(t)
	        motion.x = exit.fromX
	        motion.y = lerp(exit.fromY, exit.fromY + REMOVE_ANTICIPATION_Y, wind)
	        motion.z = exit.fromZ
	        motion.scale = lerp(
	          exit.fromScale,
	          exit.fromScale * REMOVE_ANTICIPATION_SCALE,
	          wind,
	        )
	        motion.rotY = exit.fromRotY
	        modelRot.x = item.modelRotation.x
	        modelRot.y = item.modelRotation.y
	        modelRot.z = item.modelRotation.z
	        applyOpacity(exit.fromOpacity)

	        groupRef.current.position.set(motion.x, motion.y, motion.z)
	        groupRef.current.rotation.set(0, motion.rotY, 0)
	        groupRef.current.scale.setScalar(motion.scale)
	        if (modelRef.current) {
	          modelRef.current.rotation.set(
	            MathUtils.degToRad(modelRot.x),
	            MathUtils.degToRad(modelRot.y),
	            MathUtils.degToRad(modelRot.z),
	          )
	        }
		        groupRef.current.visible = true

		        if (t < 1) {
		          requestFrame()
		          return
		        }

		        exit.phase = 'drop'
	        exit.startMs = performance.now()
	        exit.fromX = motion.x
	        exit.fromY = motion.y
	        exit.fromZ = motion.z
	        exit.fromScale = motion.scale
	        exit.fromRotY = motion.rotY
	        exit.fromOpacity = opacityRef.current
	        // Fall through into drop this frame.
	      }

	      if (exit.phase === 'drop') {
	        const t = clamp01((performance.now() - exit.startMs) / REMOVE_DROP_MS)
	        const fall = easeAppleDrop(t)
	        // Opacity lags a touch so the pack stays readable while it starts falling.
	        const fade = cubicBezierEase(0.55, 0.02, 0.78, 0.28, t)
	        motion.x = exit.fromX
	        motion.y = lerp(exit.fromY, exit.fromY + REMOVE_DROP_Y, fall)
	        motion.z = exit.fromZ
	        motion.scale = lerp(exit.fromScale, exit.fromScale * REMOVE_DROP_SCALE, fall)
	        motion.rotY = exit.fromRotY
	        modelRot.x = item.modelRotation.x + REMOVE_DROP_ROT_X_DEG * fall
	        modelRot.y = item.modelRotation.y
	        modelRot.z = item.modelRotation.z
	        applyOpacity(lerp(exit.fromOpacity, 0, fade))

	        groupRef.current.position.set(motion.x, motion.y, motion.z)
	        groupRef.current.rotation.set(0, motion.rotY, 0)
	        groupRef.current.scale.setScalar(motion.scale)
	        if (modelRef.current) {
	          modelRef.current.rotation.set(
	            MathUtils.degToRad(modelRot.x),
	            MathUtils.degToRad(modelRot.y),
	            MathUtils.degToRad(modelRot.z),
	          )
	        }
		        groupRef.current.visible = opacityRef.current > 0.02

		        if (t < 1) {
		          requestFrame()
		          return
		        }

		        exit.phase = 'idle'
	        groupRef.current.visible = false
	        onRemoveRef.current?.(item)
	        return
	      }
	    }

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

        if (t < 1) {
          requestFrame()
          return
        }

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

        if (t < handoffT) {
          requestFrame()
          return
        }

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

        if (t < 1) {
          requestFrame()
          return
        }

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
        requestFrame()
        return
      }

      requestFrame()
      return
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
      const seedVisible = isMobileRef.current
        ? MAX_VISIBLE_OFFSET_MOBILE
        : MAX_VISIBLE_OFFSET_DESKTOP
      sideFadeRef.current =
        Math.abs(liveOffset) <= seedVisible &&
        !(revealModeRef.current && !isRevealHeroRef.current)
          ? 1
          : 0
      applyOpacity(sideFadeRef.current)
      groupRef.current.visible =
        isRevealHeroRef.current || sideFadeRef.current > 0.02
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

    // Reveal ducks side packs; browse fades packs at the visible edge instead of popping.
    const maxVisibleOffset = isMobileRef.current
      ? MAX_VISIBLE_OFFSET_MOBILE
      : MAX_VISIBLE_OFFSET_DESKTOP
    const inRange = Math.abs(liveOffset) <= maxVisibleOffset
    const fadeTarget =
      revealModeRef.current && !isRevealHeroRef.current ? 0 : inRange ? 1 : 0
    sideFadeRef.current = MathUtils.lerp(
      sideFadeRef.current,
      fadeTarget,
      1 - Math.exp(-8 * delta),
    )
    const opacity = sideFadeRef.current
    applyOpacity(opacity)
    groupRef.current.visible = isRevealHeroRef.current || opacity > 0.02

    const springBusy =
      Math.abs(motion.vx) > FRAME_SETTLE_EPS ||
      Math.abs(motion.vy) > FRAME_SETTLE_EPS ||
      Math.abs(motion.vz) > FRAME_SETTLE_EPS ||
      Math.abs(motion.vRotY) > FRAME_SETTLE_EPS ||
      Math.abs(motion.vScale) > FRAME_SETTLE_EPS ||
      Math.abs(hoverYawRef.current) > FRAME_SETTLE_EPS ||
      Math.abs(appliedTiltRef.current - targetTouchTilt) > FRAME_SETTLE_EPS ||
      Math.abs(appliedPitchRef.current - targetPitch) > FRAME_SETTLE_EPS ||
      Math.abs(sideFadeRef.current - fadeTarget) > 0.002
    if (
      springBusy ||
      (isLiveCenter && stageActiveRef.current)
    ) {
      requestFrame()
    }
  })

const handleClick = (event: ThreeEvent<MouseEvent>) => {
	    event.stopPropagation()
	    if (revealModeRef.current || removeExitRef.current.phase !== 'idle') return
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
    invalidate()
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
        hoverYawTargetRef.current = 0
        invalidate()
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
{browseHudMounted && !isRemoving ? (
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
	            {hideActiveCta ? null : (
	              <p
	                className="coverflow-pack-label__price"
	                aria-label={`${formatPrice(item.price ?? 4.99)} diamonds`}
	              >
	                <DiamondLottie size={13} aria-hidden />
	                <span className="coverflow-pack-label__price-amount">
	                  {formatPrice(item.price ?? 4.99)}
	                </span>
	              </p>
	            )}
		{isMobile ? null : removeControl}
		          </div>
		        </Html>
		      ) : null}

			{isMobile && removeControl && (browseHudMounted || activeHudMounted) ? (
			        <Html
			          position={removeHudPosition}
			          center
			          transform={false}
			          sprite={false}
			          zIndexRange={[35, 0]}
			          style={{ pointerEvents: 'none' }}
			          wrapperClass={`coverflow-pack-html coverflow-pack-html--remove${
			            (isActive ? activeHudVisible : browseHudVisible) ? ' is-visible' : ''
			          }`}
			        >
			          {removeControl}
			        </Html>
			      ) : null}

			{isCenter && tearHud ? <TearLottieHud modelY={modelY}>{tearHud}</TearLottieHud> : null}

{activeHudMounted && !isRemoving ? (
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
		              {hideActiveCta ? null : (
		                <p
		                  className="coverflow-pack-label__price"
		                  aria-label={`${formatPrice(item.price ?? 4.99)} diamonds`}
		                >
		                  <DiamondLottie size={13} aria-hidden />
		                  <span className="coverflow-pack-label__price-amount">
		                    {formatPrice(item.price ?? 4.99)}
		                  </span>
		                </p>
		              )}
		            </div>
	{hideActiveCta || isMobile ? null : onRemove ? (
			              removeControl
			            ) : (
		              <div className="coverflow-buy-pack-cta">
		                <CtaButton
		                  {...ctaButtonPropsFromTemplate('hexGoldCTA')}
		                  {...ctaSize}
		                  auroraPaused={isMobile}
		                  glowOuterBloom="off"
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
		            )}
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
		  stageActive,
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
					  onRemove,
					  hideActiveCta = false,
					  tearHud,
					  lockCardTopClosed = false,
					}: {
					  items: Iteration[]
					  focusIndex: number
					  selectedId: string | null
					  cameraSettings: CoverFlowCameraSettings
					  layout: CoverFlowLayoutSettings
						  textureTransform: VideoTextureTransform
						  centerTiltYaw: number
						  centerTiltPitch: number
						  stageActive: boolean
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
					  onRemove?: (item: Iteration) => void
					  hideActiveCta?: boolean
					  tearHud?: ReactNode
					  lockCardTopClosed?: boolean
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
		              stageActive={stageActive}
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
	              onRemove={onRemove}
		              hideActiveCta={hideActiveCta}
		              tearHud={index === focusIndex ? tearHud : undefined}
		              lockCardTopClosed={lockCardTopClosed}
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

export function CoverFlowCarouselV2({
  items,
  selectedId: selectedIdProp,
  onSelect: onSelectProp,
  onDeselect: onDeselectProp,
  onFocusChange,
  onBuy,
  onRemove,
  hideActiveCta = false,
  formatPrice = formatPackPrice,
  revealingCharacterId = null,
  revealingPackId: revealingPackIdProp = null,
  onPlayNow,
  cameraSettings: cameraSettingsProp,
  layout: layoutProp,
  disableSwipeDownDeactivate = false,
  disablePackOpenReveal = false,
  disableWheelPaging = false,
  tearHud,
  tearDrivesReveal = true,
  revealModelId = null,
  revealGirlName = null,
  revealOverlay = null,
  onRevealCards,
  onRevealContinue,
  onRevealSaveLater,
  onRevealSaveAndOpenNext,
  revealContinueLabel = 'Play now',
  revealSaveLaterLabel = 'Save for Later',
  revealSaveAndOpenNextLabel = 'Save for later and open another',
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
  const invalidateCanvasRef = useRef<(() => void) | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [centerTiltYaw, setCenterTiltYaw] = useState(0)
  const [centerTiltPitch, setCenterTiltPitch] = useState(0)
  const [gestureMode, setGestureMode] = useState<LiveGestureMode>('idle')
  const [, setLastGestureSpeed] = useState(0)
  const [canvasActive, setCanvasActive] = useState(true)
  const [frameLoop, setFrameLoop] = useState<CoverFlowFrameLoop>('always')
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
  const {
    enabled: motionEnabled,
    permission: motionPermission,
    subscribe: subscribeMotion,
  } = useMotion()
  const motionTiltOn = motionEnabled && motionPermission === 'granted'
  const [revealTimeline] = useState(() => loadPackTimeline())
  const [revealDuckInTimeline] = useState(() => loadDuckInTimeline())
  const [fanLayout] = useState(() => loadFanLayout())
  const [fanDrag] = useState(() => loadFanDrag())
  // Start closed — don't inherit a stale packOpenRequested from a prior tear
  // (that paints a black reveal stage with no fan cards yet).
  const [packOpenRequested, setPackOpenRequestedState] = useState(false)
  useEffect(() => {
    if (disablePackOpenReveal) {
      setPackOpenRequestedState(false)
      return
    }
    return subscribeCardTopDebug((debug) => {
      setPackOpenRequestedState(debug.packOpenRequested)
    })
  }, [disablePackOpenReveal])
  const focusedTearPack = items[focusIndex] ?? items[0] ?? null
  const revealMode =
    !disablePackOpenReveal &&
    ((tearDrivesReveal && packOpenRequested) || revealingCharacterId != null)
  // Prefer the exact pack id (foil slot 1 or 2); fall back to slot-1 id.
  const revealingPackId =
    revealingPackIdProp ??
    (packOpenRequested ? focusedTearPack?.id ?? null : null) ??
    (revealingCharacterId ? `pack-${revealingCharacterId}` : null)
  const revealingPack = revealingPackId
    ? items.find((item) => item.id === revealingPackId) ?? focusedTearPack
    : focusedTearPack
  const revealingPackMeta = revealingPackId
    ? parsePackId(revealingPackId)
    : null
  const revealingPackSlot: PackFaceSlot = revealingPackMeta?.slot ?? 1
  // Foil ids are `julianaval-1`, not `pack-julianaval`. Prefer the live model id.
  const revealingModelId =
    revealModelId?.trim() ||
    revealingPack?.characterId?.trim() ||
    (revealingPackMeta && !revealingPackMeta.characterId
      ? revealingPackMeta.ownerId
      : null) ||
    null
  const revealShared = catalog.resolveProductSharedMedia(revealingModelId)
  const fanGirlName =
    revealGirlName?.trim() ||
    revealingPack?.girlName?.trim() ||
    revealShared.girlName
  const fanOverlay = useMemo(
    () => ({
      name: fanGirlName,
      city:
        revealOverlay?.city ??
        revealingPack?.city ??
        revealShared.influencerCity,
      country:
        revealOverlay?.country ??
        revealingPack?.country ??
        revealShared.influencerCountry,
      flagEmoji:
        revealOverlay?.flagEmoji ??
        revealingPack?.flagEmoji ??
        revealShared.flagEmoji,
      flagSvgUrl:
        revealOverlay?.flagSvgUrl ??
        revealingPack?.flagSvgUrl ??
        revealShared.flagSvgUrl,
      gradientColor:
        revealOverlay?.gradientColor ??
        revealingPack?.overlayColorStart ??
        revealingPack?.backgroundColor ??
        revealShared.overlayBackgroundColor,
      gradientColorEnd:
        revealOverlay?.gradientColorEnd ??
        revealingPack?.overlayColorEnd ??
        revealingPack?.backgroundColor ??
        revealShared.overlayBackgroundColorEnd,
    }),
    [
      fanGirlName,
      revealOverlay?.city,
      revealOverlay?.country,
      revealOverlay?.flagEmoji,
      revealOverlay?.flagSvgUrl,
      revealOverlay?.gradientColor,
      revealOverlay?.gradientColorEnd,
      revealShared.flagEmoji,
      revealShared.flagSvgUrl,
      revealShared.influencerCity,
      revealShared.influencerCountry,
      revealShared.overlayBackgroundColor,
      revealShared.overlayBackgroundColorEnd,
      revealingPack?.backgroundColor,
      revealingPack?.city,
      revealingPack?.country,
      revealingPack?.flagEmoji,
      revealingPack?.flagSvgUrl,
      revealingPack?.overlayColorStart,
      revealingPack?.overlayColorEnd,
    ],
  )

  // Foil pack lights follow the centered (or revealing) pack's model colors.
  const focusedPackId =
    revealingPackId || items[focusIndex]?.id || selectedId || items[0]?.id || null
  const focusedOwnerId = focusedPackId ? ownerIdFromPackId(focusedPackId) : null
  catalog.resolveProductSharedMedia(revealingModelId ?? focusedOwnerId)

  // Prefetch fan media for the focused model. Never clear cards to null while
  // revealing — that left a black stage after the pack ducked behind a missing fan.
  useEffect(() => {
    let cancelled = false
    void fetchPackFanCatalog(revealingModelId).then(async (result) => {
      if (cancelled) return
      const fan =
        result && result.cards.length > 0 ? result : await fetchPackFanCatalog()
      if (!cancelled && fan) setBackendFan(fan)
    })
    return () => {
      cancelled = true
    }
  }, [revealingModelId])

  // Stable key so reveal auto-starts as soon as the seal opens — even if the
  // focused pack id briefly flickers during foil swap.
  const revealAutoStartKey =
    revealingPackId ??
    (packOpenRequested
      ? focusedTearPack?.id ?? selectedId ?? items[0]?.id ?? 'open'
      : null) ??
    revealingCharacterId

  const sequence = useRevealSequence({
    autoStart: revealMode,
    autoStartKey: revealAutoStartKey,
    autoStartDelayMs: 80,
  })
  // Don't wait on backendFan — local role videos fill empty API pools so the
  // fan always has cards once revealMode is on (avoids post-tear black screen).
  const revealCards = useMemo(
    () =>
      revealMode
        ? createMixedCategoryPackCards({
          characters: catalog.characters,
          backendFan,
          packSlot: revealingPackSlot,
          seed: sequence.runId,
          girlName: fanGirlName,
          overlay: fanOverlay,
        })
        : [],
    // Refresh card variants when replaying the open sequence.
    [
      revealMode,
      revealingPackId,
      revealingPackSlot,
      sequence.runId,
      backendFan,
      catalog.characters,
      fanGirlName,
      fanOverlay,
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
  motionTiltEnabledRef.current = motionTiltOn
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

  // Ignore stage-level tap activation briefly after a pack mesh click.
  // Otherwise R3F onClick (side pack) and use-gesture tap (focused pack)
  // both fire and fight over which pack stays active.
  const lastPackMeshSelectMsRef = useRef(0)

  // Keep keyboard/gesture handlers on the latest selection immediately.
  // selectedId only lands in selectedIdRef after paint via effect, so a fast
  // ↑ then ↓ (especially while the pointer is hovering the pack / CTA) used to
  // see a stale null ref and skip deactivate.
  const selectPack = useCallback(
    (id: string) => {
      selectedIdRef.current = id
      // Center the chosen pack in the same turn as selection so a following
      // stage-tap / focus sync cannot snap back to the previous index.
      const nextIndex = itemsRef.current.findIndex((item) => item.id === id)
      if (nextIndex >= 0) {
        focusIndexRef.current = nextIndex
        setFocusIndex((current) => (current === nextIndex ? current : nextIndex))
      }
      lastPackMeshSelectMsRef.current = performance.now()
      onSelect(id)
    },
    [onSelect],
  )
  const deselectPack = useCallback(() => {
    // Tear page (and other surfaces that disable swipe-down close) keep one
    // pack active. Clearing the ref here while the controlled selectedId stays
    // set makes moveFocus think nothing is active, then the selectedId effect
    // yanks focus back — packs oscillate and never settle.
    if (disableSwipeDownDeactivateRef.current && selectedIdRef.current) {
      onDeselect()
      return
    }
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
    if (revealCards.length) onRevealCards?.(revealCards)
  }, [onRevealCards, revealCards])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    focusIndexRef.current = focusIndex
  }, [focusIndex])

  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      return
    }

    let intersecting = true
    const sync = () => {
      const active =
        intersecting &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      setCanvasActive(active)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        intersecting =
          Boolean(entry?.isIntersecting) &&
          (entry?.intersectionRatio ?? 0) >= 0.35
        sync()
      },
      { threshold: [0, 0.35, 0.5, 1] },
    )
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [items.length])

  useEffect(() => {
    if (!canvasActive) {
      setFrameLoop('never')
      pauseAllVideoTextures()
      return
    }

    setFrameLoop('always')
    const bootTimer = window.setTimeout(() => {
      setFrameLoop('demand')
      invalidateCanvasRef.current?.()
    }, FRAMELOOP_BOOT_MS)
    return () => {
      window.clearTimeout(bootTimer)
    }
  }, [canvasActive])

  useEffect(() => {
    gestureModeRef.current = gestureMode
  }, [gestureMode])

  useEffect(() => {
    if (!canvasActive) return
    invalidateCanvasRef.current?.()
  }, [canvasActive, centerTiltPitch, centerTiltYaw, focusIndex, selectedId, revealMode])

  useEffect(() => {
    motionTiltEnabledRef.current = motionTiltOn
    if (!motionTiltOn) {
      deviceTiltYawRef.current = 0
      deviceTiltPitchRef.current = 0
      lastAppliedDeviceTiltRef.current = 0
      lastAppliedDevicePitchRef.current = 0
      setCenterTiltPitch(0)
    }
  }, [motionTiltOn])

  useEffect(() => {
    if (items.length === 0) {
      setFocusIndex(0)
      return
    }

    if (selectedId) {
      const selectedIndex = items.findIndex((item) => item.id === selectedId)
      if (selectedIndex >= 0) {
        // Avoid thrashing when selectedId is already centered.
        setFocusIndex((current) =>
          current === selectedIndex ? current : selectedIndex,
        )
        return
      }
    }

    setFocusIndex((current) => clamp(current, 0, items.length - 1))
  }, [items, selectedId])

  // Bubble centered pack changes so the stage glow can follow each model.
  // Only fire when the focused pack id changes — not on every items[] identity churn.
  const lastFocusNotifyIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!onFocusChange) return
    if (items.length === 0) {
      if (lastFocusNotifyIdRef.current !== null) {
        lastFocusNotifyIdRef.current = null
        onFocusChange(null, 0)
      }
      return
    }
    const index = clamp(focusIndex, 0, items.length - 1)
    const item = items[index] ?? null
    const id = item?.id ?? null
    if (id === lastFocusNotifyIdRef.current) return
    lastFocusNotifyIdRef.current = id
    onFocusChange(item, index)
  }, [focusIndex, items, onFocusChange])

  // Phone tilt drives the same center-pack yaw used by scrub/hover.
  // Finger scrub/swipe temporarily wins while a gesture is active.
  useEffect(() => {
    if (!motionTiltOn) {
      deviceTiltYawRef.current = 0
      deviceTiltPitchRef.current = 0
      lastAppliedDeviceTiltRef.current = 0
      lastAppliedDevicePitchRef.current = 0
      setCenterTiltYaw(0)
      setCenterTiltPitch(0)
      return
    }

    return subscribeMotion((sample) => {
      if (!sample.hasSample) return
      const gamma = sample.gamma
      const beta = sample.beta

      const normalizedYaw = MathUtils.clamp(
        gamma / DEVICE_TILT_GAMMA_RANGE,
        -1,
        1,
      )
      const targetYaw = -normalizedYaw * MAX_HOVER_YAW
      const nextYaw = MathUtils.lerp(
        deviceTiltYawRef.current,
        targetYaw,
        DEVICE_TILT_SMOOTHING,
      )
      deviceTiltYawRef.current = nextYaw

      let nextPitch = deviceTiltPitchRef.current
      if (typeof beta === 'number' && !Number.isNaN(beta)) {
        const betaOffset = beta - 55
        const normalizedPitch = MathUtils.clamp(
          betaOffset / DEVICE_TILT_BETA_RANGE,
          -1,
          1,
        )
        const targetPitch = -normalizedPitch * MAX_DEVICE_PITCH
        nextPitch = MathUtils.lerp(
          deviceTiltPitchRef.current,
          targetPitch,
          DEVICE_TILT_SMOOTHING,
        )
        deviceTiltPitchRef.current = nextPitch
      }

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
    })
  }, [motionTiltOn, subscribeMotion])

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
        // Pack mesh onClick already selected + focused; don't re-activate the
        // previously centered pack and undo that choice.
        if (performance.now() - lastPackMeshSelectMsRef.current < 450) {
          finishGesture(mode)
          return
        }
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

      // Ignore vertical page-scroll when the homepage asked not to steal it,
      // or downward scroll when nothing is active on other surfaces.
      if (
        !horizontal &&
        absY > 18 &&
        (disableSwipeDownDeactivateRef.current ||
          (my > 0 && !selectedIdRef.current))
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
      if (isUpwardActivate && !disableSwipeDownDeactivateRef.current) {
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
      // Homepage: only take horizontal; let the page scroller keep vertical pans.
      axis: disableSwipeDownDeactivate ? 'x' : undefined,
      // axisThreshold typing differs across @use-gesture versions
      axisThreshold: { touch: 8, mouse: 8, pen: 8 } as any,
      pointer: { touch: true, capture: !disableSwipeDownDeactivate },
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
		            dpr={isMobileViewportActive ? [1, 1.25] : [1, 1.5]}
		            // Boot briefly on always so Html projects; then demand + invalidate while animating/playing.
		            frameloop={frameLoop}
		            gl={{
		              antialias: !isMobileViewportActive,
		              alpha: true,
		              premultipliedAlpha: false,
		            }}
		            onCreated={({ gl, scene, invalidate }) => {
		              // Keep the WebGL clear fully transparent so the CSS gradient is visible.
		              scene.background = null
		              gl.setClearColor(0x000000, 0)
		              invalidateCanvasRef.current = invalidate
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
                stageActive={canvasActive}
isMobile={isMobileViewportActive}
	                shortHudGlass={isShortHudGlass}
	                revealMode={revealMode}
	                revealingPackId={revealingPackId}
	                revealPlaySequence={sequence.playSequence}
	                revealTimeline={revealTimeline}
                revealDuckInTimeline={revealDuckInTimeline}
                onSelect={selectPack}
                onRevealSequenceComplete={sequence.handleSequenceComplete}
                onRevealPackBehindFan={() => {
                  // Don't tuck the pack away until the fan has cards — otherwise
                  // a slow/failed fan catalog fetch leaves a pure black stage.
                  if (revealCardsRef.current.length > 0) {
                    sequence.handlePackBehindFan()
                  }
                }}
                onRevealPackBlurChange={sequence.handlePackBlurChange}
                formatPrice={formatPrice}
                onBuy={onBuy}
                onRemove={onRemove}
	                hideActiveCta={hideActiveCta}
	                tearHud={tearHud}
	                lockCardTopClosed={disablePackOpenReveal}
	              />
            </Suspense>
          </Canvas>
        </div>

        {revealMode && sequence.showFan && revealCards.length > 0 ? (
          <div className="reveal-stage__fan coverflow-reveal-fan">
            <CardFan
              key={`fan-${revealingModelId ?? revealingCharacterId}-${sequence.runId}`}
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

        {revealMode && sequence.showPlay && (onRevealContinue || revealingCharacterId) ? (
          <div
            className="reveal-stage__cta is-enter coverflow-reveal-cta"
            key={`play-cta-${sequence.runId}`}
          >
            {onRevealContinue ? (
              <>
                <div className="motion-reveal__continue">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate('squircleCTA')}
                    fillParent
                    type="button"
                    label={revealContinueLabel}
                    costAmount={null}
                    fontSize={15}
                    strokeWidth={1}
                    onClick={() => onRevealContinue(revealCards)}
                  />
                </div>
                {onRevealSaveLater ? (
                  <button
                    type="button"
                    className="motion-reveal__later"
                    onClick={onRevealSaveLater}
                  >
                    {revealSaveLaterLabel}
                  </button>
                ) : null}
                {onRevealSaveAndOpenNext ? (
                  <button
                    type="button"
                    className="motion-reveal__later"
                    onClick={onRevealSaveAndOpenNext}
                  >
                    {revealSaveAndOpenNextLabel}
                  </button>
                ) : null}
              </>
            ) : revealingCharacterId ? (
              <>
                <BuyButton
                  label="Play now"
                  onClick={() => {
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
              </>
            ) : null}
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

    </div>
  )
}

useGLTF.preload(PACK_MODEL_URL_V2)
