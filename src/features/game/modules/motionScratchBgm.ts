/**
 * Looped ambient MP3 during motion scratch.
 * Gated by backgroundMusic prefs — the stage mute button toggles that flag.
 *
 * Web Audio buffer looping (gapless). Option 1 mix:
 * - foil / center bar: quiet bed
 * - after dock settles: full level
 * - hand end: fade out
 */

import {
  getGameAudioPrefs,
  subscribeGameAudioPrefs,
} from "@/services/gameAudioPrefs";

/** Local public/ path (not under Vite media proxy routes like /sounds). */
export const MOTION_SCRATCH_BGM_SRC = "/bgm/magnific-nuestra-madre_01.mp3";

/** Quiet bed under foil scratch (linear gain 0–1). */
export const MOTION_SCRATCH_BGM_BED_GAIN = 0.22;
/** Full hunt level after the bar docks. */
export const MOTION_SCRATCH_BGM_FULL_GAIN = 1;

/** Ease into the foil bed. */
export const MOTION_SCRATCH_BGM_FADE_IN_MS = 240;
/** Bed → full after dock. */
export const MOTION_SCRATCH_BGM_BED_TO_FULL_MS = 320;
/** Ease-out when the hand resolves / stage leaves. */
export const MOTION_SCRATCH_BGM_FADE_OUT_MS = 560;

type WebkitAudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

export type MotionScratchBgmOptions = {
  /** Target linear gain while active (default full). */
  targetGain?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
};

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let bufferPromise: Promise<AudioBuffer | null> | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
/** Wall-clock when the current source started (ctx time). */
let sourceStartedAt = 0;
/** Offset into the buffer when the current source started. */
let sourceOffset = 0;
/** True while the stage wants the loop running. */
let desiredPlaying = false;
/** Last requested audible level while desiredPlaying. */
let desiredGain = MOTION_SCRATCH_BGM_FULL_GAIN;
/** Bumps on every sync so an older unmute's await can't restart after mute. */
let syncGeneration = 0;
let fadeStopTimer: number | null = null;
let prefsUnsub: (() => void) | null = null;

function soundUrl(src: string) {
  if (typeof document === "undefined") return src;
  return new URL(src, document.location.href).href;
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtor =
      window.AudioContext ??
      (window as WebkitAudioWindow).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
  }
  return ctx;
}

function bgmAllowed() {
  return getGameAudioPrefs().backgroundMusic;
}

function ensurePrefsSubscription() {
  if (prefsUnsub || typeof window === "undefined") return;
  // Mute / settings writes are synchronous — resume() must stay in that click
  // so Safari treats it as a user gesture.
  prefsUnsub = subscribeGameAudioPrefs(() => {
    syncMotionScratchBgm();
  });
}

function clearFadeStopTimer() {
  if (fadeStopTimer == null) return;
  window.clearTimeout(fadeStopTimer);
  fadeStopTimer = null;
}

function clampGain(value: number) {
  if (!Number.isFinite(value)) return MOTION_SCRATCH_BGM_FULL_GAIN;
  return Math.max(0, Math.min(1, value));
}

async function ensureBuffer(): Promise<AudioBuffer | null> {
  if (buffer) return buffer;
  if (!bufferPromise) {
    bufferPromise = (async () => {
      const audioCtx = getContext();
      if (!audioCtx) return null;
      try {
        const res = await fetch(soundUrl(MOTION_SCRATCH_BGM_SRC));
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        // copy before decode — some engines detach the buffer
        const copy = data.slice(0);
        return await audioCtx.decodeAudioData(copy);
      } catch {
        return null;
      }
    })().then((decoded) => {
      buffer = decoded;
      return decoded;
    });
  }
  return bufferPromise;
}

function elapsedOffset(audioCtx: AudioContext): number {
  if (!source || !buffer) return sourceOffset;
  const elapsed = Math.max(0, audioCtx.currentTime - sourceStartedAt);
  const dur = buffer.duration;
  if (dur <= 0) return 0;
  return (sourceOffset + elapsed) % dur;
}

function stopSource(keepOffset: boolean) {
  clearFadeStopTimer();
  const audioCtx = ctx;
  if (source && audioCtx && keepOffset && buffer) {
    sourceOffset = elapsedOffset(audioCtx);
  }
  if (!keepOffset) sourceOffset = 0;
  if (source) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      // already stopped
    }
    try {
      source.disconnect();
    } catch {
      // ignore
    }
    source = null;
  }
}

function ensureGain(audioCtx: AudioContext): GainNode {
  if (!gain) {
    gain = audioCtx.createGain();
    gain.gain.value = 0;
    gain.connect(audioCtx.destination);
  }
  return gain;
}

/** Cancel pending ramps and snap/ramp gain. */
function rampGain(to: number, fadeMs: number) {
  const audioCtx = ctx;
  if (!audioCtx || !gain) return;
  const now = audioCtx.currentTime;
  const param = gain.gain;
  param.cancelScheduledValues(now);
  const target = clampGain(to);
  if (fadeMs <= 0) {
    param.setValueAtTime(target, now);
    return;
  }
  const current = Math.max(param.value, 0.0001);
  param.setValueAtTime(current, now);
  const end = now + fadeMs / 1000;
  if (target <= 0) {
    param.exponentialRampToValueAtTime(0.0001, end);
    param.setValueAtTime(0, end);
  } else {
    // exponentialRamp can't start at 0 — nudge up first.
    if (param.value < 0.0001) param.setValueAtTime(0.0001, now);
    param.exponentialRampToValueAtTime(Math.max(0.0001, target), end);
  }
}

function startSourceAt(
  audioCtx: AudioContext,
  buf: AudioBuffer,
  target: number,
  fadeInMs: number,
) {
  stopSource(true);
  const g = ensureGain(audioCtx);
  g.gain.value = 0;
  const next = audioCtx.createBufferSource();
  next.buffer = buf;
  next.loop = true;
  // Full-buffer loop is gapless with decoded PCM (unlike HTMLAudio MP3 loop).
  next.loopStart = 0;
  next.loopEnd = buf.duration;
  next.connect(g);
  const offset = buf.duration > 0 ? sourceOffset % buf.duration : 0;
  sourceOffset = offset;
  sourceStartedAt = audioCtx.currentTime;
  next.start(0, offset);
  source = next;
  rampGain(target, fadeInMs);
}

/**
 * Apply desired + mute state.
 * - Active + unmuted: ensure playing at desiredGain.
 * - Muted mid-loop: pause (keep position) with a short fade.
 * - Stage off: fade out, then rewind.
 */
export function syncMotionScratchBgm(options?: MotionScratchBgmOptions): void {
  if (options?.targetGain != null) {
    desiredGain = clampGain(options.targetGain);
  }
  const fadeInMs = options?.fadeInMs ?? MOTION_SCRATCH_BGM_FADE_IN_MS;
  const fadeOutMs = options?.fadeOutMs ?? MOTION_SCRATCH_BGM_FADE_OUT_MS;
  const audioCtx = getContext();
  if (!audioCtx) return;

  if (desiredPlaying && bgmAllowed()) {
    const gen = ++syncGeneration;
    const target = desiredGain;
    clearFadeStopTimer();
    void (async () => {
      const buf = await ensureBuffer();
      if (gen !== syncGeneration || !buf || !desiredPlaying || !bgmAllowed()) {
        return;
      }
      // resume() must run from the mute-button / scratch gesture when possible.
      if (audioCtx.state === "suspended") {
        try {
          await audioCtx.resume();
        } catch {
          return;
        }
      }
      if (gen !== syncGeneration || !desiredPlaying || !bgmAllowed()) return;
      if (!source) {
        startSourceAt(audioCtx, buf, target, fadeInMs);
      } else {
        // Already looping — ramp level (bed ↔ full, or unmute restore).
        rampGain(target, fadeInMs);
      }
    })();
    return;
  }

  syncGeneration += 1;
  // Muted but still on stage: freeze position after fade. Left stage: rewind.
  const keepOffset = desiredPlaying;
  if (source && gain && fadeOutMs > 0) {
    rampGain(0, fadeOutMs);
    clearFadeStopTimer();
    fadeStopTimer = window.setTimeout(() => {
      fadeStopTimer = null;
      stopSource(keepOffset);
      if (gain) gain.gain.value = 0;
    }, fadeOutMs + 24);
    return;
  }
  stopSource(keepOffset);
  if (gain) gain.gain.value = 0;
}

/** Arm or disarm the loop; optional targetGain for bed vs full. */
export function setMotionScratchBgmActive(
  active: boolean,
  options?: MotionScratchBgmOptions,
): void {
  ensurePrefsSubscription();
  desiredPlaying = active;
  if (options?.targetGain != null) {
    desiredGain = clampGain(options.targetGain);
  } else if (active && options?.targetGain == null && desiredGain <= 0) {
    desiredGain = MOTION_SCRATCH_BGM_FULL_GAIN;
  }
  if (active) preloadMotionScratchBgm();
  syncMotionScratchBgm(options);
}

/** Convenience: foil bed level. */
export function setMotionScratchBgmBed(options?: MotionScratchBgmOptions): void {
  setMotionScratchBgmActive(true, {
    fadeInMs: MOTION_SCRATCH_BGM_FADE_IN_MS,
    ...options,
    targetGain: options?.targetGain ?? MOTION_SCRATCH_BGM_BED_GAIN,
  });
}

/** Convenience: full hunt level. */
export function setMotionScratchBgmFull(options?: MotionScratchBgmOptions): void {
  setMotionScratchBgmActive(true, {
    fadeInMs: MOTION_SCRATCH_BGM_BED_TO_FULL_MS,
    ...options,
    targetGain: options?.targetGain ?? MOTION_SCRATCH_BGM_FULL_GAIN,
  });
}

export function stopMotionScratchBgm(options?: MotionScratchBgmOptions): void {
  setMotionScratchBgmActive(false, options);
}

export function preloadMotionScratchBgm(): void {
  getContext();
  void ensureBuffer();
}

/** True while the buffer source is actually outputting. */
export function isMotionScratchBgmPlaying(): boolean {
  return Boolean(
    desiredPlaying &&
      bgmAllowed() &&
      source &&
      ctx &&
      ctx.state === "running",
  );
}
