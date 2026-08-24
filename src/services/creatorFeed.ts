/**
 * Creator Home Feed — immersive discovery cards from `/api/models`.
 * Active cards use each model's backend swipe video when present.
 */

import {
  loadModels,
  profileFromModel,
  type BackendModel,
} from "./models";
import { isFeedFavourite } from "./feedFavourites";

export type HomeFeedCreator = {
  id: string;
  creatorId: string;
  creatorName: string;
  /** @deprecated Prefer packName + tags for feed overlay. */
  collectionName: string;
  /** @deprecated Prefer tags for feed overlay. */
  description: string;
  packId: string;
  packName: string;
  /** Up to 3 shown on the feed card — theme / style / availability. */
  tags: string[];
  mediaType: "video" | "image";
  posterUrl: string;
  videoUrl?: string;
  diamondCost: number;
  liked: boolean;
};

export type HomeFeedPage = {
  items: HomeFeedCreator[];
  nextCursor: string | null;
  hasMore: boolean;
};

function feedItemFromModel(model: BackendModel): Omit<HomeFeedCreator, "liked"> {
  const profile = profileFromModel(model);
  const videoUrl = profile.swipeVideoUrl ?? undefined;
  return {
    id: `hf-${profile.id}`,
    creatorId: profile.id,
    creatorName: profile.name,
    collectionName: profile.city ?? "Collection",
    description: profile.collectionLabel,
    packId: profile.id,
    packName: profile.collectionLabel,
    tags: [profile.city, profile.country].filter((tag): tag is string => Boolean(tag)),
    mediaType: videoUrl ? "video" : "image",
    posterUrl: "",
    videoUrl,
    diamondCost: 10,
  };
}

const PAGE_SIZE = 6;
const FEED_CACHE_VERSION = 13;

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

/** Upcoming clips to keep buffered beyond the active one. */
export const FEED_WARM_AHEAD = 2;
/** Previous clip to keep buffered for a reverse swipe. */
export const FEED_WARM_BEHIND = 1;

export function isWarmFeedIndex(index: number, activeIndex: number) {
  const resolved = activeIndex >= 0 ? activeIndex : 0;
  if (index === resolved) return false;
  return (
    index >= resolved - FEED_WARM_BEHIND &&
    index <= resolved + FEED_WARM_AHEAD
  );
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let forceFailNext = false;

export function __homeFeedForceFailNext() {
  forceFailNext = true;
}

export async function fetchHomeFeedPage(
  cursor: string | null = null,
): Promise<HomeFeedPage> {
  const [, models] = await Promise.all([
    wait(cursor ? 380 : 520),
    loadModels(),
  ]);
  if (forceFailNext) {
    forceFailNext = false;
    throw new Error("Unable to load creators.");
  }

  if (cursor == null || !shuffledCatalog) {
    shuffledCatalog = shuffleCatalog(uniqueFeedItems(models.map(feedItemFromModel)));
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
