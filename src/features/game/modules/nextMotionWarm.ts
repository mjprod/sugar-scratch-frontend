/**
 * Park two off-React videos so /game/win can decode the next card the same
 * way no-match does (loadVideoSrc, stay paused) without keeping WebGL alive.
 *
 * data-memory-keep skips purgeRouteMemory / GameWinPage's second detach pass.
 * Scratch adopts the nodes on remount instead of decoding twice.
 */
import { loadVideoSrc } from "../shared/media";

export const MOTION_WARM_KEEP = "1";

export type WarmedMotionVideos = {
  bottom: HTMLVideoElement;
  foreground: HTMLVideoElement;
};

type Parked = {
  cardId: string | null;
  available: boolean;
  bottom: HTMLVideoElement | null;
  foreground: HTMLVideoElement | null;
};

const parked: Parked = {
  cardId: null,
  available: false,
  bottom: null,
  foreground: null,
};

export function warmedSrcMatches(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  if (actual === expected) return true;
  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "https://local.test/";
    return new URL(actual, base).href === new URL(expected, base).href;
  } catch {
    return false;
  }
}

export function warmedPairMatches(
  pair: { cardId: string; bottomSrc: string; foregroundSrc: string } | null,
  cardId: string,
  bottomUrl: string,
  foregroundUrl: string,
): boolean {
  if (!pair) return false;
  return (
    pair.cardId === cardId &&
    warmedSrcMatches(pair.bottomSrc, bottomUrl) &&
    warmedSrcMatches(pair.foregroundSrc, foregroundUrl)
  );
}

function currentSrc(video: HTMLVideoElement): string {
  return video.currentSrc || video.src || "";
}

function parkStyle(el: HTMLVideoElement): void {
  el.muted = true;
  el.defaultMuted = true;
  el.setAttribute("muted", "");
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.preload = "auto";
  el.loop = true;
  el.autoplay = false;
  el.dataset.memoryKeep = MOTION_WARM_KEEP;
  el.setAttribute("data-memory-keep", MOTION_WARM_KEEP);
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
}

function ensureVideo(slot: "bottom" | "foreground"): HTMLVideoElement | null {
  if (typeof document === "undefined") return null;
  let el = parked[slot];
  if (!el) {
    el = document.createElement("video");
    parkStyle(el);
    parked[slot] = el;
  }
  if (!el.isConnected) {
    parkStyle(el);
    document.body.appendChild(el);
  }
  return el;
}

export async function warmNextMotionCard(card: {
  id: string;
  bottom: string;
  foreground: string;
}): Promise<void> {
  const bottom = ensureVideo("bottom");
  const foreground = ensureVideo("foreground");
  if (!bottom || !foreground) return;
  parked.cardId = card.id;
  parked.available = true;
  try {
    await Promise.all([
      loadVideoSrc(bottom, card.bottom),
      loadVideoSrc(foreground, card.foreground),
    ]);
    try {
      bottom.pause();
      foreground.pause();
    } catch {
      // Stay paused — same as no-match warmup until the next hunt starts.
    }
    parked.available = true;
  } catch {
    parked.available = false;
    parked.cardId = null;
  }
}

export function takeWarmedMotionVideos(
  cardId: string,
  bottomUrl: string,
  foregroundUrl: string,
): WarmedMotionVideos | null {
  const bottom = parked.bottom;
  const foreground = parked.foreground;
  if (!bottom || !foreground) return null;
  if (
    !warmedPairMatches(
      {
        cardId: parked.cardId ?? "",
        bottomSrc: currentSrc(bottom),
        foregroundSrc: currentSrc(foreground),
      },
      cardId,
      bottomUrl,
      foregroundUrl,
    )
  ) {
    return null;
  }
  parked.available = false;
  return { bottom, foreground };
}

export function adoptWarmedMotionVideo(
  slot: HTMLVideoElement,
  warmed: HTMLVideoElement,
): HTMLVideoElement {
  if (slot === warmed) return warmed;
  const parent = slot.parentElement;
  warmed.className = slot.className || "source-video";
  warmed.muted = true;
  warmed.defaultMuted = true;
  warmed.setAttribute("muted", "");
  warmed.playsInline = true;
  warmed.setAttribute("playsinline", "");
  warmed.setAttribute("webkit-playsinline", "");
  warmed.loop = true;
  warmed.autoplay = true;
  warmed.preload = "auto";
  warmed.style.cssText = "";
  if (parent && warmed.parentElement !== parent) {
    parent.insertBefore(warmed, slot);
  }
  slot.style.display = "none";
  try {
    slot.pause();
    slot.removeAttribute("src");
    slot.src = "";
    slot.load();
  } catch {
    // Unused React video must not keep a fourth iOS decoder.
  }
  return warmed;
}

export function releaseWarmedMotionVideos(): void {
  parked.available = false;
  parked.cardId = null;
  for (const el of [parked.bottom, parked.foreground]) {
    if (!el) continue;
    try {
      el.pause();
    } catch {
      // ignore
    }
    try {
      el.removeAttribute("src");
      el.src = "";
      el.load();
    } catch {
      // ignore
    }
  }
}
