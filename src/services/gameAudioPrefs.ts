/**
 * Game audio preferences — Sound Effect shares the scratch game storage key;
 * Background Music is a separate preference until BGM is wired app-wide.
 *
 * This is also the live store for those prefs: the in-game pause modal and the
 * profile settings screen both write here, and the scratch components
 * subscribe, so flipping a switch in one place takes effect in the others
 * without a reload.
 *
 * Listeners run synchronously on write, which matters — a subscriber that
 * needs to unlock an AudioContext has to do it inside the click that flipped
 * the switch, since Safari only allows that from a user gesture.
 */
const SOUND_EFFECT_KEY = "sugar-scratchie:sound";
const BACKGROUND_MUSIC_KEY = "sugar.v8.gameAudio.bgm";

export type GameAudioPrefs = {
  soundEffect: boolean;
  backgroundMusic: boolean;
};

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { enabled?: boolean };
    return typeof parsed.enabled === "boolean" ? parsed.enabled : fallback;
  } catch {
    return fallback;
  }
}

function writeBool(key: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ enabled }));
  } catch {
    /* storage unavailable */
  }
}

let cached: GameAudioPrefs | null = null;
const listeners = new Set<() => void>();

/** Identity is stable between writes, so it is safe to hold as a snapshot. */
export function getGameAudioPrefs(): GameAudioPrefs {
  cached ??= {
    soundEffect: readBool(SOUND_EFFECT_KEY, true),
    backgroundMusic: readBool(BACKGROUND_MUSIC_KEY, true),
  };
  return cached;
}

export function subscribeGameAudioPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(next: GameAudioPrefs) {
  cached = next;
  // Copy first: a listener may unsubscribe while being notified.
  for (const listener of [...listeners]) listener();
}

export function setSoundEffectEnabled(enabled: boolean) {
  const prefs = getGameAudioPrefs();
  if (prefs.soundEffect === enabled) return;
  writeBool(SOUND_EFFECT_KEY, enabled);
  commit({ ...prefs, soundEffect: enabled });
}

export function setBackgroundMusicEnabled(enabled: boolean) {
  const prefs = getGameAudioPrefs();
  if (prefs.backgroundMusic === enabled) return;
  writeBool(BACKGROUND_MUSIC_KEY, enabled);
  commit({ ...prefs, backgroundMusic: enabled });
}
