/**
 * One live media decoder for the tab. iOS keeps a hardware decoder (and its
 * IOSurface) per attached <video src> — overlapping claim+attach is what
 * pins 700MB+ page memory on the home coverflow.
 *
 * Always pause + blank src + load() on the outgoing node before setting a
 * new src. Same-src re-claim is a no-op so a parked overlay can resume.
 */

let claimed: HTMLMediaElement | null = null;

function currentSrc(el: HTMLMediaElement): string {
  return el.getAttribute("src") || el.currentSrc || el.src || "";
}

function sameSrc(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "https://local.test/";
    return new URL(left, base).href === new URL(right, base).href;
  } catch {
    return false;
  }
}

function releaseDecoder(el: HTMLMediaElement): void {
  try {
    el.pause();
  } catch {
    /* ignore */
  }
  try {
    el.removeAttribute("src");
    el.src = "";
    el.load();
  } catch {
    /* ignore */
  }
}

/** Hard-drop whatever is live, then attach `src` on `el`. */
export function claimMediaDecoder(el: HTMLMediaElement, src: string): void {
  if (!src) {
    releaseClaimedDecoder(el);
    return;
  }
  if (claimed && claimed !== el) {
    releaseDecoder(claimed);
    claimed = null;
  }
  if (claimed === el && sameSrc(currentSrc(el), src)) {
    return;
  }
  releaseDecoder(el);
  claimed = el;
  el.src = src;
}

/** Release `el` if given, otherwise the current claim. */
export function releaseClaimedDecoder(el?: HTMLMediaElement | null): void {
  if (el) {
    if (claimed === el) claimed = null;
    releaseDecoder(el);
    return;
  }
  if (!claimed) return;
  const live = claimed;
  claimed = null;
  releaseDecoder(live);
}
