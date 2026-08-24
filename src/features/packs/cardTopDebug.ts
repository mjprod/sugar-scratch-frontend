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
  pivot: CardTopPivot;
  showGizmo: boolean;
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

export const DEFAULT_CARD_TOP_DEBUG: CardTopDebugState = {
  position: { ...DEFAULT_CARD_TOP_POSITION },
  rotation: { ...DEFAULT_CARD_TOP_ROTATION },
  scale: { ...DEFAULT_CARD_TOP_SCALE },
  pivot: { ...DEFAULT_CARD_TOP_PIVOT },
  showGizmo: true,
};

const STORAGE_KEY = "sugar.coverflowV2.cardTop.v4";

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
): CardTopDebugState {
  return {
    position: normalizeVec3(parsed?.position, DEFAULT_CARD_TOP_POSITION),
    rotation: normalizeVec3(parsed?.rotation, DEFAULT_CARD_TOP_ROTATION),
    scale: normalizeScale(parsed?.scale),
    pivot: normalizeVec3(parsed?.pivot, DEFAULT_CARD_TOP_PIVOT),
    showGizmo: typeof parsed?.showGizmo === "boolean" ? parsed.showGizmo : true,
  };
}

function loadStoredState(): CardTopDebugState {
  if (typeof window === "undefined") return { ...DEFAULT_CARD_TOP_DEBUG };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CARD_TOP_DEBUG };
    return normalizeState(JSON.parse(raw) as Partial<CardTopDebugState>);
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

export function getCardTopDebug(): CardTopDebugState {
  return current;
}

export function getCardTopRotation(): CardTopRotation {
  return current.rotation;
}

export function getCardTopBounds(): CardTopBounds | null {
  return measuredBounds;
}

export function setCardTopDebug(next: Partial<CardTopDebugState>) {
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
  persist(current);
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
