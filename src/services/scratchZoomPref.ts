/**
 * Touch-zoom prefs for scratch cards.
 * Motion defaults off; photo defaults on. Pause menu writes; each card reads its mode.
 */
export type ScratchZoomMode = "motion" | "photo";

const KEYS: Record<ScratchZoomMode, string> = {
  motion: "sugar.v8.scratchZoom.motion.enabled",
  photo: "sugar.v8.scratchZoom.photo.enabled",
};

const DEFAULTS: Record<ScratchZoomMode, boolean> = {
  motion: false,
  photo: true,
};

const cached: Partial<Record<ScratchZoomMode, boolean>> = {};
const listeners = new Set<() => void>();

function read(mode: ScratchZoomMode): boolean {
  if (typeof window === "undefined") return DEFAULTS[mode];
  try {
    const raw = localStorage.getItem(KEYS[mode]);
    if (!raw) return DEFAULTS[mode];
    const parsed = JSON.parse(raw) as { enabled?: boolean };
    return typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS[mode];
  } catch {
    return DEFAULTS[mode];
  }
}

export function getScratchZoomEnabled(mode: ScratchZoomMode): boolean {
  cached[mode] ??= read(mode);
  return cached[mode]!;
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
