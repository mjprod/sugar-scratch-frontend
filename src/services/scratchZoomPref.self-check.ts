/**
 * Touch-zoom pref: motion off / photo on by default, persists, notifies once.
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

assert(getScratchZoomEnabled("motion") === false, "motion zoom defaults off");
assert(getScratchZoomEnabled("photo") === true, "photo zoom defaults on");

let notifies = 0;
const unsub = subscribeScratchZoom(() => {
  notifies += 1;
});
setScratchZoomEnabled("motion", true);
assert(notifies === 1, "enabling motion notifies once");
assert(getScratchZoomEnabled("motion") === true, "motion enable sticks");
assert(
  local.get("sugar.v8.scratchZoom.motion.enabled") ===
    JSON.stringify({ enabled: true }),
  "motion enable persists",
);
assert(getScratchZoomEnabled("photo") === true, "photo unchanged when motion toggled");
setScratchZoomEnabled("motion", true);
assert(notifies === 1, "same value is a no-op");
setScratchZoomEnabled("photo", false);
assert(notifies === 2, "disabling photo notifies");
assert(getScratchZoomEnabled("photo") === false, "photo disable sticks");
assert(getScratchZoomEnabled("motion") === true, "motion unchanged when photo toggled");
setScratchZoomEnabled("motion", false);
assert(getScratchZoomEnabled("motion") === false, "motion disable sticks");
unsub();
console.log("scratchZoomPref self-check ok");
