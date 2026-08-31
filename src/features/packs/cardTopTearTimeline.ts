export type CardTopTearPose = {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  opacity: number;
};

export type CardTopTearKeyframe = CardTopTearPose & {
  id: string;
  /** Normalized time along the tear, 0 = closed, 1 = open. */
  t: number;
};

export type CardTopTearTimeline = {
  keys: CardTopTearKeyframe[];
};

export type CardTopTearChannel = keyof CardTopTearPose;

const TEAR_CHANNELS: CardTopTearChannel[] = [
  "x",
  "y",
  "z",
  "rotX",
  "rotY",
  "rotZ",
  "scaleX",
  "scaleY",
  "scaleZ",
  "opacity",
];

export const DEFAULT_CARD_TOP_TEAR_POSE: CardTopTearPose = {
  x: 0,
  y: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  opacity: 1,
};

export const CARD_TOP_TEAR_DURATION_MS = 1000;
export const CARD_TOP_TEAR_STEP_COUNT = 6;
export const CARD_TOP_TEAR_STEP_MS =
  CARD_TOP_TEAR_DURATION_MS / (CARD_TOP_TEAR_STEP_COUNT - 1);

export function cardTopTearStepTime(step: number) {
  return (Math.min(CARD_TOP_TEAR_STEP_COUNT, Math.max(1, step)) - 1) /
    (CARD_TOP_TEAR_STEP_COUNT - 1);
}

/** Slider 100% lands on this step; later steps autoplay. */
export const CARD_TOP_TEAR_SLIDER_END_STEP = 4;
export const CARD_TOP_TEAR_FINISH_MS = CARD_TOP_TEAR_STEP_MS * 2;
/** Start pack spin/duck this far before the end of step 6. */
export const CARD_TOP_TEAR_SPIN_LEAD_MS = 100;

export function cardTopTearSpinStartT(timeline?: CardTopTearTimeline) {
  const keys = sortCardTopTearKeys(
    (timeline ?? DEFAULT_CARD_TOP_TEAR_TIMELINE).keys,
  );
  const last = keys[keys.length - 1];
  const previous = keys[keys.length - 2];
  if (!last) return 1;
  const stepStart = previous?.t ?? last.t;
  const stepSpan = Math.max(1e-6, last.t - stepStart);
  const leadT = (CARD_TOP_TEAR_SPIN_LEAD_MS / CARD_TOP_TEAR_STEP_MS) * stepSpan;
  return Math.max(stepStart, last.t - leadT);
}

export function cardTopTearSliderEndT(timeline?: CardTopTearTimeline) {
  const keys = sortCardTopTearKeys(
    (timeline ?? DEFAULT_CARD_TOP_TEAR_TIMELINE).keys,
  );
  return keys[CARD_TOP_TEAR_SLIDER_END_STEP - 1]?.t ?? cardTopTearStepTime(4);
}

export function tearTFromSliderPercent(
  percent: number,
  timeline?: CardTopTearTimeline,
) {
  return (Math.min(100, Math.max(0, percent)) / 100) *
    cardTopTearSliderEndT(timeline);
}

export function sliderPercentFromTearT(
  tearT: number,
  timeline?: CardTopTearTimeline,
) {
  const endT = cardTopTearSliderEndT(timeline);
  if (endT <= 0) return 0;
  return Math.min(100, Math.max(0, (tearT / endT) * 100));
}

/**
 * Six equal 200ms chunks over 1000ms.
 * Step 1 is closed. Step 5 sits between the old 4 and 5.
 */
export const DEFAULT_CARD_TOP_TEAR_TIMELINE: CardTopTearTimeline = {
  keys: [
    {
      id: "tear-1",
      t: cardTopTearStepTime(1),
      ...DEFAULT_CARD_TOP_TEAR_POSE,
    },
    {
      id: "tear-2",
      t: cardTopTearStepTime(2),
      x: 0,
      y: 0.02,
      z: 0.02,
      rotX: -18,
      rotY: 0,
      rotZ: -4,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      opacity: 1,
    },
    {
      id: "tear-3",
      t: cardTopTearStepTime(3),
      x: -0.01,
      y: 0.05,
      z: 0.06,
      rotX: -46,
      rotY: 2,
      rotZ: -8,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      opacity: 1,
    },
    {
      id: "tear-4",
      t: cardTopTearStepTime(4),
      x: -0.03,
      y: 0.01,
      z: -0.02,
      rotX: -82,
      rotY: 4,
      rotZ: 41,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      opacity: 1,
    },
    {
      id: "tear-5",
      t: cardTopTearStepTime(5),
      x: -0.35,
      y: -1.97,
      z: 0.03,
      rotX: -84,
      rotY: 5,
      rotZ: 136,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      opacity: 1,
    },
    {
      id: "tear-6",
      t: cardTopTearStepTime(6),
      x: 1.6,
      y: -5,
      z: 0.34,
      rotX: -30,
      rotY: 3,
      rotZ: -11,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      opacity: 0,
    },
  ],
};

const STORAGE_KEY = "sugar.coverflowV2.cardTopTear.v7";

let cachedTimeline: CardTopTearTimeline | null = null;

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function newId() {
  return `tear-${Math.random().toString(36).slice(2, 9)}`;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleChannel(
  keys: CardTopTearKeyframe[],
  i: number,
  local: number,
  channel: CardTopTearChannel,
) {
  const p1 = keys[i][channel];
  const p2 = keys[i + 1][channel];
  const p0 = keys[Math.max(0, i - 1)][channel];
  const p3 = keys[Math.min(keys.length - 1, i + 2)][channel];
  return catmullRom(p0, p1, p2, p3, local);
}

function poseFromKey(key: CardTopTearKeyframe): CardTopTearPose {
  return {
    x: key.x,
    y: key.y,
    z: key.z,
    rotX: key.rotX,
    rotY: key.rotY,
    rotZ: key.rotZ,
    scaleX: key.scaleX,
    scaleY: key.scaleY,
    scaleZ: key.scaleZ,
    opacity: key.opacity,
  };
}

function normalizeKey(
  key: Partial<CardTopTearKeyframe> | null | undefined,
  fallback: CardTopTearKeyframe,
): CardTopTearKeyframe {
  const pose = { ...DEFAULT_CARD_TOP_TEAR_POSE };
  for (const channel of TEAR_CHANNELS) {
    const value = key?.[channel];
    pose[channel] = isFiniteNumber(value) ? value : fallback[channel];
  }
  return {
    id: typeof key?.id === "string" && key.id ? key.id : fallback.id || newId(),
    t: clamp01(isFiniteNumber(key?.t) ? key.t : fallback.t),
    ...pose,
  };
}

export function cloneCardTopTearTimeline(
  timeline: CardTopTearTimeline,
): CardTopTearTimeline {
  return {
    keys: timeline.keys.map((key) => ({ ...key })),
  };
}

export function sortCardTopTearKeys(
  keys: CardTopTearKeyframe[],
): CardTopTearKeyframe[] {
  return [...keys].sort((a, b) => a.t - b.t);
}

function pinEndpoints(keys: CardTopTearKeyframe[]): CardTopTearKeyframe[] {
  const sorted = sortCardTopTearKeys(keys);
  if (sorted.length === 0) {
    return cloneCardTopTearTimeline(DEFAULT_CARD_TOP_TEAR_TIMELINE).keys;
  }
  sorted[0] = { ...sorted[0], t: 0 };
  sorted[sorted.length - 1] = { ...sorted[sorted.length - 1], t: 1 };
  return sorted;
}

export function loadCardTopTearTimeline(): CardTopTearTimeline {
  if (cachedTimeline) return cloneCardTopTearTimeline(cachedTimeline);
  if (typeof window === "undefined") {
    cachedTimeline = cloneCardTopTearTimeline(DEFAULT_CARD_TOP_TEAR_TIMELINE);
    return cloneCardTopTearTimeline(cachedTimeline);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedTimeline = cloneCardTopTearTimeline(DEFAULT_CARD_TOP_TEAR_TIMELINE);
      return cloneCardTopTearTimeline(cachedTimeline);
    }
    const parsed = JSON.parse(raw) as Partial<CardTopTearTimeline>;
    if (!Array.isArray(parsed.keys) || parsed.keys.length < 2) {
      cachedTimeline = cloneCardTopTearTimeline(DEFAULT_CARD_TOP_TEAR_TIMELINE);
      return cloneCardTopTearTimeline(cachedTimeline);
    }
    cachedTimeline = {
      keys: pinEndpoints(
        parsed.keys.map((key, index) =>
          normalizeKey(
            key,
            DEFAULT_CARD_TOP_TEAR_TIMELINE.keys[
              Math.min(index, DEFAULT_CARD_TOP_TEAR_TIMELINE.keys.length - 1)
            ],
          ),
        ),
      ),
    };
    return cloneCardTopTearTimeline(cachedTimeline);
  } catch {
    cachedTimeline = cloneCardTopTearTimeline(DEFAULT_CARD_TOP_TEAR_TIMELINE);
    return cloneCardTopTearTimeline(cachedTimeline);
  }
}

export function saveCardTopTearTimeline(timeline: CardTopTearTimeline) {
  cachedTimeline = cloneCardTopTearTimeline(timeline);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedTimeline));
  } catch {
    // ignore quota / private mode
  }
}

export function sampleCardTopTear(
  timeline: CardTopTearTimeline,
  t: number,
): CardTopTearPose {
  const keys = sortCardTopTearKeys(timeline.keys);
  if (keys.length === 0) return { ...DEFAULT_CARD_TOP_TEAR_POSE };
  const u = clamp01(t);
  if (u <= keys[0].t) return poseFromKey(keys[0]);
  const last = keys[keys.length - 1];
  if (u >= last.t) return poseFromKey(last);

  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < u) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const span = Math.max(1e-6, b.t - a.t);
  const local = clamp01((u - a.t) / span);
  return {
    x: sampleChannel(keys, i, local, "x"),
    y: sampleChannel(keys, i, local, "y"),
    z: sampleChannel(keys, i, local, "z"),
    rotX: sampleChannel(keys, i, local, "rotX"),
    rotY: sampleChannel(keys, i, local, "rotY"),
    rotZ: sampleChannel(keys, i, local, "rotZ"),
    scaleX: Math.max(0.01, sampleChannel(keys, i, local, "scaleX")),
    scaleY: Math.max(0.01, sampleChannel(keys, i, local, "scaleY")),
    scaleZ: Math.max(0.01, sampleChannel(keys, i, local, "scaleZ")),
    opacity: Math.min(1, Math.max(0, sampleChannel(keys, i, local, "opacity"))),
  };
}

export function nearestCardTopTearKey(
  timeline: CardTopTearTimeline,
  t: number,
  selectedId?: string | null,
): CardTopTearKeyframe | null {
  if (selectedId) {
    const selected = timeline.keys.find((key) => key.id === selectedId);
    if (selected) return selected;
  }
  if (timeline.keys.length === 0) return null;
  const u = clamp01(t);
  return sortCardTopTearKeys(timeline.keys).reduce((closest, key) =>
    Math.abs(key.t - u) < Math.abs(closest.t - u) ? key : closest,
  );
}

export function captureCardTopTearKey(
  timeline: CardTopTearTimeline,
  id: string,
  pose: CardTopTearPose,
): CardTopTearTimeline {
  return {
    keys: pinEndpoints(
      timeline.keys.map((key) => (key.id === id ? { ...key, ...pose } : key)),
    ),
  };
}

export function resetCardTopTearKey(
  timeline: CardTopTearTimeline,
  id: string,
): CardTopTearTimeline {
  const defaults = DEFAULT_CARD_TOP_TEAR_TIMELINE.keys;
  const index = sortCardTopTearKeys(timeline.keys).findIndex((key) => key.id === id);
  const fallback = defaults[Math.max(0, index)] ?? DEFAULT_CARD_TOP_TEAR_POSE;
  return captureCardTopTearKey(timeline, id, poseFromKey({
    ...fallback,
    id,
    t: fallback.t,
  }));
}

export function resetCardTopTearTimeline(): CardTopTearTimeline {
  const next = cloneCardTopTearTimeline(DEFAULT_CARD_TOP_TEAR_TIMELINE);
  saveCardTopTearTimeline(next);
  return next;
}
