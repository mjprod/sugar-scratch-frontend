export type CardTopVec3 = {
  x: number;
  y: number;
  z: number;
};

export type CardTopRotation = CardTopVec3;
export type CardTopPivot = CardTopVec3;

export type CardTopBounds = {
  min: CardTopVec3;
  max: CardTopVec3;
  center: CardTopVec3;
  size: CardTopVec3;
};

export type CardTopPivotPreset =
  | "origin"
  | "center"
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

export type CardTopPosition = CardTopVec3;
export type CardTopScale = CardTopVec3;

export type CardTopDebugState = {
  position: CardTopPosition;
  rotation: CardTopRotation;
  scale: CardTopScale;
  opacity: number;
  pivot: CardTopPivot;
  showGizmo: boolean;
  tearT: number;
  tearPlaying: boolean;
  tearDurationMs: number;
  selectedTearKeyId: string | null;
  packOpenRequested: boolean;
  lottieOffset: CardTopVec3;
};

export const DEFAULT_CARD_TOP_POSITION: CardTopPosition = {
  x: 0,
  y: 0,
  z: 0,
};

export const DEFAULT_CARD_TOP_ROTATION: CardTopRotation = {
  x: 0,
  y: 0,
  z: 0,
};

export const DEFAULT_CARD_TOP_SCALE: CardTopScale = {
  x: 1,
  y: 1,
  z: 1,
};

export const DEFAULT_CARD_TOP_PIVOT: CardTopPivot = {
  x: 0.938762510760437,
  y: 0,
  z: 0.783224879081698,
};

export const DEFAULT_CARD_TOP_TEAR_DURATION_MS = 1000;

export const DEFAULT_CARD_TOP_DEBUG: CardTopDebugState = {
  position: { ...DEFAULT_CARD_TOP_POSITION },
  rotation: { ...DEFAULT_CARD_TOP_ROTATION },
  scale: { ...DEFAULT_CARD_TOP_SCALE },
  opacity: 1,
  pivot: { ...DEFAULT_CARD_TOP_PIVOT },
  showGizmo: false,
  tearT: 0,
  tearPlaying: false,
  tearDurationMs: DEFAULT_CARD_TOP_TEAR_DURATION_MS,
  selectedTearKeyId: "tear-1",
  packOpenRequested: false,
  lottieOffset: { x: -0.97, y: 2.26, z: -1.92 },
};

const STORAGE_KEY = "sugar.coverflowV2.cardTop.v10";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeVec3(
  value: Partial<CardTopVec3> | null | undefined,
  fallback: CardTopVec3,
): CardTopVec3 {
  return {
    x: isFiniteNumber(value?.x) ? value.x : fallback.x,
    y: isFiniteNumber(value?.y) ? value.y : fallback.y,
    z: isFiniteNumber(value?.z) ? value.z : fallback.z,
  };
}

function normalizeScale(
  value: Partial<CardTopScale> | null | undefined,
): CardTopScale {
  const next = normalizeVec3(value, DEFAULT_CARD_TOP_SCALE);
  return {
    x: Math.max(0.01, next.x),
    y: Math.max(0.01, next.y),
    z: Math.max(0.01, next.z),
  };
}

function normalizeState(
  parsed: Partial<CardTopDebugState> | null | undefined,
  options?: { hydrateEphemeral?: boolean },
): CardTopDebugState {
  const tearDurationMs = isFiniteNumber(parsed?.tearDurationMs)
    ? Math.min(4000, Math.max(200, parsed.tearDurationMs))
    : DEFAULT_CARD_TOP_TEAR_DURATION_MS;
  // On disk hydrate, drop tear/open playback — tearT≈1 made Pack Ready a
  // black torn foil on a black stage. Live setCardTopDebug keeps ephemeral values.
  const hydrateEphemeral = options?.hydrateEphemeral === true;
  const tearT = hydrateEphemeral
    ? 0
    : isFiniteNumber(parsed?.tearT)
      ? Math.min(1, Math.max(0, parsed.tearT))
      : DEFAULT_CARD_TOP_DEBUG.tearT;
  return {
    position: normalizeVec3(parsed?.position, DEFAULT_CARD_TOP_POSITION),
    rotation: normalizeVec3(parsed?.rotation, DEFAULT_CARD_TOP_ROTATION),
    scale: normalizeScale(parsed?.scale),
    opacity: isFiniteNumber(parsed?.opacity)
      ? Math.min(1, Math.max(0, parsed.opacity))
      : 1,
    pivot: normalizeVec3(parsed?.pivot, DEFAULT_CARD_TOP_PIVOT),
    showGizmo: parsed?.showGizmo === true,
    tearT,
    tearPlaying: hydrateEphemeral ? false : parsed?.tearPlaying === true,
    tearDurationMs,
    selectedTearKeyId:
      typeof parsed?.selectedTearKeyId === "string"
        ? parsed.selectedTearKeyId
        : DEFAULT_CARD_TOP_DEBUG.selectedTearKeyId,
    packOpenRequested: hydrateEphemeral
      ? false
      : parsed?.packOpenRequested === true,
    lottieOffset: normalizeVec3(parsed?.lottieOffset, {
      x: -0.97,
      y: 2.26,
      z: -1.92,
    }),
  };
}

function loadStoredState(): CardTopDebugState {
  if (typeof window === "undefined") return { ...DEFAULT_CARD_TOP_DEBUG };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CARD_TOP_DEBUG };
    return normalizeState(JSON.parse(raw) as Partial<CardTopDebugState>, {
      hydrateEphemeral: true,
    });
  } catch {
    return { ...DEFAULT_CARD_TOP_DEBUG };
  }
}

let current = loadStoredState();
const listeners = new Set<(state: CardTopDebugState) => void>();

let measuredBounds: CardTopBounds | null = null;
const boundsListeners = new Set<(bounds: CardTopBounds | null) => void>();

function persist(state: CardTopDebugState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  listeners.forEach((listener) => listener(current));
}

export function notifyCardTopDebug() {
  emit();
}

export function getCardTopDebug(): CardTopDebugState {
  return current;
}

export function getCardTopRotation(): CardTopRotation {
  return current.rotation;
}

export function getCardTopBounds(): CardTopBounds | null {
  return measuredBounds;
}

export function setCardTopDebug(
  next: Partial<CardTopDebugState>,
  options?: { persist?: boolean },
) {
  current = normalizeState({
    ...current,
    ...next,
    position: next.position
      ? { ...current.position, ...next.position }
      : current.position,
    rotation: next.rotation
      ? { ...current.rotation, ...next.rotation }
      : current.rotation,
    scale: next.scale ? { ...current.scale, ...next.scale } : current.scale,
    pivot: next.pivot ? { ...current.pivot, ...next.pivot } : current.pivot,
  });
  if (options?.persist !== false) persist(current);
  emit();
}

export function setCardTopPosition(next: Partial<CardTopPosition>) {
  setCardTopDebug({ position: { ...current.position, ...next } });
}

export function setCardTopRotation(next: Partial<CardTopRotation>) {
  setCardTopDebug({ rotation: { ...current.rotation, ...next } });
}

export function setCardTopScale(next: Partial<CardTopScale>) {
  setCardTopDebug({ scale: { ...current.scale, ...next } });
}

export function setCardTopPivot(next: Partial<CardTopPivot>) {
  setCardTopDebug({ pivot: { ...current.pivot, ...next } });
}

export function setCardTopShowGizmo(showGizmo: boolean) {
  setCardTopDebug({ showGizmo });
}

export function setCardTopTearT(tearT: number, tearPlaying = false) {
  // Never persist tear progress — sealed packs must load closed.
  setCardTopDebug(
    {
      tearT: Math.min(1, Math.max(0, tearT)),
      tearPlaying,
    },
    { persist: false },
  );
}

export function setCardTopTearPlaying(tearPlaying: boolean) {
  setCardTopDebug({ tearPlaying });
}

export function setCardTopTearDurationMs(tearDurationMs: number) {
  setCardTopDebug({ tearDurationMs });
}

export function setSelectedTearKeyId(selectedTearKeyId: string | null) {
  setCardTopDebug({ selectedTearKeyId });
}

export function playCardTopTear() {
  const start = current.tearT >= 0.999 ? 0 : current.tearT;
  setCardTopDebug({ tearT: start, tearPlaying: true });
}

export function pauseCardTopTear() {
  setCardTopDebug({ tearPlaying: false });
}

export function rewindCardTopTear() {
  setCardTopDebug(
    {
      tearT: 0,
      tearPlaying: false,
      packOpenRequested: false,
      position: { ...DEFAULT_CARD_TOP_POSITION },
      rotation: { ...DEFAULT_CARD_TOP_ROTATION },
      scale: { ...DEFAULT_CARD_TOP_SCALE },
      opacity: DEFAULT_CARD_TOP_DEBUG.opacity,
    },
    { persist: false },
  );
}


export function setPackOpenRequested(packOpenRequested: boolean) {
  setCardTopDebug({ packOpenRequested }, { persist: false });
}

export function setCardTopLottieOffset(next: Partial<CardTopVec3>) {
  setCardTopDebug({
    lottieOffset: { ...current.lottieOffset, ...next },
  });
}

export function resetCardTopRotation() {
  setCardTopRotation(DEFAULT_CARD_TOP_ROTATION);
}

export function resetCardTopDebug() {
  setCardTopDebug(DEFAULT_CARD_TOP_DEBUG);
}

export function subscribeCardTopDebug(
  listener: (state: CardTopDebugState) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeCardTopRotation(
  listener: (rotation: CardTopRotation) => void,
) {
  return subscribeCardTopDebug((state) => listener(state.rotation));
}

export function reportCardTopBounds(bounds: CardTopBounds) {
  measuredBounds = bounds;
  boundsListeners.forEach((listener) => listener(measuredBounds));
}

export function subscribeCardTopBounds(
  listener: (bounds: CardTopBounds | null) => void,
) {
  boundsListeners.add(listener);
  return () => {
    boundsListeners.delete(listener);
  };
}

export function pivotFromPreset(
  preset: CardTopPivotPreset,
  bounds: CardTopBounds | null,
): CardTopPivot {
  if (preset === "origin" || !bounds) return { ...DEFAULT_CARD_TOP_PIVOT };
  if (preset === "center") return { ...bounds.center };
  if (preset === "bottom-left") {
    return { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z };
  }
  if (preset === "bottom-right") {
    return { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z };
  }
  if (preset === "top-left") {
    return { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z };
  }
  return { x: bounds.max.x, y: bounds.max.y, z: bounds.min.z };
}

export function applyCardTopPivotPreset(preset: CardTopPivotPreset) {
  setCardTopPivot(pivotFromPreset(preset, measuredBounds));
}

export function matchingPivotPreset(
  pivot: CardTopPivot,
  bounds: CardTopBounds | null,
): CardTopPivotPreset | null {
  const presets: CardTopPivotPreset[] = [
    "origin",
    "center",
    "bottom-left",
    "bottom-right",
    "top-left",
    "top-right",
  ];
  for (const preset of presets) {
    const target = pivotFromPreset(preset, bounds);
    if (
      Math.abs(target.x - pivot.x) < 0.0005 &&
      Math.abs(target.y - pivot.y) < 0.0005 &&
      Math.abs(target.z - pivot.z) < 0.0005
    ) {
      return preset;
    }
  }
  return null;
}
