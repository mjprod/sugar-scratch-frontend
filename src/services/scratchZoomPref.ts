/**
 * Touch-zoom prefs for scratch cards.
 * Motion defaults off; photo defaults on. Pause menu writes; each card reads its mode.
 */
export type ScratchZoomMode = "motion" | "photo";

const KEYS: Record<ScratchZoomMode, string> = {
  motion: "sugar.v8.scratchZoom.motion.enabled",
  photo: "sugar.v8.scratchZoom.photo.enabled",
};

/** Pre-split shared key — seed new per-mode keys when missing. */
const LEGACY_KEY = "sugar.v8.scratchZoom.enabled";

const DEFAULTS: Record<ScratchZoomMode, boolean> = {
  motion: false,
  photo: true,
};

const cached: Partial<Record<ScratchZoomMode, boolean>> = {};
const listeners = new Set<() => void>();

function readLegacy(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { enabled?: boolean };
    return typeof parsed.enabled === "boolean" ? parsed.enabled : null;
  } catch {
    return null;
  }
}

function read(mode: ScratchZoomMode): boolean {
  if (typeof window === "undefined") return DEFAULTS[mode];
  try {
    const raw = localStorage.getItem(KEYS[mode]);
    if (raw) {
      const parsed = JSON.parse(raw) as { enabled?: boolean };
      if (typeof parsed.enabled === "boolean") return parsed.enabled;
    }
    // New key missing → copy the old shared pref once, then use mode default.
    const legacy = readLegacy();
    if (legacy != null) {
      try {
        localStorage.setItem(KEYS[mode], JSON.stringify({ enabled: legacy }));
      } catch {
        /* storage unavailable */
      }
      return legacy;
    }
    return DEFAULTS[mode];
  } catch {
    return DEFAULTS[mode];
  }
}

export function getScratchZoomEnabled(mode: ScratchZoomMode): boolean {
  cached[mode] ??= read(mode);
  return cached[mode]!;
}

/** Self-check only — drop in-memory prefs so the next read hits storage. */
export function resetScratchZoomPrefCache() {
  for (const mode of Object.keys(cached) as ScratchZoomMode[]) {
    delete cached[mode];
  }
}

export function subscribeScratchZoom(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** CSS reads this so a mid-stroke toggle drops the photo scale immediately. */
export function syncScratchZoomDataset(enabled: boolean) {
  if (typeof document === "undefined") return;
  if (enabled) delete document.documentElement.dataset.scratchZoom;
  else document.documentElement.dataset.scratchZoom = "off";
}

export function setScratchZoomEnabled(mode: ScratchZoomMode, enabled: boolean) {
  if (getScratchZoomEnabled(mode) === enabled) return;
  cached[mode] = enabled;
  // Photo stage CSS keys off the document dataset; motion uses JS checks only.
  if (mode === "photo") syncScratchZoomDataset(enabled);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEYS[mode], JSON.stringify({ enabled }));
    } catch {
      /* storage unavailable */
    }
  }
  for (const listener of [...listeners]) listener();
}

// Apply photo CSS before the first scratch stage paints.
if (typeof document !== "undefined") {
  syncScratchZoomDataset(getScratchZoomEnabled("photo"));
}
