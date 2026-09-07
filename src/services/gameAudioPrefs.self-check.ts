/**
 * Game audio pref store: seeded reads, stable snapshots, synchronous notify.
 * Run: npx tsx src/services/gameAudioPrefs.self-check.ts
 */
import {
  getGameAudioPrefs,
  setBackgroundMusicEnabled,
  setSoundEffectEnabled,
  subscribeGameAudioPrefs,
} from "./gameAudioPrefs.ts";

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

// Seeded before the first read, since the snapshot is built lazily and cached.
local.set("sugar-scratchie:sound", JSON.stringify({ enabled: false }));

// --- first read: seeded value wins, absent key falls back to on ---
assert(
  getGameAudioPrefs().soundEffect === false,
  "stored sound-effect pref must be honoured on first read",
);
assert(
  getGameAudioPrefs().backgroundMusic === true,
  "background music should default to on when nothing is stored",
);

// --- snapshot identity is stable between writes ---
// Consumers hold this as render state; a fresh object per call would loop.
assert(
  getGameAudioPrefs() === getGameAudioPrefs(),
  "repeated reads must return the same object identity",
);

// --- writes notify synchronously, inside the caller's stack ---
// The scratch components unlock their AudioContext from this callback, and
// Safari only permits that while still inside the user gesture.
let notifications = 0;
let sawValueDuringNotify: boolean | null = null;
const unsubscribe = subscribeGameAudioPrefs(() => {
  notifications += 1;
  sawValueDuringNotify = getGameAudioPrefs().soundEffect;
});

const beforeEnable = getGameAudioPrefs();
setSoundEffectEnabled(true);
assert(
  notifications === 1,
  `write must notify synchronously, exactly once (got ${notifications})`,
);
assert(
  sawValueDuringNotify === true,
  "the new value must already be readable while listeners run",
);
assert(
  getGameAudioPrefs() !== beforeEnable,
  "a write must produce a new snapshot identity",
);
assert(
  local.get("sugar-scratchie:sound") === JSON.stringify({ enabled: true }),
  "the sound-effect pref must be persisted under the scratch game's key",
);

// --- redundant writes are dropped ---
const afterEnable = getGameAudioPrefs();
setSoundEffectEnabled(true);
assert(
  notifications === 1,
  "setting the value it already has must not notify",
);
assert(
  getGameAudioPrefs() === afterEnable,
  "a no-op write must not churn the snapshot identity",
);

// --- the two prefs are independent ---
setBackgroundMusicEnabled(false);
assert(notifications === 2, "a background-music write must notify too");
assert(
  getGameAudioPrefs().backgroundMusic === false,
  "background music must reflect its own write",
);
assert(
  getGameAudioPrefs().soundEffect === true,
  "writing one pref must not disturb the other",
);
assert(
  local.get("sugar.v8.gameAudio.bgm") === JSON.stringify({ enabled: false }),
  "background music must persist under its own key",
);

// --- unsubscribe stops delivery ---
unsubscribe();
setSoundEffectEnabled(false);
assert(notifications === 2, "an unsubscribed listener must not be called");

// --- unsubscribing mid-notify must not skip the remaining listeners ---
let secondRan = false;
const dropSelf = subscribeGameAudioPrefs(() => dropSelf());
subscribeGameAudioPrefs(() => {
  secondRan = true;
});
setSoundEffectEnabled(true);
assert(
  secondRan,
  "a listener that unsubscribes during notify must not cut the loop short",
);

console.log("gameAudioPrefs.self-check: ok");
