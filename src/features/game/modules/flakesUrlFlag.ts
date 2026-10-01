/**
 * `?flakes=1` / `?flakes=0` URL switch for the colored fabric flakes that fly
 * off scratch points. The game hides the settings panel that owns the
 * "Flying flakes" checkbox, so this is the way to toggle it in `/game`.
 * Applied once at boot and persisted into the auto-scratch settings, so the
 * flag survives in-app navigation (which drops the query string).
 */

export const AUTO_SCRATCH_STORAGE_KEY = "sugar-scratchie:auto-scratch";

const ON_VALUES = new Set(["1", "true", "on"]);
const OFF_VALUES = new Set(["0", "false", "off"]);

/** `true` / `false` when the URL sets the flag, `null` when it doesn't. */
export function parseFlakesUrlFlag(search: string): boolean | null {
  const raw = new URLSearchParams(search).get("flakes");
  if (raw == null) return null;
  const value = raw.trim().toLowerCase();
  if (ON_VALUES.has(value)) return true;
  if (OFF_VALUES.has(value)) return false;
  return null;
}

/** Merges the URL flag into stored auto-scratch settings; returns what was applied. */
export function applyFlakesUrlFlag(
  search: string,
  storage: Pick<Storage, "getItem" | "setItem">,
): boolean | null {
  const flakes = parseFlakesUrlFlag(search);
  if (flakes === null) return null;
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(AUTO_SCRATCH_STORAGE_KEY) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      stored = parsed as Record<string, unknown>;
    }
  } catch {
    stored = {};
  }
  storage.setItem(AUTO_SCRATCH_STORAGE_KEY, JSON.stringify({ ...stored, flakes }));
  return flakes;
}
