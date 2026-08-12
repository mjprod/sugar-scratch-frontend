export const CARD_ASPECT = 0.528421;
export const CARD_RADIUS = "4.55% / 3.5%";
export const STACK_SIZE = 10;
export const VISIBLE_STACK = 3;

/** Brightness for depth ≥2 non-front cards; promotes to 1 when it becomes front. */
export const STACK_BEHIND_BRIGHTNESS = 0.3;

/**
 * Rest brightness for the 2nd card (depth 1). Brighter than deeper stack so the
 * next card reads clearly; ramps to 1 with hero swipe progress.
 */
export const STACK_SECOND_BRIGHTNESS = 0.62;

/** Real-card depth pose steps (y offset + per-depth scale). */
export const STACK_DEPTH_Y = 14;
/** Per-depth shrink from full size. Depth 1 (next hero) rests at 0.97. */
export const STACK_DEPTH_SCALE_STEP = 0.03;

/** Visible gray underlays behind the 2nd-card locus. */
export const STACK_BACK_VISIBLE = 4;
/** Extra invisible feeder that becomes the new rearmost on cascade. */
export const STACK_BACK_FEEDER = 1;
export const STACK_BACK_TOTAL = STACK_BACK_VISIBLE + STACK_BACK_FEEDER;

/**
 * Shared spring for Time Machine pack dissolve + empty-state entrance.
 * Keep these matched so the last lip fade and "No more cards" rhyme.
 */
export const STACK_DISSOLVE_SPRING = {
  tension: 120,
  friction: 28,
  mass: 1.05,
  clamp: true,
} as const;
/** Scale lips recede to / empty card grows from (visual inverse pair). */
export const STACK_DISSOLVE_SCALE = 0.92;

/**
 * Solid grays — nearest → deepest. Visible lips stay fully opaque;
 * depth is L channel, not opacity. Feeder matches deepest.
 */
export const STACK_BACK_GRAYS = [
  "oklch(0.462 0.005 280)",
  "oklch(0.374 0.005 280)",
  "oklch(0.297 0.005 280)",
  "oklch(0.231 0.005 280)",
  "oklch(0.231 0.005 280)",
] as const;

/**
 * Absolute rest poses per gray lip (nearest → deepest).
 * Tuned via StackBacks debug panel; base locus still uses STACK_DEPTH_*.
 */
export const STACK_BACK_LIP_X = [8.75, -10, -0.75, -1.5] as const;
export const STACK_BACK_LIP_Y = [-1, -2, -18.5, -19.25] as const;
export const STACK_BACK_LIP_SCALE = [0.989, 0.979, 0.965, 0.959] as const;

/** Idle shuffled fan (nearest → deepest; feeder flat). */
export const STACK_BACK_REST_ROLL_DEGS = [1.9, -0.65, 2.9, -1.15, 0] as const;

/** Front-card brightness at full left / NOPE progress. */
export const SWIPE_NOPE_BRIGHTNESS = 1.07;
/** Front-card CSS contrast() at full left / NOPE progress (1 = identity). */
export const SWIPE_NOPE_CONTRAST = 1.16;
/** Front-card grayscale amount at full left / NOPE progress (0–1). */
export const SWIPE_NOPE_GRAYSCALE = 1;
/**
 * NOPE look: face dims / contrasts / desaturates, then a color overlay fades in.
 * Overlay color/opacity/blend live on .swipe-deck__slot-face::after.
 * Tunable live via the NOPE tint debug panel.
 */
export const SWIPE_NOPE_TINT_COLOR = '#e10600';
/** Peak overlay opacity at full left / NOPE progress (0–1). */
export const SWIPE_NOPE_TINT_OPACITY = 1;
/** CSS mix-blend-mode for the NOPE color overlay. */
export const SWIPE_NOPE_TINT_BLEND = 'multiply' as const;

export const SWIPE_NOPE_BLEND_MODES = [
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
  'normal',
] as const;

export type SwipeNopeBlendMode = (typeof SWIPE_NOPE_BLEND_MODES)[number];

/** Mobile-only: front-card scale at full left / NOPE progress (rest stays 1). */
export const SWIPE_NOPE_SCALE_MOBILE = 0.93;

/** Drag distance (px) before a swipe commits (desktop). */
export const SWIPE_THRESHOLD = 110;
/**
 * Mobile commit distance — ~25% more sensitive than the previous 72px gate
 * so left/right trips sooner on touch.
 */
export const SWIPE_THRESHOLD_MOBILE = 54;

/** Flick velocity (use-gesture units) that can commit under the distance gate. */
export const SWIPE_FLICK_VELOCITY = 0.45;
/** Mobile flick gate — ~25% easier than 0.32. */
export const SWIPE_FLICK_VELOCITY_MOBILE = 0.24;
/** Min |mx| still required when committing on velocity alone. */
export const SWIPE_FLICK_MIN_PX = 40;
/** Mobile min flick travel — ~25% easier than 22px. */
export const SWIPE_FLICK_MIN_PX_MOBILE = 16;

/** Multiplier for rotation while dragging. */
export const SWIPE_ROTATION = 0.04;
/** Extra counterclockwise degrees at full left / NOPE progress. */
export const SWIPE_NOPE_EXTRA_ROTATION = 2;

/** Idle front-card tilt (deg) so the next card peeks before drag. */
export const SWIPE_REST_ROTATION = 3;

/**
 * Extra downward offset for the idle hero (dvh → px via swipeHeroRestYPx).
 * Behind cards stay on the normal depth ladder; only depth 0 sinks.
 */
export const SWIPE_HERO_REST_Y_DVH = 2;

export function swipeHeroRestYPx(
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800,
): number {
  return (SWIPE_HERO_REST_Y_DVH / 100) * viewportHeight;
}

/**
 * Drag-tilt card shadows (opposite the swipe, blur grows with progress).
 * Applied to the front + next visible stack cards for a light 3D lift.
 */
export const SWIPE_SHADOW_MAX_OFFSET_X = 34;
export const SWIPE_SHADOW_MAX_OFFSET_Y = 26;
export const SWIPE_SHADOW_REST_BLUR = 28;
export const SWIPE_SHADOW_MAX_BLUR = 64;
export const SWIPE_SHADOW_REST_ALPHA = 0.42;
export const SWIPE_SHADOW_MAX_ALPHA = 0.72;

/**
 * Max horizontal card travel as a fraction of viewport width.
 * Desktop uses a tighter cap so the card doesn't travel across a wide stage.
 * Right (LIKE) is slightly looser than left (NOPE) on both breakpoints.
 */
/**
 * Left travel must clear the commit gate with headroom — drag clamps to this
 * cap and commit uses strict `>`, so equal-to-threshold never fires.
 */
export const SWIPE_LEFT_MAX_VW_MOBILE = 0.14;
export const SWIPE_RIGHT_MAX_VW_MOBILE = 0.15;
export const SWIPE_LEFT_MAX_VW_DESKTOP = 0.05;
export const SWIPE_RIGHT_MAX_VW_DESKTOP = 0.1;
/**
 * Vertical-down (NOPE) travel cap as a fraction of viewport height (dvh≈%).
 * Desktop stays tight so the card doesn't sink far; mobile is a bit looser.
 */
export const SWIPE_DOWN_MAX_DVH_DESKTOP = 5;
export const SWIPE_DOWN_MAX_DVH_MOBILE = 12;
/** @deprecated Prefer side-specific mobile caps. */
export const SWIPE_DRAG_MAX_VW_MOBILE = SWIPE_LEFT_MAX_VW_MOBILE;
/** @deprecated Prefer side-specific desktop caps. */
export const SWIPE_DRAG_MAX_VW_DESKTOP = SWIPE_LEFT_MAX_VW_DESKTOP;
/** Extra travel past the drag clamp when the card flies away on commit. */
export const SWIPE_EXIT_OVERSHOOT_VW = 0.15;
/**
 * Fraction of a side's drag clamp that counts as a distance-commit.
 * Desktop left clamp is far under the px threshold, so full-drag must commit
 * off the clamp — not only after leave overshoot / flick.
 */
export const SWIPE_CLAMP_COMMIT_T = 0.9;
/** Min width treated as desktop for the horizontal drag cap. */
export const SWIPE_DESKTOP_MIN_WIDTH = 768;

export function isSwipeDesktop(
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): boolean {
  return viewportWidth >= SWIPE_DESKTOP_MIN_WIDTH;
}

/** Commit / progress threshold for the current viewport. */
export function swipeThresholdPx(
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  return isSwipeDesktop(viewportWidth)
    ? SWIPE_THRESHOLD
    : SWIPE_THRESHOLD_MOBILE;
}

/**
 * Max |x| the finger can travel left while dragging (px).
 * Desktop: pure vw cap (often well under the commit threshold).
 * Mobile: vw cap, floored past the commit gate so a full drag can commit.
 */
export function swipeLeftDragMaxPx(
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  const byVw = viewportWidth * swipeDragMaxVw("left", viewportWidth);
  if (isSwipeDesktop(viewportWidth)) return Math.max(1, byVw);
  return Math.max(swipeThresholdPx(viewportWidth) * 1.12, byVw);
}

/**
 * Max downward finger travel while dragging (px), from dvh caps.
 * Desktop ≈ 5dvh so down-NOPE peaks without sinking the card.
 */
export function swipeDownDragMaxPx(
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800,
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  const dvh = isSwipeDesktop(viewportWidth)
    ? SWIPE_DOWN_MAX_DVH_DESKTOP
    : SWIPE_DOWN_MAX_DVH_MOBILE;
  return Math.max(1, (dvh / 100) * viewportHeight);
}

/**
 * Distance (px) at which left/NOPE visual progress hits 1.
 * Uses the left drag clamp — not the commit threshold — so desktop reaches
 * full grayscale/red multiply at max drag, not only after leave overshoot.
 */
export function swipeNopeProgressPx(
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  return swipeLeftDragMaxPx(viewportWidth);
}

export function swipeFlickVelocity(
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  return isSwipeDesktop(viewportWidth)
    ? SWIPE_FLICK_VELOCITY
    : SWIPE_FLICK_VELOCITY_MOBILE;
}

export function swipeFlickMinPx(
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  return isSwipeDesktop(viewportWidth)
    ? SWIPE_FLICK_MIN_PX
    : SWIPE_FLICK_MIN_PX_MOBILE;
}

export function swipeDragMaxVw(
  direction: "left" | "right" | "either" = "either",
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  const mobile = viewportWidth < SWIPE_DESKTOP_MIN_WIDTH;
  if (direction === "right") {
    return mobile ? SWIPE_RIGHT_MAX_VW_MOBILE : SWIPE_RIGHT_MAX_VW_DESKTOP;
  }
  if (direction === "left") {
    return mobile ? SWIPE_LEFT_MAX_VW_MOBILE : SWIPE_LEFT_MAX_VW_DESKTOP;
  }
  // Symmetric callers: use the larger side so both directions stay in range.
  return mobile
    ? Math.max(SWIPE_LEFT_MAX_VW_MOBILE, SWIPE_RIGHT_MAX_VW_MOBILE)
    : Math.max(SWIPE_LEFT_MAX_VW_DESKTOP, SWIPE_RIGHT_MAX_VW_DESKTOP);
}
/** @deprecated Use swipeDragMaxVw('left'). */
export function swipeLeftMaxVw(
  viewportWidth = typeof window !== "undefined"
    ? window.innerWidth
    : SWIPE_DESKTOP_MIN_WIDTH,
): number {
  return swipeDragMaxVw("left", viewportWidth);
}

export const DEFAULT_MEDIA_URL = "/video/default.mp4";
export const DEFAULT_BACK_URL = "/img/SugarScratch.png";

export type MediaType = "image" | "video";

/** Identity strip on the home swipe face (same HTML as collection/reveal). */
export type SwipeCardOverlayData = {
  name: string;
  city?: string;
  country?: string;
  flagEmoji?: string;
  flagSvgUrl?: string;
  gradientColor?: string;
  gradientColorEnd?: string;
  /** Home swipe never shows a pack/card number. */
  cardNumber?: string;
};

export type SwipeCardData = {
  id: string;
  /** Stable catalog character id when available. */
  characterId?: string;
  /** `/api/models` id when the home card is model-based. */
  modelId?: string;
  name: string;
  /** Home card meta social handle (from admin per-girl identity). */
  socialhandle?: string;
  mediaType: MediaType;
  mediaUrl: string;
  backUrl: string;
  /** Optional HTML identity overlay (girl name / location / flag). */
  overlay?: SwipeCardOverlayData | null;
};

/**
 * @deprecated Prefer `createSwipeDeck` from `@/shared/catalog/characters`
 * with the live catalog. Kept for isolated swipe demos/tests.
 */
export const DEMO_MEDIA = [
  { characterId: "policewoman", name: "Police Woman", mediaUrl: "/video/policewoman.mp4" },
  { characterId: "nurse", name: "Nurse", mediaUrl: "/video/nurse.mp4" },
  { characterId: "teacher", name: "Teacher", mediaUrl: "/video/teacher.mp4" },
  { characterId: "gym", name: "Gym", mediaUrl: "/video/gym.mp4" },
  { characterId: "firefighter", name: "Firefighter", mediaUrl: "/video/default.mp4" },
] as const;

/** @deprecated Prefer catalog `createSwipeDeck`. */
export function createTestDeck(count = STACK_SIZE): SwipeCardData[] {
  return Array.from({ length: count }, (_, index) => {
    const media = DEMO_MEDIA[index % DEMO_MEDIA.length]!;
    const cycle = Math.floor(index / DEMO_MEDIA.length) + 1;
    return {
      id: `swipe-${media.characterId}-${cycle}`,
      characterId: media.characterId,
      name: media.name,
      socialhandle: "",
      mediaType: "video" as const,
      mediaUrl: media.mediaUrl || DEFAULT_MEDIA_URL,
      backUrl: DEFAULT_BACK_URL,
    };
  });
}
