/**
 * Touch-zoom pref: default on, persists, notifies once.
 * Run: npx tsx src/services/scratchZoomPref.self-check.ts
 */
import {
  getScratchZoomEnabled,
  setScratchZoomEnabled,
  subscribeScratchZoom,
} from "./scratchZoomPref.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const local = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => void local.set(key, value),
  removeItem: (key: string) => void local.delete(key),
};
(globalThis as { window?: unknown }).window = {
  localStorage: globalThis.localStorage,
};

assert(getScratchZoomEnabled() === true, "zoom defaults on");

let notifies = 0;
const unsub = subscribeScratchZoom(() => {
  notifies += 1;
});
setScratchZoomEnabled(false);
assert(notifies === 1, "disabling notifies once");
assert(getScratchZoomEnabled() === false, "disable sticks");
assert(
  local.get("sugar.v8.scratchZoom.enabled") === JSON.stringify({ enabled: false }),
  "disable persists",
);
setScratchZoomEnabled(false);
assert(notifies === 1, "same value is a no-op");
setScratchZoomEnabled(true);
assert(getScratchZoomEnabled() === true, "re-enable sticks");
unsub();
console.log("scratchZoomPref self-check ok");
