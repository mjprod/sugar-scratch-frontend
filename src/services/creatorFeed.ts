/**
 * Creator Home Feed — immersive discovery cards + paginated demo service.
 * Active cards use portrait video clips so creators appear to move.
 */

import { loadModels, profileFromModel, type BackendModel } from "./models";

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

/** Local portrait clips from /public/videos. */
const PORTRAIT_CLIPS = [
  "/videos/demo-asianGirl.mp4",
  "/videos/demo-blondGuy.mp4",
  "/videos/demo-bikiniYellow.mp4",
  "/videos/demo-brazilianGuy.mp4",
  "/videos/demo-blackHat.mp4",
  "/videos/demo-olderGuy.mp4",
  "/videos/demo-carGirl.mp4",
  "/videos/demo-cowgirl.mp4",
  "/videos/demo-crazyEyes.mp4",
  "/videos/demo-dancingGirlk.mp4",
  "/videos/demo-hairGirl.mp4",
  "/videos/demo-nikki_murci.mp4",
  "/videos/demo-portugueseGirl.mp4",
  "/videos/demo-thikkGirl.mp4",
  "/videos/demo-towelGirl.mp4",
] as const;

function feedItemFromModel(model: BackendModel): Omit<HomeFeedCreator, "liked"> {
  const profile = profileFromModel(model);
  return {
    id: `hf-${profile.id}`,
    creatorId: profile.id,
    creatorName: profile.name,
    collectionName: profile.city ?? "Collection",
    description: profile.collectionLabel,
    packId: profile.id,
    packName: profile.collectionLabel,
    tags: [profile.city, profile.country].filter((tag): tag is string => Boolean(tag)),
    mediaType: profile.swipeVideoUrl ? "video" : "image",
    posterUrl: "",
    videoUrl: profile.swipeVideoUrl ?? PORTRAIT_CLIPS[0],
    diamondCost: 10,
  };
}

const CATALOG: Omit<HomeFeedCreator, "liked">[] = [
  {
    id: "hf-ashley-golden",
    creatorId: "ashley",
    creatorName: "Ashley",
    collectionName: "Golden Hour",
    description: "Rooftop Collection",
    packId: "ep1",
    packName: "Golden Hour Pack",
    tags: ["Rooftop", "Summer", "Limited"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[0],
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
    tags: ["Morning", "Soft", "Lifestyle"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[1],
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
    tags: ["Cyber", "Night", "Neon"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[2],
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
    tags: ["Beach", "Sunset", "Warm"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[3],
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
    tags: ["Street", "Energy", "Limited"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[4],
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
    tags: ["Evening", "Gold", "Exclusive"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[5],
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
    tags: ["Rooftop", "Night", "Limited"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[6],
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
    tags: ["Studio", "Motion", "Neon"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[7],
    diamondCost: 12,
  },
  {
    id: "hf-ashley-hair",
    creatorId: "ashley",
    creatorName: "Ashley",
    collectionName: "Studio Wind",
    description: "Hair, light, and close-up motion.",
    packId: "ep1",
    packName: "Golden Hour Pack",
    tags: ["Studio", "Close-up", "Limited"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[8],
    diamondCost: 10,
  },
  {
    id: "hf-nancy-lisbon",
    creatorId: "nancy",
    creatorName: "Nancy Allison",
    collectionName: "Lisbon Light",
    description: "Warm streets and late-afternoon foil.",
    packId: "nl1",
    packName: "Daily Drop Foil Pack",
    tags: ["Travel", "Warm", "Exclusive"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[9],
    diamondCost: 8,
  },
  {
    id: "hf-sam-thikk",
    creatorId: "sam",
    creatorName: "Sam Chen",
    collectionName: "Curve Edit",
    description: "Bold framing and weekend energy.",
    packId: "sw1",
    packName: "Bonus Rush Pack",
    tags: ["Bold", "Energy", "Limited"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[10],
    diamondCost: 6,
  },
  {
    id: "hf-emily-towel",
    creatorId: "emma",
    creatorName: "Emily",
    collectionName: "After Hours",
    description: "Soft light and quiet end-of-day cards.",
    packId: "eb1",
    packName: "Sunset Glow Pack",
    tags: ["Soft", "Evening", "Warm"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[11],
    diamondCost: 10,
  },
  {
    id: "hf-alex-blond",
    creatorId: "alex",
    creatorName: "Alex Rivera",
    collectionName: "Daylight Cut",
    description: "Clean light and street-level motion.",
    packId: "aa1",
    packName: "Neon Muse Pack",
    tags: ["Daylight", "Street", "Motion"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[12],
    diamondCost: 12,
  },
  {
    id: "hf-sam-rio",
    creatorId: "sam",
    creatorName: "Sam Chen",
    collectionName: "Rio Heat",
    description: "Sun, color, and weekend energy.",
    packId: "sw1",
    packName: "Bonus Rush Pack",
    tags: ["Sun", "Color", "Limited"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[13],
    diamondCost: 6,
  },
  {
    id: "hf-nancy-vintage",
    creatorId: "nancy",
    creatorName: "Nancy Allison",
    collectionName: "Vintage Hour",
    description: "Quiet framing and evening foil.",
    packId: "np1",
    packName: "Champagne Foil Pack",
    tags: ["Vintage", "Evening", "Exclusive"],
    mediaType: "video",
    posterUrl: "",
    videoUrl: PORTRAIT_CLIPS[14],
    diamondCost: 15,
  },
];

const PAGE_SIZE = 4;
const FEED_CACHE_VERSION = 7;

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

  const catalog = [...models.map(feedItemFromModel), ...CATALOG];
  const start = cursor ? Number.parseInt(cursor, 10) : 0;
  const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;
  const items: HomeFeedCreator[] = [];

  for (let i = 0; i < PAGE_SIZE; i++) {
    const catalogIndex = (safeStart + i) % catalog.length;
    const pageIndex = safeStart + i;
    const seed = catalog[catalogIndex]!;
    items.push({
      ...seed,
      id: `${seed.id}__${pageIndex}`,
      liked: false,
    });
  }

  const nextStart = safeStart + PAGE_SIZE;
  const hasMore = nextStart < catalog.length * 6;

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
