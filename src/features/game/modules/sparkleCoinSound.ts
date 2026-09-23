/**
 * Sparkle-coin milestone SFX — one HTMLAudio per band clip.
 * Gated by game soundEffect prefs; restarts the clip on rapid milestones.
 */

import { getGameAudioPrefs } from "@/services/gameAudioPrefs";
import { SPARKLE_COIN_BANDS } from "./sparkleCoinAward";

const audioBySrc = new Map<string, HTMLAudioElement>();

function soundUrl(src: string) {
  if (typeof document === "undefined") return src;
  return new URL(src, document.location.href).href;
}

function getBandAudio(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  let audio = audioBySrc.get(src);
  if (audio) return audio;
  audio = new Audio(soundUrl(src));
  audio.preload = "auto";
  audio.muted = false;
  audio.volume = 1;
  audio.setAttribute("playsinline", "true");
  audio.style.display = "none";
  document.body.appendChild(audio);
  audioBySrc.set(src, audio);
  return audio;
}

/** Warm the three band clips so the first 10% beat isn't silent on cold start. */
export function preloadSparkleCoinSounds() {
  for (const band of SPARKLE_COIN_BANDS) {
    getBandAudio(band.soundSrc);
  }
}

/**
 * Play the MP3 for a sparkle award. No-op when SFX are muted.
 * Restarts the matching element so overlapping milestones don't stack.
 */
export function playSparkleCoinSound(soundSrc: string): void {
  if (!soundSrc) return;
  if (!getGameAudioPrefs().soundEffect) return;
  const audio = getBandAudio(soundSrc);
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay / gesture lock — ignore; next gesture unlocks prefs path.
    });
  } catch {
    // Ignore decode / play races on iOS.
  }
}
