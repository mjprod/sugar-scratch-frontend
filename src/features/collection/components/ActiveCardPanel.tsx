// @ts-nocheck
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { useCatalog } from '@/shared/catalog/CatalogContext'
import {
  buildPhotoSlotFills,
  getVideoCardCount,
  PHOTO_SLOTS,
  type PhotoSlotFill,
} from '../lib/photoSlots'

/** Role gift unlocks at 30 filled statics (3 motion videos × 10). */
const ROLE_GIFT_PHOTO_TOTAL = 30

type ActiveCardPanelProps = {
  cardName: string
  visible: boolean
  /** Stable seed so the same card always shows the same random photo slots. */
  cardKey?: string
  /** Optional play-count override (matches caption meta "Nx"). */
  videoCardCount?: number
  /** Optional photo-fill override (0–10) for this motion card's grid. */
  photoFilledCount?: number
  /** Optional catalog photo URLs for the grid (up to 10). */
  photoUrls?: string[]
  /**
   * Role-level filled static count (0–30). Gift unlocks at 30/30 across the
   * three motion videos in the category.
   */
  rolePhotoFilledCount?: number
  /** Exclusive category gift video URL. */
  giftVideoUrl?: string
  /** When true, only render actions (for under-card placement). */
  actionsOnly?: boolean
  /** When true, only render the photo cards grid. */
  gridOnly?: boolean
  onPlayGame?: () => void
  /** Play a filled PHOTO CARDS slot (0–9) → photo-scratch. */
  onPlayPhotoCard?: (slotIndex: number) => void
  onViewCard?: () => void
  /** Claim gift when role photo set is complete (30/30). */
  onGiftUnlocked?: () => void
  /** Close / deselect the active card (X on the photo grid). */
  onClose?: () => void
}

/**
 * Keep mounted just long enough for exit chrome to finish:
 * - photo reverse stagger ≈ 216ms
 * - under-card actions fade/slide ≈ 320ms
 */
const EXIT_MS = 360

/**
 * Survives React StrictMode remounts (component refs reset, this does not).
 * Keyed by panel identity so a true close→open still plays entrance once.
 * Mobile double-stagger was: remount mid-open → claim lost → entrance replayed.
 */
const openClaimByPanel = new Map<string, boolean>()

function PhotoCardsTitleIcon() {
  return (
    <svg
      className="photo-cards__title-icon"
      width="56"
      height="56"
      viewBox="0 0 56 56"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M7.715 49.574h40.57c4.899 0 7.36-2.437 7.36-7.265V13.69c0-4.828-2.461-7.265-7.36-7.265H7.715C2.84 6.426.355 8.84.355 13.69v28.62c0 4.851 2.485 7.265 7.36 7.265m10.218-21c-3.187 0-5.789-2.601-5.789-5.789c0-3.164 2.602-5.789 5.79-5.789c3.164 0 5.765 2.625 5.765 5.79c0 3.187-2.601 5.788-5.766 5.788M7.762 45.801c-2.25 0-3.633-1.36-3.633-3.657v-1.43l7.195-6.28c1.031-.914 2.156-1.383 3.211-1.383c1.125 0 2.32.469 3.352 1.43l4.5 4.03l11.18-9.937c1.171-1.031 2.46-1.5 3.773-1.5c1.289 0 2.625.492 3.75 1.524l10.78 9.984v3.61c0 2.25-1.405 3.609-3.632 3.609Z"
      />
    </svg>
  )
}

function GiftUnlockedIcon() {
  return (
    <svg
      className="btn-gift__icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M20 7h-2.18A3 3 0 0 0 15 3c-1.3 0-2.4.84-2.82 2H12c-.42-1.16-1.52-2-2.82-2A3 3 0 0 0 6.18 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1M9 5a1 1 0 0 1 1 1H8a1 1 0 0 1 1-1m6 0a1 1 0 0 1 1 1h-2a1 1 0 0 1 1-1M5 9h6v2H5zm2 4h4v7H7zm10 7h-4v-7h4zm2-9h-6V9h6z"
      />
    </svg>
  )
}

/** Classic triangle play mark for filled photo-slot hover/tap. */
function PhotoSlotPlayIcon() {
  return (
    <svg
      className="photo-cards__play-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d="M8 5.14v13.72L19 12 8 5.14z" />
    </svg>
  )
}

type GiftTextLayerId = 'dear' | 'love'

type GiftTextLayer = {
  /** Lead phrase span, e.g. "Thank you for playing" / "With love". */
  lead: string
  /** Name span, e.g. username / influencer name. */
  name: string
  /**
   * @deprecated Legacy single-string field from older debug saves.
   * Migrated into lead/name on load.
   */
  text?: string
  /** Horizontal anchor as % of card width (0–100). */
  x: number
  /** Vertical anchor as % of card height (0–100). */
  y: number
  /** Rotation in degrees. */
  rotate: number
  /** Uniform scale multiplier. */
  scale: number
  /** Lead span font size in rem. */
  fontSize: number
  /** Name span font size in rem (independent of lead). */
  nameFontSize: number
  /** text-align for multi-line blocks. */
  align: 'left' | 'center' | 'right'
}

type GiftTextDebugState = Record<GiftTextLayerId, GiftTextLayer>
type GiftTextViewport = 'desktop' | 'mobile'

type GiftTextPresets = Record<GiftTextViewport, GiftTextDebugState>

const GIFT_TEXT_DEBUG_STORAGE_KEY = 'sugar.giftTextDebug.v4'
const GIFT_TEXT_MOBILE_MQ = '(max-width: 720px)'

function defaultGiftTextDesktop(
  toName: string,
  fromName: string,
): GiftTextDebugState {
  const to = toName.trim() || 'Admin'
  const from = fromName.trim() || 'Juliana'
  // Locked desktop layout (do not retune via debug — debug edits mobile only).
  return {
    dear: {
      lead: 'Thank you for playing',
      name: to,
      x: 31,
      y: 5.5,
      rotate: -20,
      scale: 1,
      fontSize: 1.77,
      nameFontSize: 2.72,
      align: 'center',
    },
    love: {
      lead: 'With love',
      name: from,
      x: 64,
      y: 77.5,
      rotate: -23.5,
      scale: 1.2,
      fontSize: 1.81,
      nameFontSize: 2.8,
      align: 'center',
    },
  }
}

/** Locked mobile layout (tuned via gift-text debug drawer). */
function defaultGiftTextMobile(
  toName: string,
  fromName: string,
): GiftTextDebugState {
  const to = toName.trim() || 'Admin'
  const from = fromName.trim() || 'Juliana'
  return {
    dear: {
      lead: 'Thank you for playing',
      name: to,
      x: 27,
      y: 5.5,
      rotate: -20,
      scale: 0.78,
      fontSize: 1.77,
      nameFontSize: 2.72,
      align: 'center',
    },
    love: {
      lead: 'With love',
      name: from,
      x: 64,
      y: 77.5,
      rotate: -23.5,
      scale: 0.86,
      fontSize: 1.81,
      nameFontSize: 2.8,
      align: 'center',
    },
  }
}

function defaultGiftTextPresets(
  toName: string,
  fromName: string,
): GiftTextPresets {
  return {
    desktop: defaultGiftTextDesktop(toName, fromName),
    mobile: defaultGiftTextMobile(toName, fromName),
  }
}

function isGiftMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(GIFT_TEXT_MOBILE_MQ).matches
}

function clampGiftNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Split legacy single-line text into lead + name spans. */
function splitLegacyGiftText(
  id: GiftTextLayerId,
  text: string,
  fallback: GiftTextLayer,
): Pick<GiftTextLayer, 'lead' | 'name'> {
  const raw = text.trim()
  if (!raw) return { lead: fallback.lead, name: fallback.name }

  if (id === 'dear') {
    const playingLead = /^(thank you for playing)\s+(.*)$/i.exec(raw)
    if (playingLead) {
      return {
        lead: 'Thank you for playing',
        name: (playingLead[2] || fallback.name).trim() || fallback.name,
      }
    }
    const match = /^(thank you for)\s+(.*)$/i.exec(raw)
    if (match) {
      return {
        lead: match[1] || fallback.lead,
        name: (match[2] || fallback.name).trim() || fallback.name,
      }
    }
    const playingIdx = raw.toLowerCase().lastIndexOf(' playing ')
    if (playingIdx > 0) {
      return {
        lead: raw.slice(0, playingIdx).trim() || fallback.lead,
        name: raw.slice(playingIdx + 1).trim() || fallback.name,
      }
    }
  }

  if (id === 'love') {
    const match = /^(with love)\s+(.*)$/i.exec(raw)
    if (match) {
      return {
        lead: 'With love',
        name: (match[2] || fallback.name).trim() || fallback.name,
      }
    }
  }

  // Fallback: first line = lead, rest = name (or whole string as lead).
  const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  if (lines.length >= 2) {
    return { lead: lines[0]!, name: lines.slice(1).join(' ') }
  }
  const parts = raw.split(/\s+/)
  if (parts.length >= 3) {
    return {
      lead: parts.slice(0, 2).join(' '),
      name: parts.slice(2).join(' '),
    }
  }
  return { lead: raw, name: fallback.name }
}

function mergeGiftTextLayer(
  src: Partial<GiftTextLayer> & { text?: string } | undefined,
  fallback: GiftTextLayer,
  id: GiftTextLayerId,
): GiftTextLayer {
  const raw = src ?? {}
  let lead =
    typeof raw.lead === 'string' && raw.lead.trim() ? raw.lead : fallback.lead
  let name =
    typeof raw.name === 'string' && raw.name.trim() ? raw.name : fallback.name
  if (
    (!(typeof raw.lead === 'string' && raw.lead.trim()) ||
      !(typeof raw.name === 'string' && raw.name.trim())) &&
    typeof raw.text === 'string' &&
    raw.text.trim()
  ) {
    const split = splitLegacyGiftText(id, raw.text, fallback)
    if (!(typeof raw.lead === 'string' && raw.lead.trim())) lead = split.lead
    if (!(typeof raw.name === 'string' && raw.name.trim())) name = split.name
  }
  const fontSize = clampGiftNumber(
    typeof raw.fontSize === 'number' ? raw.fontSize : fallback.fontSize,
    0.5,
    4,
  )
  return {
    lead,
    name,
    x: clampGiftNumber(typeof raw.x === 'number' ? raw.x : fallback.x, -20, 120),
    y: clampGiftNumber(typeof raw.y === 'number' ? raw.y : fallback.y, -20, 120),
    rotate: clampGiftNumber(
      typeof raw.rotate === 'number' ? raw.rotate : fallback.rotate,
      -180,
      180,
    ),
    scale: clampGiftNumber(
      typeof raw.scale === 'number' ? raw.scale : fallback.scale,
      0.2,
      4,
    ),
    fontSize,
    nameFontSize: clampGiftNumber(
      typeof raw.nameFontSize === 'number' ? raw.nameFontSize : fontSize,
      0.5,
      4,
    ),
    align:
      raw.align === 'left' || raw.align === 'center' || raw.align === 'right'
        ? raw.align
        : fallback.align,
  }
}

function mergeGiftTextState(
  parsed:
    | Partial<Record<GiftTextLayerId, Partial<GiftTextLayer> & { text?: string }>>
    | undefined,
  defaults: GiftTextDebugState,
): GiftTextDebugState {
  return {
    dear: mergeGiftTextLayer(parsed?.dear, defaults.dear, 'dear'),
    love: mergeGiftTextLayer(parsed?.love, defaults.love, 'love'),
  }
}

/**
 * Load desktop+mobile presets.
 * - v4 shape: { desktop, mobile }
 * - legacy v3/v1 single state → treated as mobile override only (desktop stays locked defaults)
 */
function loadGiftTextPresets(
  toName: string,
  fromName: string,
): GiftTextPresets {
  const defaults = defaultGiftTextPresets(toName, fromName)
  if (typeof window === 'undefined') return defaults
  try {
    const rawV4 = window.localStorage.getItem(GIFT_TEXT_DEBUG_STORAGE_KEY)
    if (rawV4) {
      const parsed = JSON.parse(rawV4) as Partial<{
        desktop: Partial<
          Record<GiftTextLayerId, Partial<GiftTextLayer> & { text?: string }>
        >
        mobile: Partial<
          Record<GiftTextLayerId, Partial<GiftTextLayer> & { text?: string }>
        >
      }>
      return {
        // Desktop stays code-locked; ignore local desktop overrides so locked values win.
        desktop: defaults.desktop,
        mobile: mergeGiftTextState(parsed?.mobile, defaults.mobile),
      }
    }

    // Legacy single-state saves become the mobile preset seed.
    const legacyRaw =
      window.localStorage.getItem('sugar.giftTextDebug.v3') ||
      window.localStorage.getItem('sugar.giftTextDebug.v2') ||
      window.localStorage.getItem('sugar.giftTextDebug.v1')
    if (!legacyRaw) return defaults
    const legacy = JSON.parse(legacyRaw) as Partial<
      Record<GiftTextLayerId, Partial<GiftTextLayer> & { text?: string }>
    >
    return {
      desktop: defaults.desktop,
      mobile: mergeGiftTextState(legacy, defaults.mobile),
    }
  } catch {
    return defaults
  }
}

function giftLayerStyle(layer: GiftTextLayer): CSSProperties {
  // Layer is always full card width so text never reflows/shrinks when X moves.
  // X shifts the whole full-width block (0% = left-biased, 50% = centered, 100% = right).
  const xShift = layer.x - 50
  return {
    left: 0,
    right: 0,
    width: '100%',
    maxWidth: 'none',
    top: `${layer.y}%`,
    bottom: 'auto',
    textAlign: layer.align,
    alignItems:
      layer.align === 'right'
        ? 'flex-end'
        : layer.align === 'left'
          ? 'flex-start'
          : 'center',
    transform: `translateX(${xShift}%) rotate(${layer.rotate}deg) scale(${layer.scale})`,
    transformOrigin: '50% top',
    whiteSpace: 'pre-line',
    boxSizing: 'border-box',
  }
}

function giftLeadChipStyle(layer: GiftTextLayer): CSSProperties {
  return { fontSize: `${layer.fontSize}rem` }
}

function giftNameChipStyle(layer: GiftTextLayer): CSSProperties {
  return { fontSize: `${layer.nameFontSize}rem` }
}

type PlayingPopupProps = {
  open: boolean
  message: string
  /** Optional exclusive gift / media video. */
  videoUrl?: string
  /**
   * When true, render the video as a motion-card postcard with script overlays
   * (Dear … / with love …) instead of a plain media dialog.
   */
  giftCard?: boolean
  /** Top-left dedication, e.g. "Admin". */
  giftToName?: string
  /** Bottom-right signature, e.g. "Juliana". */
  giftFromName?: string
  onDismiss: () => void
}

/** Lightweight modal stub for play actions (static card / motion game / gift). */
function PlayingPopup({
  open,
  message,
  videoUrl,
  giftCard = false,
  giftToName = 'Admin',
  giftFromName = 'Juliana',
  onDismiss,
}: PlayingPopupProps) {
  const toSeed = (giftToName || 'Admin').trim() || 'Admin'
  const fromSeed = (giftFromName || 'Juliana').trim() || 'Juliana'
  // Desktop/mobile layouts are code-locked; pick by viewport at render time.
  const [giftPresets, setGiftPresets] = useState<GiftTextPresets>(() =>
    loadGiftTextPresets(toSeed, fromSeed),
  )
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    isGiftMobileViewport(),
  )
  // Gift card entrance: start blurred/small/faded, then ease to final.
  const [giftEnter, setGiftEnter] = useState(false)
  // Hold entrance until first frame is ready (avoids blank black card).
  const [giftVideoReady, setGiftVideoReady] = useState(false)
  // Reverse exit: keep mounted while text + card stagger out, then dismiss.
  const [giftExiting, setGiftExiting] = useState(false)
  const giftExitTimerRef = useRef<number | null>(null)
  const giftVideoRef = useRef<HTMLVideoElement | null>(null)
  // Card exit delay (~280ms) + card transition (~820ms).
  const GIFT_EXIT_MS = 1120
  // Don't block the entrance forever on slow networks.
  const GIFT_VIDEO_READY_FALLBACK_MS = 2200

  const clearGiftExitTimer = () => {
    if (giftExitTimerRef.current != null) {
      window.clearTimeout(giftExitTimerRef.current)
      giftExitTimerRef.current = null
    }
  }

  // Re-seed labels when the gift opens with new names (unless user already tuned).
  useEffect(() => {
    if (!open || !giftCard) return
    setGiftPresets(() => loadGiftTextPresets(toSeed, fromSeed))
  }, [open, giftCard, toSeed, fromSeed])

  // Track mobile breakpoint so runtime render can pick desktop vs mobile presets.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(GIFT_TEXT_MOBILE_MQ)
    const sync = () => setIsMobileViewport(mq.matches)
    sync()
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync)
      return () => mq.removeEventListener('change', sync)
    }
    mq.addListener(sync)
    return () => mq.removeListener(sync)
  }, [])

  // Reset readiness whenever the gift opens / source changes.
  useEffect(() => {
    if (!open || !giftCard) {
      setGiftEnter(false)
      setGiftVideoReady(false)
      setGiftExiting(false)
      clearGiftExitTimer()
      return
    }
    setGiftExiting(false)
    setGiftEnter(false)
    setGiftVideoReady(false)
  }, [open, giftCard, videoUrl])

  // Start entrance only after the gift video has a frame (or fallback timeout).
  useEffect(() => {
    if (!open || !giftCard || !giftVideoReady || giftExiting) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGiftEnter(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [open, giftCard, giftVideoReady, giftExiting, videoUrl])

  // Safety: if the video never reports ready, still enter so the UI isn't stuck.
  useEffect(() => {
    if (!open || !giftCard || giftVideoReady) return
    const timer = window.setTimeout(() => {
      setGiftVideoReady(true)
    }, GIFT_VIDEO_READY_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [open, giftCard, giftVideoReady, videoUrl])

  const markGiftVideoReady = useCallback(() => {
    setGiftVideoReady(true)
  }, [])

  // If the browser already has frames (warm cache), mark ready immediately.
  useEffect(() => {
    if (!open || !giftCard || giftVideoReady) return
    const video = giftVideoRef.current
    if (!video) return
    if (video.readyState >= 2) {
      setGiftVideoReady(true)
    }
  }, [open, giftCard, giftVideoReady, videoUrl])

  // Kick playback once the entrance begins (autoplay may race preload).
  useEffect(() => {
    if (!open || !giftCard || !giftEnter) return
    const video = giftVideoRef.current
    if (!video) return
    const play = () => {
      try {
        const p = video.play()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      } catch {
        // ignore autoplay rejection
      }
    }
    play()
  }, [open, giftCard, giftEnter])

  // Persist mobile preset only (desktop remains code-locked).
  useEffect(() => {
    if (!open || !giftCard) return
    try {
      window.localStorage.setItem(
        GIFT_TEXT_DEBUG_STORAGE_KEY,
        JSON.stringify({
          desktop: giftPresets.desktop,
          mobile: giftPresets.mobile,
        }),
      )
    } catch {
      // ignore quota / private mode
    }
  }, [giftPresets, open, giftCard])

  useEffect(() => () => clearGiftExitTimer(), [])

  const trimmedVideo = videoUrl?.trim() || ''
  const isGiftCard = Boolean(giftCard && trimmedVideo)
  const activeViewport: GiftTextViewport = isMobileViewport
    ? 'mobile'
    : 'desktop'
  const giftText = giftPresets[activeViewport]

  const requestClose = useCallback(() => {
    if (giftExiting) return
    if (!isGiftCard) {
      onDismiss()
      return
    }
    // Reverse stagger: text out, then card scale/blur/fade, then unmount.
    setGiftEnter(false)
    setGiftExiting(true)
    clearGiftExitTimer()
    giftExitTimerRef.current = window.setTimeout(() => {
      giftExitTimerRef.current = null
      setGiftExiting(false)
      onDismiss()
    }, GIFT_EXIT_MS)
  }, [GIFT_EXIT_MS, giftExiting, isGiftCard, onDismiss])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        requestClose()
      }
    }
    // Capture so gift/playing popup Escape wins over collection card close.
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, requestClose])

  if (!open || typeof document === 'undefined') return null

  const giftFrameClass = [
    'gift-postcard__frame',
    giftEnter && !giftExiting ? 'is-entered' : '',
    giftExiting ? 'is-exiting' : '',
    isGiftCard && !giftVideoReady && !giftExiting ? 'is-loading' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <div
      className={`static-card-playing${isGiftCard ? ' is-gift-card' : ''}${
        giftExiting ? ' is-gift-exiting' : ''
      }${
        isGiftCard && !giftVideoReady && !giftExiting ? ' is-gift-loading' : ''
      }`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={`static-card-playing__dialog${
          trimmedVideo ? ' has-video' : ''
        }${isGiftCard ? ' is-gift-card' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playing-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        {isGiftCard ? (
          <div className="gift-postcard">
            <div className={giftFrameClass}>
              <video
                ref={giftVideoRef}
                className="gift-postcard__video"
                src={trimmedVideo}
                autoPlay
                muted={false}
                playsInline
                loop
                preload="auto"
                onLoadedData={markGiftVideoReady}
                onCanPlay={markGiftVideoReady}
                onPlaying={markGiftVideoReady}
                onError={markGiftVideoReady}
              />
              <div className="gift-postcard__scrim" aria-hidden="true" />
              <p
                className="gift-postcard__layer gift-postcard__dear"
                style={giftLayerStyle(giftText.dear)}
              >
                <span className="gift-postcard__layer-motion gift-postcard__layer-motion--lead">
                  <span
                    className="gift-postcard__chip gift-postcard__chip--lead"
                    style={giftLeadChipStyle(giftText.dear)}
                  >
                    {giftText.dear.lead}
                  </span>
                </span>
                <span className="gift-postcard__layer-motion gift-postcard__layer-motion--name">
                  <span
                    className="gift-postcard__chip gift-postcard__chip--name"
                    style={giftNameChipStyle(giftText.dear)}
                  >
                    {giftText.dear.name}
                  </span>
                </span>
              </p>
              <p
                className="gift-postcard__layer gift-postcard__love"
                style={giftLayerStyle(giftText.love)}
              >
                <span className="gift-postcard__layer-motion gift-postcard__layer-motion--lead">
                  <span
                    className="gift-postcard__chip gift-postcard__chip--lead"
                    style={giftLeadChipStyle(giftText.love)}
                  >
                    {giftText.love.lead}
                  </span>
                </span>
                <span className="gift-postcard__layer-motion gift-postcard__layer-motion--name">
                  <span
                    className="gift-postcard__chip gift-postcard__chip--name"
                    style={giftNameChipStyle(giftText.love)}
                  >
                    {giftText.love.name}
                  </span>
                </span>
              </p>
            </div>
            <button
              type="button"
              className={`photo-cards__close gift-postcard__close${
                giftEnter && giftVideoReady && !giftExiting ? ' is-visible' : ''
              }`}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                requestClose()
              }}
              disabled={giftExiting || !giftVideoReady}
              aria-label="Close gift"
              title="Close"
            >
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <p id="playing-popup-title" className="gift-postcard__sr-only">
              Gift postcard
            </p>
          </div>
        ) : (
          <>
            {trimmedVideo ? (
              <video
                className="static-card-playing__video"
                src={trimmedVideo}
                controls
                autoPlay
                playsInline
                preload="metadata"
              />
            ) : null}
            <p
              id="playing-popup-title"
              className="static-card-playing__message"
            >
              {message}
            </p>
            <button
              type="button"
              className="static-card-playing__dismiss"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

type GiftUnlockedButtonProps = {
  open: boolean
  onClick?: () => void
}

/** Dedicated yellow-gold gift CTA — icon only, sits in the actions row. */
function GiftUnlockedButton({ open, onClick }: GiftUnlockedButtonProps) {
  return (
    <button
      type="button"
      className="btn-gift active-card-actions__gift"
      onClick={onClick}
      tabIndex={open ? 0 : -1}
      title="Gift unlocked — claim your reward"
      aria-label="Gift Unlocked"
    >
      <GiftUnlockedIcon />
    </button>
  )
}

function PhotoSlot({
  index,
  fill,
  playRevealed,
  keyboardSelected,
  onRevealPlay,
  onPlay,
}: {
  index: number
  fill: PhotoSlotFill
  /** Sticky play-button reveal for tap devices (no hover). */
  playRevealed?: boolean
  /** Desktop keyboard highlight for the currently cycled slot. */
  keyboardSelected?: boolean
  onRevealPlay?: (index: number) => void
  onPlay?: (index: number) => void
}) {
  const collected = fill.collected
  return (
    <div
      className={`photo-cards__slot${collected ? ' is-filled is-collected' : ' is-locked'}${
        collected && playRevealed ? ' is-play-revealed' : ''
      }${keyboardSelected ? ' is-kb-selected' : ''}`}
      style={{ ['--slot-i' as string]: String(index) } as CSSProperties}
      aria-label={
        collected
          ? `Photo card ${index + 1}, collected`
          : `Photo card slot ${index + 1}, not collected`
      }
      aria-current={keyboardSelected ? 'true' : undefined}
      onPointerDown={
        collected
          ? (event) => {
              // Stage drag / card gestures must not steal the slot press.
              event.stopPropagation()
            }
          : undefined
      }
      onClick={
        collected
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              // First tap on mobile (no hover): stick the play control open.
              onRevealPlay?.(index)
            }
          : undefined
      }
    >
      {/* Inner face owns hover scale so entrance animation doesn't snap it. */}
      <div className="photo-cards__slot-face">
        {fill.src ? (
          <img
            className="photo-cards__slot-img"
            src={fill.src}
            alt=""
            loading="lazy"
            draggable={false}
          />
        ) : (
          <span className="photo-cards__slot-num" aria-hidden="true">
            {index + 1}
          </span>
        )}
        {collected ? (
          <button
            type="button"
            className="photo-cards__play"
            aria-label={`Play static card ${index + 1}`}
            title="Play"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onPlay?.(index)
            }}
          >
            <PhotoSlotPlayIcon />
          </button>
        ) : (
          <span className="photo-cards__lock" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="1em"
              height="1em"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Under-card chrome when a pack is active:
 * action buttons sit directly under the card; photo grid sits to the right.
 * Photo slots stagger in on open and reverse-stagger out on close.
 */
export default function ActiveCardPanel({
  cardName,
  visible,
  cardKey,
  videoCardCount,
  photoFilledCount,
  photoUrls,
  rolePhotoFilledCount,
  giftVideoUrl,
  actionsOnly = false,
  gridOnly = false,
  onPlayGame,
  onPlayPhotoCard,
  onViewCard,
  onGiftUnlocked,
  onClose,
}: ActiveCardPanelProps) {
  // Stay mounted during exit so reverse stagger can play.
  // Always start closed so enter opacity/transform transitions have a from-state
  // (actionsOnly mounts with visible=true, so open must not initialize true).
  const panelId = `${gridOnly ? 'grid' : actionsOnly ? 'actions' : 'full'}:${
    cardKey || cardName || 'card'
  }`
  const [mounted, setMounted] = useState(false)
  // If this panel identity already claimed open (StrictMode remount), start open
  // so we never re-run closed→open entrance animations.
  const [open, setOpen] = useState(() => Boolean(openClaimByPanel.get(panelId)))
  // Tap devices: which filled slot has its play control stuck open.
  const [revealedPlaySlot, setRevealedPlaySlot] = useState<number | null>(null)
  // Desktop keyboard: currently highlighted static slot (0–9), null until →.
  const [kbSelectedSlot, setKbSelectedSlot] = useState<number | null>(null)
  // Stub popup for static photo-card / motion game play / gift video.
  const [playingMessage, setPlayingMessage] = useState<string | null>(null)
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | undefined>()
  const [playingGiftCard, setPlayingGiftCard] = useState(false)
  const catalog = useCatalog()
  const giftFromName =
    catalog.productSharedMedia.girlName.trim() || 'Juliana'
  // Demo recipient until a real collector profile name exists.
  const giftToName = 'Admin'
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  const slotFills = useMemo(
    () =>
      buildPhotoSlotFills(
        cardKey || cardName || 'card',
        photoFilledCount,
        photoUrls,
      ),
    [cardKey, cardName, photoFilledCount, photoUrls],
  )
  const filledCount = useMemo(
    () => slotFills.filter((s) => s.collected).length,
    [slotFills]
  )
  // Same seed as coverflow__meta-text play count ("Nx").
  const videoCount = useMemo(
    () => getVideoCardCount(cardKey || cardName || 'card', videoCardCount),
    [cardKey, cardName, videoCardCount]
  )
  // 0x = no owned playable games yet → CTA becomes "Buy Pack to Play".
  const canPlayGame = videoCount > 0
  const playGameLabel = canPlayGame
    ? `Play Game (${videoCount}x)`
    : 'Buy Pack to Play'
  // Gift unlocks when all 30 role statics are filled (3 × 10).
  // Fallback: if role count is unknown, keep legacy per-card 10/10 for demos.
  const roleFilled =
    typeof rolePhotoFilledCount === 'number' &&
    Number.isFinite(rolePhotoFilledCount)
      ? Math.max(0, Math.min(ROLE_GIFT_PHOTO_TOTAL, rolePhotoFilledCount))
      : null
  const giftUnlocked =
    roleFilled != null
      ? roleFilled >= ROLE_GIFT_PHOTO_TOTAL
      : filledCount >= PHOTO_SLOTS

  useEffect(() => {
    if (!visible) {
      // Release the claim only after a real close so the next open can enter.
      openClaimByPanel.delete(panelId)
      setOpen(false)
      setRevealedPlaySlot(null)
      setKbSelectedSlot(null)
      setPlayingMessage(null)
      setPlayingVideoUrl(undefined)
      setPlayingGiftCard(false)
      const t = window.setTimeout(() => {
        // Only unmount if we're still closed (avoid race with a quick re-open).
        if (!visibleRef.current) setMounted(false)
      }, EXIT_MS)
      return () => window.clearTimeout(t)
    }

    setMounted(true)

    // Already claimed (this instance or a StrictMode remount of the same panel).
    // Stay open — never force closed again or the stagger replays.
    if (openClaimByPanel.get(panelId)) {
      setOpen(true)
      return
    }

    // Claim immediately — survives StrictMode remount via module Map.
    openClaimByPanel.set(panelId, true)
    // Start closed so CSS has a from-state, then open once.
    setOpen(false)

    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!visibleRef.current) return
        setOpen(true)
      })
    })
    return () => {
      // StrictMode will cancel and remount. Claim stays in the module Map so
      // the remounted instance latches open without a second entrance.
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [panelId, visible])

  // Clear sticky play reveal when the user taps/clicks outside the slots.
  useEffect(() => {
    if (revealedPlaySlot == null) return
    const onPointerDown = () => setRevealedPlaySlot(null)
    // Defer so the revealing click itself doesn't immediately clear.
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [revealedPlaySlot])

  const handleRevealPlay = useCallback((index: number) => {
    setRevealedPlaySlot(index)
    setKbSelectedSlot(index)
  }, [])

  const handlePlayStaticCard = useCallback(
    (index: number) => {
      if (onPlayPhotoCard) {
        onPlayPhotoCard(index)
        return
      }
      setPlayingMessage('Static card playing')
    },
    [onPlayPhotoCard],
  )

  const handlePlayMotionGame = useCallback(() => {
    if (canPlayGame) {
      // Real scratch game — skip the stub dialog.
      onPlayGame?.()
      return
    }
    setPlayingMessage('Buy Pack to Play')
    onPlayGame?.()
  }, [canPlayGame, onPlayGame])

  const handleViewCard = useCallback(() => {
    setPlayingMessage('Can play no game scratch')
    onViewCard?.()
  }, [onViewCard])

  // Desktop keyboard while this motion card is open (grid owns static slots;
  // actions-only also handles Enter → primary CTA modal).
  useEffect(() => {
    if (!visible || !open) return
    // Prefer the grid panel for slot cycling when both mount (desktop split).
    // actionsOnly still handles Enter so the CTA works either layout.
    const ownsStaticSlots = gridOnly || !actionsOnly

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
      // Nested playing/gift popup owns its own keys (Escape etc.).
      // Exclude the parent FeaturedCardOverlay dialog so photo-slot keys still work.
      if (
        document.querySelector(
          '.static-card-playing, [role="dialog"][aria-modal="true"]:not(.creator-featured-overlay)',
        )
      ) {
        return
      }

      const key = event.key

      // Enter / Return → primary CTA modal ("Play motion game").
      // actionsOnly owns this when both panels are mounted.
      if (key === 'Enter' || key === 'Return') {
        if (gridOnly) return
        event.preventDefault()
        handlePlayMotionGame()
        return
      }

      if (!ownsStaticSlots) return

      // → cycles static slots 1→10 (wrap). Holding repeats via OS key-repeat.
      if (key === 'ArrowRight' || key === 'Right') {
        event.preventDefault()
        setKbSelectedSlot((prev) => {
          if (prev == null) return 0
          return (prev + 1) % PHOTO_SLOTS
        })
        return
      }

      // ← reverse cycle through static slots.
      if (key === 'ArrowLeft' || key === 'Left') {
        event.preventDefault()
        setKbSelectedSlot((prev) => {
          if (prev == null) return PHOTO_SLOTS - 1
          return (prev - 1 + PHOTO_SLOTS) % PHOTO_SLOTS
        })
        return
      }

      // Space opens the currently selected static card (collected only).
      if (key === ' ' || key === 'Spacebar' || key === 'Space') {
        if (kbSelectedSlot == null) return
        const fill = slotFills[kbSelectedSlot]
        if (!fill?.collected) return
        event.preventDefault()
        setRevealedPlaySlot(kbSelectedSlot)
        handlePlayStaticCard(kbSelectedSlot)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    actionsOnly,
    gridOnly,
    handlePlayMotionGame,
    handlePlayStaticCard,
    kbSelectedSlot,
    open,
    slotFills,
    visible,
  ])

  // Keep a hidden warm loader mounted while gift is unlocked so open is cached.
  useEffect(() => {
    const giftUrl = giftVideoUrl?.trim() || ''
    if (!giftUnlocked || !giftUrl || typeof document === 'undefined') return

    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('aria-hidden', 'true')
    // Off-DOM is enough for HTTP cache; keep src alive until unlock goes away.
    video.src = giftUrl
    try {
      video.load()
    } catch {
      // ignore
    }
    return () => {
      try {
        video.pause()
      } catch {
        // ignore
      }
      video.removeAttribute('src')
      try {
        video.load()
      } catch {
        // ignore
      }
    }
  }, [giftUnlocked, giftVideoUrl])

  const handleGiftUnlocked = () => {
    const giftUrl = giftVideoUrl?.trim() || ''
    setPlayingVideoUrl(giftUrl || undefined)
    setPlayingGiftCard(Boolean(giftUrl))
    setPlayingMessage(
      giftUrl
        ? `Gift from ${giftFromName}`
        : 'Postcard with user name and influencer name, flip card and exclusive video',
    )
    onGiftUnlocked?.()
  }

  const handleDismissPlaying = () => {
    setPlayingMessage(null)
    setPlayingVideoUrl(undefined)
    setPlayingGiftCard(false)
  }

  const playingPopup = (
    <PlayingPopup
      open={playingMessage != null}
      message={playingMessage ?? ''}
      videoUrl={playingVideoUrl}
      giftCard={playingGiftCard}
      giftToName={giftToName}
      giftFromName={giftFromName}
      onDismiss={handleDismissPlaying}
    />
  )

  // Phase classes:
  // - open+visible  → is-visible (entrance only)
  // - !open+visible → no phase class (closed pre-enter; NEVER is-exiting)
  // - !open+!visible+mounted → is-exiting (true close reverse-stagger)
  // Using is-exiting during the pre-enter closed frame was replaying exit then
  // entrance on mobile, which looked like a double stagger.
  const phaseClass = open
    ? ' is-visible'
    : !visible && mounted
      ? ' is-exiting'
      : ''

  if (actionsOnly) {
    if (!mounted && !visible) return null
    return (
      <>
        <div
          className={`active-card-actions${phaseClass}`}
          aria-hidden={!open}
        >
          <p className="active-card-actions__label">{cardName}</p>
          <div
            className={`active-card-actions__row${
              giftUnlocked ? ' has-gift' : ''
            }`}
          >
            <button
              type="button"
              className="btn-180"
              onClick={handlePlayMotionGame}
              tabIndex={open ? 0 : -1}
            >
              <span className="btn-180-label">{playGameLabel}</span>
            </button>
            <button
              type="button"
              className="active-card-panel__btn active-card-panel__btn--secondary"
              onClick={handleViewCard}
              tabIndex={open ? 0 : -1}
            >
              View
            </button>
            {giftUnlocked && (
              <GiftUnlockedButton open={open} onClick={handleGiftUnlocked} />
            )}
          </div>
        </div>
        {playingPopup}
      </>
    )
  }

  if (gridOnly) {
    if (!mounted && !visible) return null
    return (
      <div
        className={`active-card-panel active-card-panel--grid${phaseClass}`}
        aria-hidden={!open}
      >
        <section className="photo-cards" aria-label="Photo cards">
          {/* Own row above the title/count + grid so close can sit at the top. */}
          <div className="photo-cards__close-row">
            {onClose && (
              <button
                type="button"
                className="photo-cards__close"
                onPointerDown={(e) => {
                  // Stage drag / card gestures must not steal the close press.
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onClose()
                }}
                tabIndex={open ? 0 : -1}
                aria-label="Close card"
                title="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="28"
                  height="28"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
          <div className="photo-cards__header">
            <div className="photo-cards__header-left">
              <h3 className="photo-cards__title">
                <span className="photo-cards__title-text">Photo Cards</span>
                <PhotoCardsTitleIcon />
              </h3>
              <span className="photo-cards__count">
                {filledCount}/{PHOTO_SLOTS}
              </span>
            </div>
          </div>
          {/* No enterKey remount — CSS is-visible drives the stagger once. */}
          <div className="photo-cards__grid">
            {slotFills.map((fill, i) => (
              <PhotoSlot
                key={i}
                index={i}
                fill={fill}
                playRevealed={revealedPlaySlot === i}
                keyboardSelected={kbSelectedSlot === i}
                onRevealPlay={handleRevealPlay}
                onPlay={handlePlayStaticCard}
              />
            ))}
          </div>
        </section>
        {playingPopup}
      </div>
    )
  }

  if (!mounted && !visible) return null

  return (
    <div
      className={`active-card-panel${phaseClass}`}
      aria-hidden={!open}
    >
      <div className="active-card-panel__stack">
        <p className="active-card-panel__label">{cardName}</p>

        <div
          className={`active-card-panel__actions${
            giftUnlocked ? ' has-gift' : ''
          }`}
        >
          <button
            type="button"
            className="btn-180"
            onClick={handlePlayMotionGame}
            tabIndex={open ? 0 : -1}
          >
            <span className="btn-180-label">{playGameLabel}</span>
          </button>
          <button
            type="button"
            className="active-card-panel__btn active-card-panel__btn--secondary"
            onClick={handleViewCard}
            tabIndex={open ? 0 : -1}
          >
            View
          </button>
          {giftUnlocked && (
            <GiftUnlockedButton open={open} onClick={handleGiftUnlocked} />
          )}
        </div>

        <section className="photo-cards" aria-label="Photo cards">
          <div className="photo-cards__header">
            <h3 className="photo-cards__title">
              <span className="photo-cards__title-text">Photo Cards</span>
              <PhotoCardsTitleIcon />
            </h3>
            <span className="photo-cards__count">
              {filledCount}/{PHOTO_SLOTS}
            </span>
          </div>
          <div className="photo-cards__grid">
            {slotFills.map((fill, i) => (
              <PhotoSlot
                key={i}
                index={i}
                fill={fill}
                playRevealed={revealedPlaySlot === i}
                keyboardSelected={kbSelectedSlot === i}
                onRevealPlay={handleRevealPlay}
                onPlay={handlePlayStaticCard}
              />
            ))}
          </div>
        </section>
      </div>
      {playingPopup}
    </div>
  )
}
