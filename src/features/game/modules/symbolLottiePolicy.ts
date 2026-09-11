/**
 * DotLottie / symbol-worker quieting + preload (Phase 7).
 * Safari timelines showed thousands of worker `message` events and mid-game
 * `.lottie` fetches during scratch.
 */

export function shouldPreferStaticSymbolLottie(opts: {
  coarsePointer: boolean;
}): boolean {
  return opts.coarsePointer;
}

/**
 * Freeze workers while the player is actively scratching the garment, and on
 * coarse pointers keep icons static (first frame) even outside a stroke.
 */
export function shouldFreezeSymbolLottie(opts: {
  basePaused: boolean;
  coarsePointer: boolean;
  isScratching: boolean;
}): boolean {
  if (opts.basePaused) return true;
  if (opts.coarsePointer) return true;
  if (opts.isScratching) return true;
  return false;
}

/** Fetch symbol (and related) lottie URLs into HTTP cache before Tap to play. */
export async function preloadLottieUrls(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter((u) => typeof u === "string" && u))];
  await Promise.all(
    unique.map(async (url) => {
      try {
        const absolute =
          typeof window !== "undefined"
            ? new URL(url, window.location.href).href
            : url;
        const res = await fetch(absolute, { credentials: "same-origin" });
        if (!res.ok) return;
        await res.arrayBuffer();
      } catch {
        // Best-effort — missing assets must not block play.
      }
    }),
  );
}
