export type FanDragConfig = {
  /** Max upward travel from rest (px). Pointer up lifts the card. */
  maxLift: number
  /** Multiplier on pointer delta (1 = 1px cursor → 1px card). */
  dragScale: number
  /** Extra lift past maxLift allowed via rubber-band (px). 0 = hard clamp. */
  rubberBand: number
  /** Extra scale at full lift (0.2 = +20%). Eased in as the card rises. */
  scaleBoost: number
  /** Spring tension while scale follows the finger (floaty grow). */
  scaleFollowTension: number
  /** Spring friction while scale follows the finger. */
  scaleFollowFriction: number
  /** Spring tension when the card settles back on release. */
  returnTension: number
  /** Spring friction when the card settles back on release. */
  returnFriction: number
  /** Softer tension for scale settle — keeps the floaty shrink. */
  scaleReturnTension: number
  /** Softer friction for scale settle. */
  scaleReturnFriction: number
  /**
   * Extra horizontal spread applied to sibling cards at full lift (px).
   * Clears space when a covered card (not the top one) is dragged.
   */
  clearSpreadX: number
  /** Extra fan angle on siblings at full lift (deg). */
  clearSpreadDeg: number
  /** Extra outer drop on siblings at full lift (px). */
  clearOuterDrop: number
  /** Spring tension for sibling clear / restore. */
  clearTension: number
  /** Spring friction for sibling clear / restore. */
  clearFriction: number
  /**
   * Temporary rightward nudge on cards above the dragged one (px).
   * Full cycle is lift-driven: slide out → peak (z promotes here) → slide
   * home again lower in the drag, not at the top of the lift.
   */
  underPassX: number
  /** Extra rightward nudge per stack rank above the dragged card (px). */
  underPassStaggerX: number
  /**
   * Lift progress (0–1) where under-pass starts sliding cards right.
   * ~0.3 = early mid-drag.
   */
  underPassStart: number
  /**
   * Lift progress (0–1) where under-pass is fully aside and z-index promotes.
   */
  underPassPeak: number
  /**
   * Lift progress (0–1) where under-pass target has fully returned home.
   * Keep this well below 1 so the hand-off finishes lower in the drag.
   * The visual settle can trail a bit via underPassReturn spring.
   */
  underPassEnd: number
  /** Soft spring tension while cards ease home after the z flip. */
  underPassReturnTension: number
  /** Soft spring friction while cards ease home after the z flip. */
  underPassReturnFriction: number
  /**
   * CSS brightness of non-dragged cards at full lift (0–1).
   * Eases in with lift progress; 0.5 = half-bright siblings (not transparent).
   */
  dimBrightness: number
  /** Pointer movement (px) before a drag locks on — avoids accidental lifts. */
  activateThreshold: number
  /**
   * Mobile-only: max rotateY (deg) while scrubbing left/right at the top of a lift.
   * 0 disables. Desktop / mouse never tilts.
   */
  tiltMaxDeg: number
  /**
   * Horizontal finger travel (px) that maps to full tiltMaxDeg once lift is at top.
   * Lower = more sensitive scrub.
   */
  tiltScrubPx: number
  /**
   * Linear lift progress (0–1) where horizontal scrub starts driving tilt.
   * Keep near 1 so lift stays primary until the card is basically fully up.
   */
  tiltStartProgress: number
}

export const DEFAULT_FAN_DRAG: FanDragConfig = {
  maxLift: 54,
  dragScale: 1,
  rubberBand: 28,
  scaleBoost: 0.12,
  scaleFollowTension: 170,
  scaleFollowFriction: 20,
  returnTension: 220,
  returnFriction: 24,
  scaleReturnTension: 120,
  scaleReturnFriction: 18,
  // Keep the hand tight while lifting — under-pass handles the "slide under"
  // read; a big clear fan-out makes cards on the right look too open.
  clearSpreadX: 8,
  clearSpreadDeg: 3,
  clearOuterDrop: 2,
  clearTension: 160,
  clearFriction: 24,
  // Subtle right nudge — enough to sell the under-pass without a wide fan.
  underPassX: 36,
  // Keep the passing group bunched (low stagger = cards stay close together).
  underPassStaggerX: 8,
  // Slide-out mid-drag; longer return window for a soft ease home.
  underPassStart: 0.28,
  underPassPeak: 0.46,
  underPassEnd: 0.78,
  // Floaty settle back — slower than the clear-out spring.
  underPassReturnTension: 88,
  underPassReturnFriction: 22,
  dimBrightness: 0.35,
  activateThreshold: 4,
  // Mobile peek tilt at the top of a held lift.
  tiltMaxDeg: 30,
  // Shorter scrub = more sensitive left/right tilt.
  tiltScrubPx: 48,
  tiltStartProgress: 0.92,
}

// Bump when defaults change so localStorage doesn't stale-lock old values.
export const FAN_DRAG_STORAGE_KEY = 'sugar-scratch-reveal-fan-drag-v21'

export function cloneFanDrag(config: FanDragConfig): FanDragConfig {
  return { ...config }
}

export function loadFanDrag(): FanDragConfig {
  try {
    const raw = localStorage.getItem(FAN_DRAG_STORAGE_KEY)
    if (!raw) return cloneFanDrag(DEFAULT_FAN_DRAG)
    const parsed = JSON.parse(raw) as Partial<FanDragConfig>
    return {
      ...DEFAULT_FAN_DRAG,
      ...parsed,
    }
  } catch {
    return cloneFanDrag(DEFAULT_FAN_DRAG)
  }
}

export function saveFanDrag(config: FanDragConfig) {
  try {
    localStorage.setItem(FAN_DRAG_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // ignore
  }
}

export type FanDragField = {
  key: keyof FanDragConfig
  label: string
  min: number
  max: number
  step: number
  hint: string
}

export const FAN_DRAG_FIELDS: FanDragField[] = [
  {
    key: 'maxLift',
    label: 'Max lift Y',
    min: 20,
    max: 320,
    step: 1,
    hint: 'How far a card can be dragged upward (px).',
  },
  {
    key: 'dragScale',
    label: 'Drag scale',
    min: 0.4,
    max: 2,
    step: 0.05,
    hint: 'Pointer travel → card travel. Lower = heavier feel.',
  },
  {
    key: 'rubberBand',
    label: 'Rubber band',
    min: 0,
    max: 80,
    step: 1,
    hint: 'Extra give past max lift before hard stop (px).',
  },
  {
    key: 'scaleBoost',
    label: 'Scale boost',
    min: 0,
    max: 0.6,
    step: 0.01,
    hint: 'How much larger the card grows at full lift (0.12 = +12%).',
  },
  {
    key: 'scaleFollowTension',
    label: 'Scale follow tension',
    min: 40,
    max: 400,
    step: 1,
    hint: 'How quickly scale eases up while dragging. Lower = floatier.',
  },
  {
    key: 'scaleFollowFriction',
    label: 'Scale follow friction',
    min: 6,
    max: 50,
    step: 1,
    hint: 'Damping while scale eases up with the drag.',
  },
  {
    key: 'returnTension',
    label: 'Return tension',
    min: 80,
    max: 500,
    step: 1,
    hint: 'Spring snap-back stiffness on release (lift).',
  },
  {
    key: 'returnFriction',
    label: 'Return friction',
    min: 8,
    max: 60,
    step: 1,
    hint: 'Spring damping on release (lift). Higher = less bounce.',
  },
  {
    key: 'scaleReturnTension',
    label: 'Scale return tension',
    min: 40,
    max: 360,
    step: 1,
    hint: 'How gently scale shrinks on release. Lower = floatier.',
  },
  {
    key: 'scaleReturnFriction',
    label: 'Scale return friction',
    min: 6,
    max: 50,
    step: 1,
    hint: 'Damping on scale settle. Higher = less bounce.',
  },
  {
    key: 'clearSpreadX',
    label: 'Clear spread X',
    min: 0,
    max: 120,
    step: 1,
    hint: 'Extra spacing on cards left of the lift (px). Right-side cards stay tight.',
  },
  {
    key: 'clearSpreadDeg',
    label: 'Clear fan angle°',
    min: 0,
    max: 60,
    step: 1,
    hint: 'Extra fan angle on cards left of the lift. Right side uses under-pass only.',
  },
  {
    key: 'clearOuterDrop',
    label: 'Clear outer drop',
    min: 0,
    max: 40,
    step: 1,
    hint: 'Extra outer drop on cards left of the lift only.',
  },
  {
    key: 'clearTension',
    label: 'Clear tension',
    min: 60,
    max: 400,
    step: 1,
    hint: 'How quickly siblings fan out / settle back.',
  },
  {
    key: 'clearFriction',
    label: 'Clear friction',
    min: 8,
    max: 50,
    step: 1,
    hint: 'Damping on sibling clear motion.',
  },
  {
    key: 'underPassX',
    label: 'Under-pass X',
    min: 0,
    max: 120,
    step: 1,
    hint: 'How far cards above the drag slide right at the peak (px). Lower = less right travel.',
  },
  {
    key: 'underPassStaggerX',
    label: 'Under-pass stagger',
    min: 0,
    max: 40,
    step: 1,
    hint: 'Extra right shift per card further above the drag (px). Lower = group stays tighter.',
  },
  {
    key: 'underPassStart',
    label: 'Under-pass start',
    min: 0,
    max: 0.85,
    step: 0.01,
    hint: 'Lift progress when cards above begin sliding right.',
  },
  {
    key: 'underPassPeak',
    label: 'Under-pass peak',
    min: 0.1,
    max: 0.95,
    step: 0.01,
    hint: 'Lift progress when fully aside — z-index promotes here.',
  },
  {
    key: 'underPassEnd',
    label: 'Under-pass end',
    min: 0.15,
    max: 1,
    step: 0.01,
    hint: 'Lift progress when under-pass target is home (keep below 1).',
  },
  {
    key: 'underPassReturnTension',
    label: 'Under-pass return tension',
    min: 30,
    max: 280,
    step: 1,
    hint: 'How softly cards ease home after the z flip. Lower = slower/floatier.',
  },
  {
    key: 'underPassReturnFriction',
    label: 'Under-pass return friction',
    min: 8,
    max: 50,
    step: 1,
    hint: 'Damping on the ease-home. Higher = less bounce.',
  },
  {
    key: 'dimBrightness',
    label: 'Sibling dim',
    min: 0.15,
    max: 1,
    step: 0.05,
    hint: 'Brightness of other cards at full lift (0.5 = 50%). Uses filter, not opacity.',
  },
  {
    key: 'activateThreshold',
    label: 'Activate threshold',
    min: 0,
    max: 24,
    step: 1,
    hint: 'Pointer movement before a drag locks (px).',
  },
  {
    key: 'tiltMaxDeg',
    label: 'Tilt max°',
    min: 0,
    max: 40,
    step: 1,
    hint: 'Mobile-only max rotateY while scrubbing at full lift (deg).',
  },
  {
    key: 'tiltScrubPx',
    label: 'Tilt scrub px',
    min: 24,
    max: 180,
    step: 1,
    hint: 'Horizontal finger travel that reaches full tilt (px).',
  },
  {
    key: 'tiltStartProgress',
    label: 'Tilt start',
    min: 0.5,
    max: 1,
    step: 0.01,
    hint: 'Lift progress where left/right scrub begins tilting the card.',
  },
]

/** Ease-out cubic — progressive grow that softens into the top. */
export function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 3)
}

/** Touch / pen only — desktop mouse never gets the peek tilt. */
export function isMobileTiltPointer(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen'
}

/**
 * rotateY (deg) from horizontal scrub while held at the top of a lift.
 * Positive dx (finger right) → positive rotateY (right edge comes forward).
 * Soft-clamped to ±maxDeg.
 */
export function tiltYFromScrub(
  dxPx: number,
  scrubPx: number,
  maxDeg: number,
) {
  if (maxDeg <= 0 || scrubPx <= 0) return 0
  const t = Math.max(-1, Math.min(1, dxPx / scrubPx))
  // Ease into the extremes so the last few degrees feel soft, not clipped.
  const shaped = Math.sign(t) * (1 - Math.pow(1 - Math.abs(t), 1.35))
  return shaped * maxDeg
}

/** Target scale multiplier from lift progress (1 at rest). */
export function scaleMulFromLift(
  lift: number,
  maxLift: number,
  scaleBoost: number,
) {
  if (scaleBoost <= 0 || maxLift <= 0) return 1
  const t = easeOutCubic(Math.min(1, Math.max(0, lift / maxLift)))
  return 1 + scaleBoost * t
}

/** 0..1 ease-mapped lift progress used for sibling clear-out. */
export function liftProgress(lift: number, maxLift: number) {
  if (maxLift <= 0) return 0
  return easeOutCubic(Math.min(1, Math.max(0, lift / maxLift)))
}

/**
 * Lift-driven 0..1 envelope for the under-pass slide.
 *
 *   start → peak : slide right (0 → 1)
 *   peak  → end  : slide home  (1 → 0)
 *
 * Z-index should promote at `peak`, while cards are fully aside, so the
 * return phase reads as sliding back over the now-on-top card — and the
 * whole cycle finishes lower in the drag (`end` << 1).
 *
 * Return uses ease-out so the target decelerates into rest; pair with a
 * soft spring for the visual settle.
 */
export function underPassAmount(
  progress: number,
  start: number,
  peak: number,
  end: number,
) {
  const t = Math.min(1, Math.max(0, progress))
  const a = Math.min(0.98, Math.max(0, start))
  const b = Math.min(0.99, Math.max(a + 0.02, peak))
  const c = Math.min(1, Math.max(b + 0.02, end))

  if (t <= a) return 0
  if (t < b) {
    // Ease out into the peak so they arrive fully aside before z promotes.
    return easeOutCubic((t - a) / (b - a))
  }
  if (t < c) {
    // Ease-out home: quick leave from the peak, long soft landing into rest.
    return 1 - easeOutCubic((t - b) / (c - b))
  }
  return 0
}

/** True once lift has reached the under-pass peak (return / z-promote phase). */
export function underPassReturning(
  progress: number,
  peak: number,
  elevated: boolean,
) {
  return elevated || progress >= peak
}

/**
 * Extra +X on a card stacked above the dragged index during under-pass.
 * Stack order is reverse of array index: card 0 is top, last card is bottom.
 * So "above" means a lower index than the dragged card.
 */
export function underPassOffsetX(
  index: number,
  draggedIndex: number,
  amount: number,
  baseX: number,
  staggerX: number,
) {
  if (amount <= 0 || index >= draggedIndex) return 0
  const rank = draggedIndex - index
  return amount * (baseX + staggerX * Math.max(0, rank - 1))
}

/**
 * Clamp a positive lift distance (along the card's local up) with optional
 * iOS-style rubber band past maxLift.
 */
export function clampLift(
  rawLift: number,
  maxLift: number,
  rubberBand: number,
): number {
  if (rawLift <= 0) return 0
  if (rawLift <= maxLift || rubberBand <= 0) {
    return Math.min(rawLift, maxLift)
  }
  const over = rawLift - maxLift
  // Asymptotic ease into maxLift + rubberBand.
  return maxLift + rubberBand * (1 - 1 / (1 + over / rubberBand))
}

/** Unit vector for a card's local up in fan/screen space (CSS rotate clockwise). */
export function cardUpAxis(rotDeg: number) {
  const rad = (rotDeg * Math.PI) / 180
  return {
    x: Math.sin(rad),
    y: -Math.cos(rad),
  }
}
