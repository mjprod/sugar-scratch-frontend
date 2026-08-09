/**
 * Creator Home Feed — immersive discovery cards + paginated demo service.
 * Active cards use portrait video clips so creators appear to move.
 */

export type HomeFeedCreator = {
  id: string;
  creatorId: string;
  creatorName: string;
  collectionName: string;
  description: string;
  packId: string;
  packName: string;
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

/** Mixkit portrait clips — people motion, free license, muted autoplay-friendly. */
const PORTRAIT_CLIPS = [
  {
    video: "https://assets.mixkit.co/videos/51656/51656-720.mp4",
    poster: "https://assets.mixkit.co/videos/51656/51656-thumb-720-0.jpg",
  },
  {
    video: "https://assets.mixkit.co/videos/41622/41622-720.mp4",
    poster: "https://assets.mixkit.co/videos/41622/41622-thumb-720-0.jpg",
  },
  {
    video: "https://assets.mixkit.co/videos/32049/32049-720.mp4",
    poster: "https://assets.mixkit.co/videos/32049/32049-thumb-720-0.jpg",
  },
  {
    video: "https://assets.mixkit.co/videos/34505/34505-720.mp4",
    poster: "https://assets.mixkit.co/videos/34505/34505-thumb-720-0.jpg",
  },
  {
    video: "https://assets.mixkit.co/videos/34487/34487-720.mp4",
    poster: "https://assets.mixkit.co/videos/34487/34487-thumb-720-0.jpg",
  },
  {
    video: "https://assets.mixkit.co/videos/40122/40122-720.mp4",
    poster: "https://assets.mixkit.co/videos/40122/40122-thumb-720-0.jpg",
  },
  {
    video: "https://assets.mixkit.co/videos/43308/43308-720.mp4",
    poster: "https://assets.mixkit.co/videos/43308/43308-thumb-720-0.jpg",
  },
  {
    video: "https://assets.mixkit.co/videos/48534/48534-720.mp4",
    poster: "https://assets.mixkit.co/videos/48534/48534-thumb-720-0.jpg",
  },
] as const;

const CATALOG: Omit<HomeFeedCreator, "liked">[] = [
  {
    id: "hf-ashley-golden",
    creatorId: "ashley",
    creatorName: "Ashley",
    collectionName: "Golden Hour",
    description: "Rooftop Collection",
    packId: "ep1",
    packName: "Golden Hour Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[0].poster,
    videoUrl: PORTRAIT_CLIPS[0].video,
    diamondCost: 10,
  },
  {
    id: "hf-nancy-ritual",
    creatorId: "nancy",
    creatorName: "Nancy Allison",
    collectionName: "Daily Ritual",
    description: "Soft morning light and quiet routines.",
    packId: "nl1",
    packName: "Daily Drop Foil Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[1].poster,
    videoUrl: PORTRAIT_CLIPS[1].video,
    diamondCost: 8,
  },
  {
    id: "hf-alex-neon",
    creatorId: "alex",
    creatorName: "Alex Rivera",
    collectionName: "Neon Muse",
    description: "City nights, chrome edges, electric pink.",
    packId: "aa1",
    packName: "Neon Muse Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[2].poster,
    videoUrl: PORTRAIT_CLIPS[2].video,
    diamondCost: 12,
  },
  {
    id: "hf-emily-sunset",
    creatorId: "emma",
    creatorName: "Emily",
    collectionName: "Sunset Glow",
    description: "Warm beach haze and foil motion cards.",
    packId: "eb1",
    packName: "Sunset Glow Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[3].poster,
    videoUrl: PORTRAIT_CLIPS[3].video,
    diamondCost: 10,
  },
  {
    id: "hf-sam-weekend",
    creatorId: "sam",
    creatorName: "Sam Chen",
    collectionName: "Weekend Edit",
    description: "Fast cuts, street energy, limited drops.",
    packId: "sw1",
    packName: "Bonus Rush Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[4].poster,
    videoUrl: PORTRAIT_CLIPS[4].video,
    diamondCost: 6,
  },
  {
    id: "hf-nancy-champagne",
    creatorId: "nancy",
    creatorName: "Nancy Allison",
    collectionName: "Champagne Hours",
    description: "Evening glass, gold foil, exclusive themes.",
    packId: "np1",
    packName: "Champagne Foil Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[5].poster,
    videoUrl: PORTRAIT_CLIPS[5].video,
    diamondCost: 15,
  },
  {
    id: "hf-emily-summer",
    creatorId: "emma",
    creatorName: "Emily",
    collectionName: "Summer Nights",
    description: "Limited rooftop set after dark.",
    packId: "ep1",
    packName: "After Class Foil Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[6].poster,
    videoUrl: PORTRAIT_CLIPS[6].video,
    diamondCost: 10,
  },
  {
    id: "hf-alex-muse2",
    creatorId: "alex",
    creatorName: "Alex Rivera",
    collectionName: "Afterglow",
    description: "Motion previews from the studio floor.",
    packId: "aa1",
    packName: "Neon Muse Pack",
    mediaType: "video",
    posterUrl: PORTRAIT_CLIPS[7].poster,
    videoUrl: PORTRAIT_CLIPS[7].video,
    diamondCost: 12,
  },
];

const PAGE_SIZE = 4;
const FEED_CACHE_VERSION = 2;

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
  await wait(cursor ? 380 : 520);
  if (forceFailNext) {
    forceFailNext = false;
    throw new Error("Unable to load creators.");
  }

  const start = cursor ? Number.parseInt(cursor, 10) : 0;
  const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;
  const items: HomeFeedCreator[] = [];

  for (let i = 0; i < PAGE_SIZE; i++) {
    const catalogIndex = (safeStart + i) % CATALOG.length;
    const pageIndex = safeStart + i;
    const seed = CATALOG[catalogIndex]!;
    items.push({
      ...seed,
      id: `${seed.id}__${pageIndex}`,
      liked: false,
    });
  }

  const nextStart = safeStart + PAGE_SIZE;
  const hasMore = nextStart < CATALOG.length * 6;

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
}

export function toPurchasePack(item: HomeFeedCreator) {
  return {
    packId: item.packId,
    packName: item.packName,
    price: `${item.diamondCost} Diamonds`,
    creator: item.creatorName,
  };
}
