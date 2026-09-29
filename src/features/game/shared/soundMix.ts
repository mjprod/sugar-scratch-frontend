import {
  getGameAudioContext,
  getGameAudioOutput,
} from "./gameAudioContext";

/**
 * Live per-channel volume for the game page. Defaults are the levels the
 * players already shipped with (1 = unchanged). The debug mixer writes here;
 * players multiply their own gain by the channel so a slider moves sounds
 * that are already playing.
 *
 * ponytail: module singleton, not persisted — paste the copied block back to
 * bake a mix into SOUND_MIX_DEFAULTS.
 */

export const SOUND_MIX_CHANNELS = [
  "bgm",
  "scratch",
  "coins",
  "match",
  "symbols",
  "win",
  "lose",
  "countdown",
  "intro",
] as const;

export type SoundMixChannel = (typeof SOUND_MIX_CHANNELS)[number];

export type SoundMix = Record<SoundMixChannel, number>;

/** Shipped levels. 1 = the hardcoded gain each player already used. */
export const SOUND_MIX_DEFAULTS: SoundMix = {
  bgm: 0.15,
  scratch: 0.05,
  coins: 0.15,
  match: 0.1,
  symbols: 1,
  win: 1,
  lose: 1,
  countdown: 0.05,
  intro: 0.75,
};

export const SOUND_MIX_LABELS: Record<SoundMixChannel, string> = {
  bgm: "Background music",
  scratch: "Scratch",
  coins: "Coins",
  match: "Match ding",
  symbols: "Symbol notes",
  win: "Win",
  lose: "Lose",
  countdown: "3-2-1 countdown",
  intro: "Theme intro",
};

const STORAGE_KEY = "sugar.soundMix.debug";

function clampGain(value: number): number {
  return Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : 1;
}

function loadMix(): SoundMix {
  const next = { ...SOUND_MIX_DEFAULTS };
  if (typeof localStorage === "undefined") return next;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as Partial<SoundMix>;
    for (const channel of SOUND_MIX_CHANNELS) {
      if (typeof raw[channel] === "number") next[channel] = clampGain(raw[channel]);
    }
  } catch {
    // missing or corrupt — start from the baked defaults
  }
  return next;
}

const mix: SoundMix = loadMix();
const listeners = new Set<() => void>();
const channelGains = new Map<SoundMixChannel, GainNode>();

/**
 * One gain per channel, kept in sync with the debug panel. One-shots connect
 * here so a tap changes a sound that is already playing — baking the level
 * into an envelope ramp does not.
 */
export function soundMixOutput(channel: SoundMixChannel): AudioNode | null {
  const ctx = getGameAudioContext();
  if (!ctx) return null;
  let node = channelGains.get(channel);
  if (!node) {
    node = ctx.createGain();
    node.connect(getGameAudioOutput(ctx));
    channelGains.set(channel, node);
  }
  node.gain.value = soundMixGain(channel);
  return node;
}

export function getSoundMix(): SoundMix {
  return mix;
}

export function soundMixGain(channel: SoundMixChannel): number {
  return clampGain(mix[channel]);
}

export function setSoundMixGain(channel: SoundMixChannel, gain: number) {
  const next = clampGain(gain);
  if (mix[channel] === next) return;
  mix[channel] = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mix));
  } catch {
    // storage unavailable — the live mix still applies this session
  }
  const node = channelGains.get(channel);
  if (node) node.gain.value = next;
  for (const listener of [...listeners]) listener();
}

/** Drop the debug override and snap every channel back to the baked defaults. */
export function clearSoundMixStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  for (const channel of SOUND_MIX_CHANNELS) {
    mix[channel] = SOUND_MIX_DEFAULTS[channel];
    const node = channelGains.get(channel);
    if (node) node.gain.value = mix[channel];
  }
  for (const listener of [...listeners]) listener();
}

export function subscribeSoundMix(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Block to paste back so the mix can be baked into SOUND_MIX_DEFAULTS. */
export function formatSoundMix(): string {
  const lines = SOUND_MIX_CHANNELS.map(
    (channel) => `  ${channel}: ${Number(mix[channel].toFixed(2))},`,
  );
  return ["sound mix", "{", ...lines, "}"].join("\n");
}
