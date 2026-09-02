/**
 * Safari keeps decoder buffers for <video> unless the element is explicitly
 * unloaded. Prefer reusing elements and swapping src via loadVideoSrc — do not
 * remount with a new React key each card.
 */

export type ThemeIntroPlayback = {
  /** Whether the element is muted after the kick attempt. */
  muted: boolean;
  /** False when autoplay failed — caller should dismiss the intro overlay. */
  playing: boolean;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Wait until the element can start playback (or fail / timeout). */
export function waitForVideoCanPlay(
  video: HTMLVideoElement,
  timeoutMs = 8_000,
): Promise<boolean> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
      window.clearTimeout(timeoutId);
      resolve(ok);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(video.readyState >= 2), timeoutMs);

    video.addEventListener("canplay", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);

    // Kick the network if src is set but nothing has started.
    try {
      if (video.src && video.readyState === 0) video.load();
    } catch {
      // ignore
    }

    if (video.readyState >= 2 && video.videoWidth > 0) finish(true);
  });
}

/**
 * Kick a theme-intro clip. Starts muted (allowed without a user gesture on
 * Android/iOS — e.g. F5 / post-fetch mount), then tries to unmute when sound
 * is enabled.
 *
 * Waits for canplay and retries — calling play() at readyState 0 often rejects
 * (AbortError / background-media pause) and must not tear down the overlay.
 */
export async function playThemeIntro(
  video: HTMLVideoElement,
  wantSound: boolean,
): Promise<ThemeIntroPlayback> {
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");

  video.muted = true;
  video.setAttribute("muted", "");

  const ready = await waitForVideoCanPlay(video);
  if (!ready) return { muted: true, playing: false };

  let playing = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      video.muted = true;
      video.setAttribute("muted", "");
      await video.play();
      if (!video.paused) {
        playing = true;
        break;
      }
    } catch {
      // AbortError when decode interrupts play — wait and retry.
    }
    await delay(40 + attempt * 40);
  }

  if (!playing) return { muted: true, playing: false };

  if (!wantSound) return { muted: true, playing: true };

  video.muted = false;
  video.removeAttribute("muted");
  try {
    if (video.paused) await video.play();
  } catch {
    video.muted = true;
    video.setAttribute("muted", "");
    void video.play().catch(() => undefined);
    return { muted: true, playing: !video.paused };
  }

  if (video.paused) {
    video.muted = true;
    video.setAttribute("muted", "");
    void video.play().catch(() => undefined);
    return { muted: true, playing: !video.paused };
  }

  return { muted: video.muted, playing: true };
}

export function releaseMediaElement(el: HTMLMediaElement | null | undefined) {
  if (!el) return;
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

function videoHasFrame(video: HTMLVideoElement): boolean {
  return video.readyState >= 2 && video.videoWidth > 1;
}

function currentVideoSrc(video: HTMLVideoElement): string {
  return video.currentSrc || video.src || "";
}

function sameVideoSrc(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  try {
    return new URL(left, window.location.href).href === new URL(right, window.location.href).href;
  } catch {
    return false;
  }
}

/**
 * Attach `src` without wiping a decoded frame first.
 * Calling load() on an empty src flashes black — reuse the current picture
 * until the next clip has HAVE_CURRENT_DATA.
 */
export function loadVideoSrc(
  video: HTMLVideoElement,
  src: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sameVideoSrc(currentVideoSrc(video), src) && videoHasFrame(video)) {
      resolve();
      return;
    }

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      if (ok) resolve();
      else reject(new Error(`Failed to load video: ${src}`));
    };
    const onReady = () => {
      if (videoHasFrame(video)) finish(true);
    };
    const onError = () => finish(false);

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);
    video.preload = "auto";
    video.src = src;
    // Cached / already-ready.
    if (videoHasFrame(video) && sameVideoSrc(currentVideoSrc(video), src)) {
      finish(true);
    }
  });
}
