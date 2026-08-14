/**
 * Home Feed Spec 1.1 — frontend domain models + demo feed service.
 * High-fidelity assets from photos.ts (Unsplash editorial).
 */

import { CREATOR_PHOTOS, PACK_PHOTOS } from "../lib/photos";

export type Price = {
  amount: number;
  currency: "USD" | "SC";
};

export type CreatorSummary = {
  id: string;
  displayName: string;
  avatarUrl: string;
  isAvailable: boolean;
  defaultThemeId?: string;
};

export type ThemeSummary = {
  id: string;
  creatorId: string;
  displayName: string;
  isAvailable: boolean;
  packCount?: number;
};

export type CardPackSummary = {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  themeId: string;
  themeName: string;
  coverImageUrl: string;
  thumbnailUrl: string;
  tone: string;
  price: Price;
  purchaseCount: number;
  popularityLabel?: string;
  isFavourite: boolean;
  isAvailable: boolean;
  badge?: string;
};

export type PaginationState = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type HomepageFeed = {
  featuredPack: CardPackSummary | null;
  creators: CreatorSummary[];
  selectedCreatorId: string | null;
  themes: ThemeSummary[];
  selectedThemeId: string | null;
  topSellingPacks: CardPackSummary[];
  topSellingPagination: PaginationState;
};

export function formatPrice(price: Price) {
  if (price.currency === "SC") return `${price.amount} SC`;
  return `$${price.amount.toFixed(2)}`;
}

const CATALOG: {
  creators: CreatorSummary[];
  themes: ThemeSummary[];
  packs: CardPackSummary[];
} = {
  creators: [
    {
      id: "emma",
      displayName: "Emma",
      avatarUrl: CREATOR_PHOTOS.emma.avatar,
      isAvailable: true,
      defaultThemeId: "emma-teacher",
    },
    {
      id: "nancy",
      displayName: "Nancy Allison",
      avatarUrl: CREATOR_PHOTOS.nancy.avatar,
      isAvailable: true,
      defaultThemeId: "nancy-lifestyle",
    },
    {
      id: "alex",
      displayName: "Alex Rivera",
      avatarUrl: CREATOR_PHOTOS.alex.avatar,
      isAvailable: true,
      defaultThemeId: "alex-limited",
    },
    {
      id: "sam",
      displayName: "Sam Chen",
      avatarUrl: CREATOR_PHOTOS.sam.avatar,
      isAvailable: true,
      defaultThemeId: "sam-weekend",
    },
  ],
  themes: [
    { id: "emma-teacher", creatorId: "emma", displayName: "Teacher", isAvailable: true, packCount: 3 },
    { id: "emma-nurse", creatorId: "emma", displayName: "Nurse", isAvailable: true, packCount: 2 },
    { id: "emma-bikini", creatorId: "emma", displayName: "Bikini", isAvailable: true, packCount: 2 },
    { id: "emma-maid", creatorId: "emma", displayName: "Maid", isAvailable: true, packCount: 1 },
    { id: "nancy-lifestyle", creatorId: "nancy", displayName: "Lifestyle", isAvailable: true, packCount: 2 },
    { id: "nancy-premium", creatorId: "nancy", displayName: "Premium", isAvailable: true, packCount: 1 },
    { id: "alex-limited", creatorId: "alex", displayName: "Limited", isAvailable: true, packCount: 2 },
    { id: "alex-ai", creatorId: "alex", displayName: "AI Series", isAvailable: true, packCount: 1 },
    { id: "sam-weekend", creatorId: "sam", displayName: "Weekend", isAvailable: true, packCount: 1 },
  ],
  packs: [
    pack("ep1", "After Class Foil Pack", "emma", "Emma", "emma-teacher", "Teacher", 4.99, 8420, "12.4k playing", "from-[oklch(0.262_0.086_297.4)] via-[oklch(0.606_0.219_292.72)] to-[oklch(0.14_0_0)]", true),
    pack("ep2", "Teacher Deluxe Pack", "emma", "Emma", "emma-teacher", "Teacher", 6.99, 6102, undefined, "from-[oklch(0.606_0.219_292.72)]/50 to-[oklch(0.196_0_0)]", true),
    pack("ep3", "Office Hours Pack", "emma", "Emma", "emma-teacher", "Teacher", 3.99, 3901, undefined, "from-[oklch(0.656_0.212_354.31)]/40 to-[oklch(0.196_0_0)]", true),
    pack("en1", "Night Shift Foil Pack", "emma", "Emma", "emma-nurse", "Nurse", 4.99, 7200, "9.1k playing", "from-[oklch(0.346_0.074_256.04)] via-[oklch(0.606_0.219_292.72)] to-[oklch(0.14_0_0)]", true),
    pack("en2", "Clinic Rush Pack", "emma", "Emma", "emma-nurse", "Nurse", 5.99, 5011, undefined, "from-[oklch(0.606_0.219_292.72)]/40 to-[oklch(0.196_0_0)]", false),
    pack("eb1", "Sunset Glow Pack", "emma", "Emma", "emma-bikini", "Bikini", 5.99, 11240, "15.8k playing", "from-[oklch(0.408_0.116_38.17)] via-[oklch(0.656_0.212_354.31)] to-[oklch(0.14_0_0)]", true, "Hot"),
    pack("eb2", "Poolside Pack", "emma", "Emma", "emma-bikini", "Bikini", 4.99, 8802, undefined, "from-[oklch(0.656_0.212_354.31)]/40 to-[oklch(0.196_0_0)]", true),
    pack("em1", "Velvet Service Pack", "emma", "Emma", "emma-maid", "Maid", 4.49, 5400, "7.6k playing", "from-[oklch(0.295_0.085_313.12)] via-[oklch(0.606_0.219_292.72)] to-[oklch(0.14_0_0)]", true),
    pack("nl1", "Daily Drop Foil Pack", "nancy", "Nancy Allison", "nancy-lifestyle", "Lifestyle", 3.99, 6200, "8.2k playing", "from-[oklch(0.306_0.093_334.48)] via-[oklch(0.656_0.212_354.31)] to-[oklch(0.14_0_0)]", true),
    pack("nl2", "City Nights Pack", "nancy", "Nancy Allison", "nancy-lifestyle", "Lifestyle", 4.99, 4100, undefined, "from-[oklch(0.606_0.219_292.72)]/40 to-[oklch(0.196_0_0)]", true),
    pack("np1", "Champagne Foil Pack", "nancy", "Nancy Allison", "nancy-premium", "Premium", 6.99, 4800, "6.4k playing", "from-[oklch(0.307_0.038_50.62)] via-[oklch(0.767_0.139_91.06)] to-[oklch(0.14_0_0)]", true, "Premium"),
    pack("al1", "Edition Zero Pack", "alex", "Alex Rivera", "alex-limited", "Limited", 7.99, 9900, "11.0k playing", "from-[oklch(0.275_0.065_255.18)] via-[oklch(0.606_0.219_292.72)] to-[oklch(0.14_0_0)]", true),
    pack("al2", "Vault Pack", "alex", "Alex Rivera", "alex-limited", "Limited", 9.99, 5500, undefined, "from-[oklch(0.606_0.219_292.72)]/40 to-[oklch(0.196_0_0)]", true),
    pack("aa1", "Neon Muse Pack", "alex", "Alex Rivera", "alex-ai", "AI Series", 5.49, 8700, "10.2k playing", "from-[oklch(0.221_0.087_286.57)] via-[oklch(0.656_0.212_354.31)] to-[oklch(0.14_0_0)]", true),
    pack("sw1", "Bonus Rush Pack", "sam", "Sam Chen", "sam-weekend", "Weekend", 2.99, 4300, "5.9k playing", "from-[oklch(0.25_0.07_0.47)] via-[oklch(0.656_0.212_354.31)] to-[oklch(0.14_0_0)]", true),
  ],
};

function pack(
  id: string,
  name: string,
  creatorId: string,
  creatorName: string,
  themeId: string,
  themeName: string,
  amount: number,
  purchaseCount: number,
  popularityLabel: string | undefined,
  tone: string,
  isAvailable: boolean,
  badge?: string,
): CardPackSummary {
  const photo = PACK_PHOTOS[id] ?? PACK_PHOTOS.ep1;
  return {
    id,
    name,
    creatorId,
    creatorName,
    themeId,
    themeName,
    coverImageUrl: photo,
    thumbnailUrl: photo,
    tone,
    price: { amount, currency: "USD" },
    purchaseCount,
    popularityLabel,
    isFavourite: false,
    isAvailable,
    badge,
  };
}

const PAGE_SIZE = 3;
let favouriteStore = new Set<string>();

function withFavourites(p: CardPackSummary): CardPackSummary {
  return { ...p, isFavourite: favouriteStore.has(p.id) };
}

function themesForCreator(creatorId: string) {
  return CATALOG.themes.filter((t) => t.creatorId === creatorId && t.isAvailable);
}

function packsForFilter(creatorId: string, themeId: string | "all") {
  return CATALOG.packs
    .filter(
      (p) =>
        p.creatorId === creatorId &&
        (themeId === "all" || p.themeId === themeId),
    )
    .map(withFavourites)
    .sort((a, b) => b.purchaseCount - a.purchaseCount);
}

function pickFeatured(creatorId: string, themeId: string | "all"): CardPackSummary | null {
  const list = packsForFilter(creatorId, themeId).filter((p) => p.isAvailable);
  return list[0] ?? null;
}

function resolveDefaultTheme(creator: CreatorSummary): string | "all" {
  if (creator.defaultThemeId) return creator.defaultThemeId;
  const first = themesForCreator(creator.id)[0];
  return first?.id ?? "all";
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchHomepageFeed(): Promise<HomepageFeed> {
  await wait(650);
  const creators = CATALOG.creators.filter((c) => c.isAvailable);
  const creator = creators[0];
  const themeId = resolveDefaultTheme(creator);
  const allPacks = packsForFilter(creator.id, themeId);
  const page = allPacks.slice(0, PAGE_SIZE);
  const featured = pickFeatured(creator.id, themeId);

  return {
    featuredPack: featured,
    creators,
    selectedCreatorId: creator.id,
    themes: themesForCreator(creator.id),
    selectedThemeId: themeId === "all" ? null : themeId,
    topSellingPacks: page,
    topSellingPagination: {
      nextCursor: allPacks.length > PAGE_SIZE ? String(PAGE_SIZE) : null,
      hasMore: allPacks.length > PAGE_SIZE,
    },
  };
}

export async function fetchFeedForSelection(
  creatorId: string,
  themeId: string | "all",
): Promise<
  Pick<
    HomepageFeed,
    "featuredPack" | "themes" | "selectedThemeId" | "topSellingPacks" | "topSellingPagination"
  >
> {
  await wait(420);
  const creator = CATALOG.creators.find((c) => c.id === creatorId);
  if (!creator?.isAvailable) throw new Error("Creator unavailable");

  const themes = themesForCreator(creatorId);
  const resolvedTheme =
    themeId === "all"
      ? "all"
      : themes.some((t) => t.id === themeId)
        ? themeId
        : resolveDefaultTheme(creator);

  const allPacks = packsForFilter(creatorId, resolvedTheme);
  const page = allPacks.slice(0, PAGE_SIZE);

  return {
    featuredPack: pickFeatured(creatorId, resolvedTheme),
    themes,
    selectedThemeId: resolvedTheme === "all" ? null : resolvedTheme,
    topSellingPacks: page,
    topSellingPagination: {
      nextCursor: allPacks.length > PAGE_SIZE ? String(PAGE_SIZE) : null,
      hasMore: allPacks.length > PAGE_SIZE,
    },
  };
}

export async function fetchMoreTopSelling(
  creatorId: string,
  themeId: string | "all",
  cursor: string,
): Promise<{ packs: CardPackSummary[]; pagination: PaginationState }> {
  await wait(400);
  const start = Number(cursor) || 0;
  const allPacks = packsForFilter(creatorId, themeId);
  const page = allPacks.slice(start, start + PAGE_SIZE);
  const next = start + PAGE_SIZE;
  return {
    packs: page,
    pagination: {
      nextCursor: next < allPacks.length ? String(next) : null,
      hasMore: next < allPacks.length,
    },
  };
}

export async function toggleFavouriteRequest(packId: string, next: boolean): Promise<void> {
  await wait(350);
  if (packId.endsWith("2")) throw new Error("Favourite failed");
  if (next) favouriteStore.add(packId);
  else favouriteStore.delete(packId);
}
