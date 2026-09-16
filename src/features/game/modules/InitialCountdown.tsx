import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";
import { lottieRenderConfig } from "@/utils/lottieRender";

/** Match `.top-symbol-bar` dock fly animation in styles.css. */
export const TOP_BAR_DOCK_MS = 720;
/** Later cards in a hand — shorter dock before body scratch unlocks. */
export const TOP_BAR_DOCK_NEXT_CARD_MS = 220;

export const INITIAL_COUNTDOWN_SRC = "/lotties/lottieInitialCountdown.json";
export const INITIAL_COUNTDOWN_SOUND_SRC = "/sounds/321_go_countdown.mp3";

/** Animation length: 339 frames @ 60fps (+ small buffer for decode). */
export const INITIAL_COUNTDOWN_MS = Math.ceil((339 / 60) * 1000) + 250;

/** Intrinsic draw size for the countdown canvas (matches CSS max). Explicit
 * attributes matter more than CSS alone — without them the player can leave a
 * blank bitmap even when the wrapper is sized. */
const COUNTDOWN_SIZE_PX = 260;

const FALLBACK_LABELS = ["3", "2", "1", "GO"] as const;

type WebkitAudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

let countdownCtx: AudioContext | null = null;
let countdownBuffer: AudioBuffer | null = null;
let countdownBufferPromise: Promise<AudioBuffer | null> | null = null;
let countdownSource: AudioBufferSourceNode | null = null;
let countdownHtmlAudio: HTMLAudioElement | null = null;
/** Bumped per sound-effect mount so StrictMode cleanup doesn't kill the remount play. */
let countdownPlaySession = 0;
/** True after a user gesture unlocked audio this page lifetime (cleared on refresh). */
let countdownSoundUnlocked = false;
/**
 * Visual countdown still running — audio may be stopped by mute, but unmute
 * must be able to resume from elapsed time inside the click gesture.
 */
let countdownSessionActive = false;
let countdownSessionStartedAt = 0;
/**
 * Invalidates in-flight playCountdownSound awaits so a later mute cannot be
 * undone when an earlier unmute's async play() finally resolves.
 */
let countdownAudioGeneration = 0;

export function isCountdownSoundUnlocked() {
  return countdownSoundUnlocked;
}

export function isCountdownAudioSessionActive() {
  return countdownSessionActive;
}

/** True while 3-2-1 SFX is actually coming out of the speakers. */
export function isCountdownAudioPlaying() {
  if (countdownSource) return true;
  const html = countdownHtmlAudio;
  return Boolean(html && !html.paused && !html.ended);
}

function countdownSoundUrl() {
  return new URL(INITIAL_COUNTDOWN_SOUND_SRC, document.location.href).href;
}

function getCountdownContext() {
  if (typeof window === "undefined") return null;
  if (!countdownCtx) {
    const AudioCtor =
      window.AudioContext ??
      (window as WebkitAudioWindow).webkitAudioContext;
    if (!AudioCtor) return null;
    countdownCtx = new AudioCtor();
  }
  return countdownCtx;
}

function getCountdownHtmlAudio() {
  if (typeof window === "undefined") return null;
  if (!countdownHtmlAudio) {
    const audio = new Audio(countdownSoundUrl());
    audio.preload = "auto";
    audio.muted = false;
    audio.volume = 1;
    // Keep a live element in the document — iOS Safari is more willing to
    // replay this later than a detached `new Audio()`.
    audio.setAttribute("playsinline", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);
    countdownHtmlAudio = audio;
  }
  return countdownHtmlAudio;
}

async function ensureCountdownBuffer() {
  if (countdownBuffer) return countdownBuffer;
  if (!countdownBufferPromise) {
    countdownBufferPromise = (async () => {
      const ctx = getCountdownContext();
      if (!ctx) return null;
      try {
        const response = await fetch(countdownSoundUrl());
        if (!response.ok) return null;
        const raw = await response.arrayBuffer();
        // decodeAudioData detaches the buffer; pass a copy for Safari.
        countdownBuffer = await ctx.decodeAudioData(raw.slice(0));
        return countdownBuffer;
      } catch {
        return null;
      }
    })();
  }
  return countdownBufferPromise;
}

function stopCountdownSources() {
  if (countdownSource) {
    try {
      countdownSource.stop();
    } catch {
      // already stopped
    }
    try {
      countdownSource.disconnect();
    } catch {
      // ignore
    }
    countdownSource = null;
  }
  const html = countdownHtmlAudio;
  if (html) {
    html.pause();
    try {
      html.currentTime = 0;
    } catch {
      // ignore
    }
  }
}

/** Stop any in-flight 3-2-1 SFX (Web Audio source and HTMLAudio fallback). */
export function stopCountdownAudio() {
  // Bump first so any awaiting playCountdownSound bails before restarting.
  countdownAudioGeneration += 1;
  stopCountdownSources();
}

/** End the visual countdown session — unmute will no longer resume SFX. */
export function endCountdownAudioSession() {
  countdownSessionActive = false;
  countdownSessionStartedAt = 0;
  stopCountdownAudio();
}

/**
 * Resume 3-2-1 SFX from elapsed visual time. Must run inside a user gesture
 * (mute button unmute) — a useEffect play() is blocked on Safari.
 */
export function resumeCountdownAudioIfActive() {
  if (!countdownSessionActive) return;
  const elapsedSec = Math.max(
    0,
    (performance.now() - countdownSessionStartedAt) / 1000,
  );
  const maxSec = INITIAL_COUNTDOWN_MS / 1000;
  if (elapsedSec >= maxSec - 0.05) return;
  void playCountdownSound(elapsedSec).catch(() => undefined);
}

/**
 * Call synchronously from a user-gesture handler (Play / Continue).
 * Resuming AudioContext inside the gesture is what lets Safari play 3-2-1
 * after in-app navigation. Pair with SPA `navigateTo` (not location.assign).
 */
export function unlockCountdownSound() {
  countdownSoundUnlocked = true;
  const ctx = getCountdownContext();
  if (!ctx) {
    getCountdownHtmlAudio();
    return;
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  // Silent buffer tick — iOS is more likely to keep the context running until
  // the countdown mounts than resume-only.
  try {
    const tick = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = tick;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // ignore
  }
  void ensureCountdownBuffer();
  getCountdownHtmlAudio();
}

/** Start (or restart) the 3-2-1 SFX via Web Audio, with HTMLAudio fallback. */
export async function playCountdownSound(offsetSec = 0) {
  const gen = ++countdownAudioGeneration;
  stopCountdownSources();

  const startAt = Math.max(0, offsetSec);
  if (!countdownSessionActive) {
    countdownSessionActive = true;
    countdownSessionStartedAt = performance.now() - startAt * 1000;
  }

  const ctx = getCountdownContext();
  if (ctx) {
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Still suspended without a gesture — fall through to HTML / reject.
      }
    }
    if (gen !== countdownAudioGeneration) return;
    if (ctx.state === "running") {
      const buffer = await ensureCountdownBuffer();
      if (gen !== countdownAudioGeneration) return;
      if (buffer) {
        if (startAt >= buffer.duration) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        countdownSource = source;
        source.onended = () => {
          if (countdownSource === source) countdownSource = null;
        };
        source.start(0, startAt);
        return;
      }
    }
  }

  if (gen !== countdownAudioGeneration) return;
  const html = getCountdownHtmlAudio();
  if (!html) throw new Error("Countdown audio unavailable");
  html.muted = false;
  html.volume = 1;
  try {
    html.currentTime = startAt;
  } catch {
    // ignore
  }
  await html.play();
  if (gen !== countdownAudioGeneration) {
    stopCountdownSources();
  }
}

type InitialCountdownProps = {
  onComplete: () => void;
  /** When false, only the visual plays (no countdown SFX). Default true. */
  soundEnabled?: boolean;
};

/**
 * 3-2-1-GO overlay. Completion is owned by a fixed timer — DotLottie has
 * emitted spurious early "complete"/"loadError" in the product shell, which
 * skipped the beat. Lottie is visual-only; text steps cover a blank canvas.
 */
export function InitialCountdown({
  onComplete,
  soundEnabled = true,
}: InitialCountdownProps) {
  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const audioStartedRef = useRef(false);
  const countdownSessionRef = useRef(0);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);
  const [lottieFailed, setLottieFailed] = useState(false);
  const [step, setStep] = useState(0);
  const lottieSrc = useMemo(
    () =>
      typeof window === "undefined"
        ? INITIAL_COUNTDOWN_SRC
        : new URL(INITIAL_COUNTDOWN_SRC, window.location.href).href,
    [],
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    endCountdownAudioSession();
    onCompleteRef.current();
  }, []);

  const startCountdownAudioWithVisual = useCallback(() => {
    if (!soundEnabledRef.current || audioStartedRef.current) return;
    // Cold refresh: prefs may be "on" but there is no user gesture yet.
    // Playing here makes the mute icon (still locked) lie — wait for unlock.
    if (!countdownSoundUnlocked) return;
    audioStartedRef.current = true;
    const session = ++countdownPlaySession;
    countdownSessionRef.current = session;
    requestAnimationFrame(() => {
      if (countdownPlaySession !== session) return;
      void playCountdownSound(0).catch(() => undefined);
    });
  }, []);

  // Timer owns completion — do not finish from Lottie events.
  // Arm the audio session with the visual so unmute can resume even when the
  // first autoplay SFX attempt failed (cold refresh, no gesture yet).
  useEffect(() => {
    audioStartedRef.current = false;
    countdownSessionRef.current = 0;
    finishedRef.current = false;
    countdownSessionActive = true;
    countdownSessionStartedAt = performance.now();
    // Prefs can be on after refresh while the mute icon is still locked — do
    // not let a leftover/autoplay SFX run under a muted icon.
    if (!countdownSoundUnlocked) stopCountdownAudio();
    setStep(0);
    const stepMs = Math.floor(INITIAL_COUNTDOWN_MS / FALLBACK_LABELS.length);
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      if (current >= FALLBACK_LABELS.length) {
        window.clearInterval(id);
        finish();
        return;
      }
      setStep(current);
    }, stepMs);
    const safetyId = window.setTimeout(finish, INITIAL_COUNTDOWN_MS + 200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(safetyId);
      const session = countdownSessionRef.current;
      if (session === 0) {
        endCountdownAudioSession();
        return;
      }
      window.setTimeout(() => {
        if (countdownPlaySession === session) endCountdownAudioSession();
      }, 0);
    };
  }, [finish]);

  useEffect(() => {
    if (!dotLottie) return;
    const kick = () => {
      void dotLottie.play();
      startCountdownAudioWithVisual();
    };
    const onLoadError = () => setLottieFailed(true);
    dotLottie.addEventListener("load", kick);
    dotLottie.addEventListener("loadError", onLoadError);
    if (dotLottie.isLoaded) kick();
    return () => {
      dotLottie.removeEventListener("load", kick);
      dotLottie.removeEventListener("loadError", onLoadError);
    };
  }, [dotLottie, startCountdownAudioWithVisual]);

  // Fallback path: audio starts when existing step 0 ("3") is shown.
  useEffect(() => {
    if (!lottieFailed || step !== 0) return;
    startCountdownAudioWithVisual();
  }, [lottieFailed, step, startCountdownAudioWithVisual]);

  // Stage mute mid-countdown: keep the visual, silence the SFX immediately.
  // Unmute resume is handled in the click gesture via resumeCountdownAudioIfActive.
  useEffect(() => {
    if (!soundEnabled) stopCountdownAudio();
  }, [soundEnabled]);

  return (
    <div className="initial-countdown" aria-live="polite" aria-label="Get ready">
      {!lottieFailed ? (
        <DotLottieReact
          src={lottieSrc}
          autoplay
          loop={false}
          width={COUNTDOWN_SIZE_PX}
          height={COUNTDOWN_SIZE_PX}
          className="initial-countdown-lottie"
          style={{ width: COUNTDOWN_SIZE_PX, height: COUNTDOWN_SIZE_PX }}
          renderConfig={lottieRenderConfig()}
          dotLottieRefCallback={setDotLottie}
        />
      ) : (
        <div className="initial-countdown-fallback" aria-hidden="true">
          {FALLBACK_LABELS[step] ?? "GO"}
        </div>
      )}
    </div>
  );
}
