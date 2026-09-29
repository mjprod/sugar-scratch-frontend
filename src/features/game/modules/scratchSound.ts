/**
 * Scratch SFX — one scratch clip at a time while the finger is scratching.
 *
 * A stroke opens on a short clip; if the finger keeps scratching past the end
 * of that clip, the next one comes from the medium tier, then long. Lifting,
 * holding still, or sliding off the garment fades the clip out, so a quick
 * flick only plays its first beat. Gated by game soundEffect prefs.
 *
 * Clips carry up to 2s of trailing silence, so chaining is timed off each
 * clip's audible end (measured at decode) rather than the file end.
 */

import { effectiveSoundEffect } from "@/services/gameAudioPrefs";
import {
  gameAudioStartTime,
  getGameAudioContext,
  getGameAudioOutput,
} from "../shared/gameAudioContext";
import { soundMixOutput } from "../shared/soundMix";

/**
 * Must not start with "/scratch" (or any other prefix in the vite.config proxy
 * list) — the dev proxy matches by string prefix and would forward these to
 * the media origin, which answers with its SPA HTML.
 */
export const SCRATCH_SOUND_TIERS = {
  short: [
    "/sfx/scratch/scratch_short_sound_1.mp3",
    "/sfx/scratch/scratch_short_sound_2.mp3",
    "/sfx/scratch/scratch_short_sound_3.mp3",
  ],
  medium: [
    "/sfx/scratch/scratch_medium_sound_1.mp3",
    "/sfx/scratch/scratch_medium_sound_2.mp3",
  ],
  long: [
    "/sfx/scratch/scratch_long_sound_1.mp3",
    "/sfx/scratch/scratch_long_sound_2.mp3",
  ],
} as const;

export type ScratchSoundTier = keyof typeof SCRATCH_SOUND_TIERS;

/** Continuous scratching time before the next chained clip is medium / long. */
export const SCRATCH_SOUND_MEDIUM_AFTER_MS = 1000;
export const SCRATCH_SOUND_LONG_AFTER_MS = 2800;
/** No scratch stamp for this long (finger still or off-garment) → fade out. */
const SCRATCH_SOUND_IDLE_MS = 140;
const SCRATCH_SOUND_FADE_OUT_S = 0.08;
/** Next clip starts this far before the current one's audible tail ends. */
const SCRATCH_SOUND_CHAIN_OVERLAP_S = 0.06;
const SCRATCH_SOUND_VOLUME = 0.9;
/** ± playback-rate spread so repeated clips don't sound identical. */
const SCRATCH_SOUND_RATE_JITTER = 0.06;
/** ~-40 dBFS; samples below this count as trailing silence. */
const SCRATCH_SOUND_SILENCE_LEVEL = 0.01;

const ALL_SCRATCH_SOUND_SRCS: readonly string[] = Object.values(
  SCRATCH_SOUND_TIERS,
).flat();

type Clip = { buffer: AudioBuffer; audibleEnd: number };
type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Context time at which the next clip should take over. */
  chainAt: number;
};

const pendingClips = new Map<string, Promise<Clip | null>>();
const readyClips = new Map<string, Clip>();
const liveVoices = new Set<Voice>();
let currentVoice: Voice | null = null;
let strokeStartMs: number | null = null;
let lastSrc: string | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

export function scratchSoundTier(activeMs: number): ScratchSoundTier {
  if (activeMs >= SCRATCH_SOUND_LONG_AFTER_MS) return "long";
  if (activeMs >= SCRATCH_SOUND_MEDIUM_AFTER_MS) return "medium";
  return "short";
}

function audibleEnd(buffer: AudioBuffer): number {
  let last = 0;
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = data.length - 1; i > last; i -= 1) {
      if (Math.abs(data[i]) > SCRATCH_SOUND_SILENCE_LEVEL) {
        last = i;
        break;
      }
    }
  }
  return last > 0 ? (last + 1) / buffer.sampleRate : buffer.duration;
}

function loadClip(ctx: AudioContext, src: string): Promise<Clip | null> {
  const pending = pendingClips.get(src);
  if (pending) return pending;
  const next = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${src}`);
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      const clip = { buffer, audibleEnd: audibleEnd(buffer) };
      readyClips.set(src, clip);
      return clip;
    })
    .catch(() => {
      // Let a later preload retry (offline blip, decode race on iOS).
      pendingClips.delete(src);
      return null;
    });
  pendingClips.set(src, next);
  return next;
}

/** Fetch + decode every scratch clip. Call from a user gesture. */
export function preloadScratchSounds(): void {
  if (typeof fetch === "undefined") return;
  const ctx = getGameAudioContext();
  if (!ctx) return;
  for (const src of ALL_SCRATCH_SOUND_SRCS) void loadClip(ctx, src);
}

function pickClip(tier: ScratchSoundTier): { src: string; clip: Clip } | null {
  const tierSrcs: readonly string[] = SCRATCH_SOUND_TIERS[tier];
  const ready = tierSrcs.filter((src) => readyClips.has(src));
  // Tier still decoding on a cold start — any ready clip beats silence.
  const pool = ready.length
    ? ready
    : ALL_SCRATCH_SOUND_SRCS.filter((src) => readyClips.has(src));
  if (!pool.length) return null;
  const fresh = pool.length > 1 ? pool.filter((src) => src !== lastSrc) : pool;
  const src = fresh[Math.floor(Math.random() * fresh.length)]!;
  return { src, clip: readyClips.get(src)! };
}

function startVoice(ctx: AudioContext, clip: Clip) {
  const source = ctx.createBufferSource();
  source.buffer = clip.buffer;
  const rate = 1 + (Math.random() * 2 - 1) * SCRATCH_SOUND_RATE_JITTER;
  source.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = SCRATCH_SOUND_VOLUME;
  source.connect(gain);
  gain.connect(soundMixOutput("scratch") ?? getGameAudioOutput(ctx));
  const startAt = gameAudioStartTime(ctx);
  const voice: Voice = {
    source,
    gain,
    chainAt: startAt + clip.audibleEnd / rate - SCRATCH_SOUND_CHAIN_OVERLAP_S,
  };
  source.onended = () => {
    liveVoices.delete(voice);
    if (currentVoice === voice) currentVoice = null;
    source.disconnect();
    gain.disconnect();
  };
  liveVoices.add(voice);
  currentVoice = voice;
  source.start(startAt);
}

function clearIdleTimer() {
  if (idleTimer === null) return;
  clearTimeout(idleTimer);
  idleTimer = null;
}

/**
 * Fade out every scratch clip and end the stroke. Use on pointer up / cancel,
 * on mute, and on unmount.
 */
export function stopScratchSounds(): void {
  clearIdleTimer();
  strokeStartMs = null;
  currentVoice = null;
  if (!liveVoices.size) return;
  const ctx = getGameAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const voice of liveVoices) {
    const param = voice.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(0, now + SCRATCH_SOUND_FADE_OUT_S);
    try {
      voice.source.stop(now + SCRATCH_SOUND_FADE_OUT_S);
    } catch {
      // Older Safari throws on a second stop(); the fade already silenced it.
    }
  }
}

/**
 * Call whenever a manual scratch stamp lands on the garment. Keeps a clip
 * playing while the finger scratches and chains the next tier when it ends.
 */
export function noteScratchSoundActivity(
  nowMs: number = performance.now(),
): void {
  if (!effectiveSoundEffect()) {
    stopScratchSounds();
    return;
  }
  const ctx = getGameAudioContext();
  // Scheduling on a suspended context would burst out on resume.
  if (!ctx || ctx.state !== "running") return;

  strokeStartMs ??= nowMs;
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    stopScratchSounds();
  }, SCRATCH_SOUND_IDLE_MS);

  if (currentVoice && ctx.currentTime < currentVoice.chainAt) return;
  const picked = pickClip(scratchSoundTier(nowMs - strokeStartMs));
  if (!picked) {
    preloadScratchSounds();
    return;
  }
  lastSrc = picked.src;
  startVoice(ctx, picked.clip);
}
