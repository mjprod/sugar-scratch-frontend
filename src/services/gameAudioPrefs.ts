/**
 * Game audio preferences — Sound Effect shares the scratch game storage key;
 * Background Music is a separate preference until BGM is wired app-wide.
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

export function getGameAudioPrefs(): GameAudioPrefs {
  return {
    soundEffect: readBool(SOUND_EFFECT_KEY, true),
    backgroundMusic: readBool(BACKGROUND_MUSIC_KEY, true),
  };
}

export function setSoundEffectEnabled(enabled: boolean) {
  writeBool(SOUND_EFFECT_KEY, enabled);
}

export function setBackgroundMusicEnabled(enabled: boolean) {
  writeBool(BACKGROUND_MUSIC_KEY, enabled);
}
