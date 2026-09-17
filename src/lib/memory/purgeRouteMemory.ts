import {
  clearVideoTextureCache,
  getVideoTextureCacheStats,
  pauseAllVideoTextures,
  type VideoTextureCacheStats,
} from "@/lib/pack3d/videoTextureCache";
import { releaseMediaElement } from "@/features/game/shared/media";
import { armLoseGlContextOnUnmount } from "@/lib/memory/glContextLeave";
import type { RouteMemoryDomain } from "@/lib/memory/routeMemoryDomain";

export type PurgeRouteMemoryInput = {
  from: RouteMemoryDomain;
  to: RouteMemoryDomain;
  /**
   * When true (default), best-effort unload of document video nodes.
   * Set false on the post-navigation safety-net path — the new page may
   * already have mounted media we must not tear down.
   */
  detachDom?: boolean;
};

export type PurgeRouteMemoryResult = {
  before: VideoTextureCacheStats;
  after: VideoTextureCacheStats;
  clearedPackCache: boolean;
  orphanVideos: number;
};

/**
 * Best-effort unload of video nodes still in the document. Safe while the
 * black veil is up; consumers unmounting next tick tolerate missing src.
 * Skips elements marked data-memory-keep="1".
 */
export function detachOrphanMedia(): number {
  if (typeof document === "undefined") return 0;
  let n = 0;
  const videos = document.querySelectorAll("video");
  for (const video of videos) {
    if (video.dataset.memoryKeep === "1") continue;
    releaseMediaElement(video);
    n += 1;
  }
  return n;
}

/**
 * Domain-aware memory purge. Call only while the black veil is fully opaque
 * (and ideally before navigate tears down the old tree).
 */
export function purgeRouteMemory(
  input: PurgeRouteMemoryInput,
): PurgeRouteMemoryResult {
  const { from, to } = input;
  const before = getVideoTextureCacheStats();

  // 1) Stop pack-face decoders immediately (still frames kept until clear).
  pauseAllVideoTextures();

  // 2) Hard-clear shared pack video cache when leaving packs or destination
  //    isn't packs — biggest shared holder for home/coverflow.
  let clearedPackCache = false;
  if (from === "packs" || to !== "packs") {
    clearVideoTextureCache();
    clearedPackCache = true;
  }

  // 3) DOM video stragglers still under the old tree (pre-navigate only).
  const orphanVideos =
    input.detachDom === false ? 0 : detachOrphanMedia();

  // 4) Real leave from game → allow loseContext on next scratch dispose.
  if (from === "game" && to !== "game") {
    armLoseGlContextOnUnmount();
  }

  const after = getVideoTextureCacheStats();

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[memory] purge", {
      from,
      to,
      before,
      after,
      clearedPackCache,
      orphanVideos,
    });
  }

  return { before, after, clearedPackCache, orphanVideos };
}
