import {
  getGameAudioContext,
  getGameAudioOutput,
} from "./gameAudioContext";

/**
 * Per-channel volume for the game page. Players connect through
 * `soundMixOutput` so each channel uses the shipped level below.
 * Live edits via `setSoundMixGain` update connected GainNodes immediately.
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
  bgm: 0.45,
  scratch: 0.4,
  coins: 0.2,
  match: 0.25,
  symbols: 0.3,
  win: 0.15,
  lose: 1,
  countdown: 0.7,
  intro: 1,
};

export const SOUND_MIX_LABELS: Record<SoundMixChannel, string> = {
  bgm: "BGM",
  scratch: "Scratch",
  coins: "Coins",
  match: "Match",
  symbols: "Symbols",
  win: "Win",
  lose: "Lose",
  countdown: "Countdown",
  intro: "Intro",
};

function clampGain(value: number): number {
  return Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : 1;
}

const mix: SoundMix = { ...SOUND_MIX_DEFAULTS };
const channelGains = new Map<SoundMixChannel, GainNode>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of [...listeners]) listener();
}

/**
 * One gain per channel. One-shots connect here so the shipped level applies
 * to a sound that is already playing.
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

export function soundMixGain(channel: SoundMixChannel): number {
  return clampGain(mix[channel]);
}

export function getSoundMix(): SoundMix {
  return { ...mix };
}

export function setSoundMixGain(channel: SoundMixChannel, value: number) {
  const next = clampGain(value);
  if (mix[channel] === next) return;
  mix[channel] = next;
  const node = channelGains.get(channel);
  if (node) node.gain.value = next;
  notify();
}

export function resetSoundMix() {
  let changed = false;
  for (const channel of SOUND_MIX_CHANNELS) {
    const next = SOUND_MIX_DEFAULTS[channel];
    if (mix[channel] === next) continue;
    mix[channel] = next;
    const node = channelGains.get(channel);
    if (node) node.gain.value = next;
    changed = true;
  }
  if (changed) notify();
}

export function subscribeSoundMix(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pasteable report for tuning feedback. */
export function formatSoundMixReport(levels: SoundMix = getSoundMix()): string {
  const lines = [
    "SOUND_MIX_DEFAULTS = {",
    ...SOUND_MIX_CHANNELS.map(
      (channel) => `  ${channel}: ${levels[channel]},`,
    ),
    "};",
    "",
    "JSON:",
    JSON.stringify(levels, null, 2),
  ];
  return lines.join("\n");
}
