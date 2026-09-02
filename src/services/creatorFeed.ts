/**
 * Creator Home Feed — immersive discovery cards from `/api/models`.
 * Active cards use each model's backend swipe video when present.
 */

import {
  loadModels,
  modelAvatarUrl,
  modelSwipePosterUrl,
  profileFromModel,
  type BackendModel,
} from "./models";
import { isFeedFavourite } from "./feedFavourites";
import { loadPackCatalog, packUnitCost } from "./purchase";

export type HomeFeedCreator = {
  id: string;
  creatorId: string;
  creatorName: string;
  avatarUrl: string;
  /** @deprecated Prefer packName + tags for feed overlay. */
  collectionName: string;
  /** @deprecated Prefer tags for feed overlay. */
  description: string;
  packId: string;
  packName: string;
  /** Up to 3 shown on the feed card — theme / style / availability. */
  tags: string[];
  mediaType: "video" | "image";
  swipePosterUrl: string;
  videoUrl?: string;
  diamondCost: number;
  liked: boolean;
};

export type HomeFeedPage = {
  items: HomeFeedCreator[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function feedPosterUrl(model: BackendModel) {
  return modelSwipePosterUrl(model) ?? modelAvatarUrl(model) ?? "";
}

export function preloadFeedPosters(
  items: Array<{ swipePosterUrl?: string | null }>,
) {
  if (typeof window === "undefined") return;
  const seen = new Set<string>();
  for (const item of items) {
    const src = item.swipePosterUrl?.trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const image = new Image();
    image.decoding = "async";
    image.src = src;
  }
}

function feedItemFromModel(model: BackendModel): Omit<HomeFeedCreator, "liked"> {
  const profile = profileFromModel(model);
  const videoUrl = profile.swipeVideoUrl ?? undefined;
  /** Prefer backend pack title over "{Creator} Collection". */
  const packName =
    model.cardPackName?.trim() ||
    profile.packs[0]?.label?.trim() ||
    profile.collectionLabel;
  return {
    id: `hf-${profile.id}`,
    creatorId: profile.id,
    creatorName: profile.name,
    avatarUrl: modelAvatarUrl(model) ?? "",
    collectionName: packName,
    description: profile.collectionLabel,
    packId: profile.id,
    packName,
    tags: [profile.city, profile.country].filter((tag): tag is string => Boolean(tag)),
    mediaType: videoUrl ? "video" : "image",
    swipePosterUrl: feedPosterUrl(model),
    videoUrl,
    diamondCost: packUnitCost(profile.id),
  };
}

const PAGE_SIZE = 6;
const FEED_CACHE_VERSION = 18;

function shuffleCatalog<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = next[i]!;
    next[i] = next[j]!;
    next[j] = current;
  }
  return next;
}

function uniqueFeedItems(items: Omit<HomeFeedCreator, "liked">[]) {
  const seen = new Set<string>();
  const unique: Omit<HomeFeedCreator, "liked">[] = [];
  for (const item of items) {
    const key = item.videoUrl || `id:${item.creatorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

let shuffledCatalog: Omit<HomeFeedCreator, "liked">[] | null = null;

/** Upcoming clips to mount (poster→video) beyond the active one. */
export const FEED_WARM_AHEAD = 1;
/** Previous clip to keep mounted for a reverse swipe. */
export const FEED_WARM_BEHIND = 1;
/**
 * Max concurrent `preload="auto"` videos (active + peeks).
 * Warm-mounted neighbors beyond this use `metadata` only.
 */
export const FEED_PRELOAD_AUTO_CAP = 2;

export function isWarmFeedIndex(index: number, activeIndex: number) {
  const resolved = activeIndex >= 0 ? activeIndex : 0;
  if (index === resolved) return false;
  return (
    index >= resolved - FEED_WARM_BEHIND &&
    index <= resolved + FEED_WARM_AHEAD
  );
}

/** Active ± warm window — mount/decode only these; far slides stay poster-only. */
export function isFeedMountIndex(index: number, activeIndex: number) {
  const resolved = activeIndex >= 0 ? activeIndex : 0;
  return (
    index >= resolved - FEED_WARM_BEHIND &&
    index <= resolved + FEED_WARM_AHEAD
  );
}

/** Active + limited ahead peeks may fully preload; reverse warm stays metadata. */
export function isFeedPreloadAutoIndex(index: number, activeIndex: number) {
  const resolved = activeIndex >= 0 ? activeIndex : 0;
  if (index === resolved) return true;
  const aheadSlots = Math.max(0, FEED_PRELOAD_AUTO_CAP - 1);
  return index > resolved && index <= resolved + aheadSlots;
}

/** Display-only: drop trailing " Pack" from pack titles on the feed. */
export function feedPackLabel(packName: string) {
  return packName.replace(/\s+Pack$/i, "");
}

/** Cap visible feed tags at 3. */
export function feedVisibleTags(tags: string[] | undefined) {
  if (!tags?.length) return [];
  return tags.slice(0, 3);
}

/**
 * Stable pseudo like-count until a backend counter exists.
 * Current-user like bumps the displayed total by 1.
 */
export function feedLikeCount(creatorId: string, liked: boolean): number {
  const id = creatorId.trim() || "creator";
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const base = 180 + (hash >>> 0) % 12820; // 180–13000
  return base + (liked ? 1 : 0);
}

export function formatFeedLikeCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10_000) {
    const tenths = Math.round(count / 100) / 10;
    return `${tenths}k`.replace(/\.0k$/, "k");
  }
  return `${Math.round(count / 1000)}k`;
}

export async function fetchHomeFeedPage(
  cursor: string | null = null,
): Promise<HomeFeedPage> {
  // Rebuild only on first page / cold cache — later pages slice the in-memory catalog.
  if (cursor == null || !shuffledCatalog) {
    const models = await Promise.all([loadModels(), loadPackCatalog()]).then(
      ([loaded]) => loaded,
    );
    shuffledCatalog = shuffleCatalog(
      uniqueFeedItems(models.map(feedItemFromModel)),
    );
  }
  const catalog = shuffledCatalog;
  const start = cursor ? Number.parseInt(cursor, 10) : 0;
  const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;
  const slice = catalog.slice(safeStart, safeStart + PAGE_SIZE);
  const items: HomeFeedCreator[] = slice.map((seed, i) => {
    const pageIndex = safeStart + i;
    return {
      ...seed,
      id: `${seed.id}__${pageIndex}`,
      liked: isFeedFavourite({
        id: `${seed.id}__${pageIndex}`,
      }),
    };
  });

  const nextStart = safeStart + items.length;
  const hasMore = nextStart < catalog.length;

  return {
    items,
    nextCursor: hasMore ? String(nextStart) : null,
    hasMore,
  };
}

type FeedCache = {
  version: number;
  items: HomeFeedCreator[];
  cursor: string | null;
  hasMore: boolean;
  activeId: string | null;
  scrollIndex: number;
};

let feedCache: FeedCache | null = null;

export function readHomeFeedCache() {
  if (feedCache && feedCache.version !== FEED_CACHE_VERSION) {
    feedCache = null;
  }
  return feedCache;
}

export function writeHomeFeedCache(
  next: Omit<FeedCache, "version"> & { version?: number },
) {
  feedCache = { ...next, version: FEED_CACHE_VERSION };
}

export function clearHomeFeedCache() {
  feedCache = null;
  shuffledCatalog = null;
}

export function toPurchasePack(item: HomeFeedCreator) {
  return {
    packId: item.packId,
    packName: item.packName,
    price: `${item.diamondCost} Diamonds`,
    creator: item.creatorName,
  };
}
