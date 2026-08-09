/**
 * Homepage Spec 3.0 (Sugar Specification 7) — demo data service.
 * Featured carousel · Continue Collecting · Category Leaderboard
 */

import { CREATOR_PHOTOS, HOLO_PACKS, PACK_PHOTOS } from "./photos";

export type Price = {
  amount: number;
  currency: "USD" | "SC";
};

export type FeaturedPack = {
  id: string;
  /** Library / legacy display name */
  name: string;
  packTitle: string;
  creatorId: string;
  creatorName: string;
  collectionName: string;
  themeName: string;
  coverImageUrl: string;
  price: Price;
  diamondCost: number;
  collected: number;
  collectionTotal: number;
  isNew?: boolean;
  isLimited?: boolean;
  isHot?: boolean;
  isTrending?: boolean;
  expiresAt?: string;
  rarity?: "common" | "rare" | "super-rare" | "ultra-rare";
  accentColors: {
    primary: string;
    secondary: string;
    glow: string;
  };
  rewardHint?: string;
  isAvailable: boolean;
  /** @deprecated prefer isNew / isLimited */
  badge?: string;
};

export function formatCountdown(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return "ENDED";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) return `${days}D ${hours}H`;
  return `${hours}H ${minutes}M`;
}

export function clampCollectionProgress(collected: number, total: number) {
  if (total <= 0) return null;
  const safe = Math.min(Math.max(0, collected), total);
  if (collected > total) {
    console.warn("[featured] collected > collectionTotal", { collected, total });
  }
  return { collected: safe, total, ratio: safe / total };
}

/** Map collection progress into 5–8 visual milestones (Spec §13.2). */
export function progressMilestones(
  collected: number,
  total: number,
  preferred = 7,
): {
  collected: number;
  total: number;
  segments: { state: "filled" | "partial" | "empty"; fill: number }[];
} | null {
  const clamped = clampCollectionProgress(collected, total);
  if (!clamped) return null;
  const n = Math.min(8, Math.max(5, Math.min(preferred, total)));
  const fill = clamped.ratio * n;
  const segments = Array.from({ length: n }, (_, i) => {
    if (fill >= i + 1) return { state: "filled" as const, fill: 1 };
    if (fill > i) return { state: "partial" as const, fill: fill - i };
    return { state: "empty" as const, fill: 0 };
  });
  return { collected: clamped.collected, total: clamped.total, segments };
}

export type ContinueCollectingItem = {
  creatorId: string;
  creatorName: string;
  avatarUrl: string;
  collected: number;
  total: number;
  percent: number;
  rank?: number;
  isNew?: boolean;
  /** @deprecated prefer rank / isNew */
  badge?: "NEW" | "Almost Complete" | "Reward Ready";
};

export type LeaderboardCategory =
  | "all"
  | "teacher"
  | "nurse"
  | "maid"
  | "bikini"
  | "office"
  | "student";

export type LeaderboardRow = {
  rank: number;
  packId: string;
  packName: string;
  creatorName: string;
  themeName: string;
  thumbnailUrl: string;
  purchaseCount: number;
  price: Price;
  category: Exclude<LeaderboardCategory, "all">;
};

export type HomepageData = {
  featured: FeaturedPack[];
  continueCollecting: ContinueCollectingItem[];
  leaderboard: LeaderboardRow[];
};

export function formatPrice(price: Price) {
  if (price.currency === "SC") return `${price.amount} SC`;
  return `$${price.amount.toFixed(2)}`;
}

export const LEADERBOARD_CATEGORIES: { id: LeaderboardCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "teacher", label: "Teacher" },
  { id: "nurse", label: "Nurse" },
  { id: "maid", label: "Maid" },
  { id: "bikini", label: "Bikini" },
  { id: "office", label: "Office" },
  { id: "student", label: "Student" },
];

const FEATURED: FeaturedPack[] = [
  {
    id: "cyber-holo",
    name: "Cyber Girl Pack",
    packTitle: "CYBER\nNIGHTS",
    creatorId: "emily",
    creatorName: "Emily",
    collectionName: "EMILY COLLECTION",
    themeName: "Cyber Nights",
    coverImageUrl: HOLO_PACKS.cyberHolo,
    price: { amount: 4.99, currency: "USD" },
    diamondCost: 10,
    collected: 8,
    collectionTotal: 15,
    isNew: true,
    rarity: "super-rare",
    accentColors: {
      primary: "#FFB356",
      secondary: "#D641B1",
      glow: "rgba(214, 65, 177, 0.28)",
    },
    rewardHint: "Unlock Photo Scratch rewards",
    isAvailable: true,
  },
  {
    id: "kimono-holo",
    name: "Lantern Night Pack",
    packTitle: "SUMMER\nNIGHTS",
    creatorId: "sophia",
    creatorName: "Sophia",
    collectionName: "SOPHIA COLLECTION",
    themeName: "Festival",
    coverImageUrl: HOLO_PACKS.kimonoHolo,
    price: { amount: 5.99, currency: "USD" },
    diamondCost: 12,
    collected: 8,
    collectionTotal: 15,
    isLimited: true,
    rarity: "ultra-rare",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 84).toISOString(),
    accentColors: {
      primary: "#F5C669",
      secondary: "#EC4899",
      glow: "rgba(245, 198, 105, 0.28)",
    },
    rewardHint: "Complete theme for Replay Mode",
    isAvailable: true,
  },
  {
    id: "racing-holo",
    name: "Neon Circuit Pack",
    packTitle: "NEON\nCIRCUIT",
    creatorId: "sophia",
    creatorName: "Sophia",
    collectionName: "SOPHIA COLLECTION",
    themeName: "Racing",
    coverImageUrl: HOLO_PACKS.racingHolo,
    price: { amount: 5.99, currency: "USD" },
    diamondCost: 10,
    collected: 3,
    collectionTotal: 13,
    isNew: true,
    isHot: true,
    rarity: "rare",
    accentColors: {
      primary: "#60A5FA",
      secondary: "#EC4899",
      glow: "rgba(96, 165, 250, 0.28)",
    },
    rewardHint: "Earn Diamond bonuses",
    isAvailable: true,
  },
  {
    id: "samurai-holo",
    name: "Crimson Blade Pack",
    packTitle: "CRIMSON\nBLADE",
    creatorId: "emily",
    creatorName: "Emily",
    collectionName: "EMILY COLLECTION",
    themeName: "Samurai",
    coverImageUrl: HOLO_PACKS.samuraiHolo,
    price: { amount: 6.49, currency: "USD" },
    diamondCost: 15,
    collected: 11,
    collectionTotal: 15,
    isLimited: true,
    isTrending: true,
    rarity: "ultra-rare",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    accentColors: {
      primary: "#F87171",
      secondary: "#FBBF24",
      glow: "rgba(248, 113, 113, 0.28)",
    },
    rewardHint: "Near theme completion",
    isAvailable: true,
  },
  {
    id: "mage-holo",
    name: "Starlight Idol Pack",
    packTitle: "STARLIGHT\nIDOL",
    creatorId: "sophia",
    creatorName: "Sophia",
    collectionName: "SOPHIA COLLECTION",
    themeName: "Stage",
    coverImageUrl: HOLO_PACKS.mageHolo,
    price: { amount: 6.99, currency: "USD" },
    diamondCost: 12,
    collected: 5,
    collectionTotal: 15,
    isTrending: true,
    rarity: "super-rare",
    accentColors: {
      primary: "#C4B5FD",
      secondary: "#F472B6",
      glow: "rgba(196, 181, 253, 0.28)",
    },
    rewardHint: "Motion Cards unlock Photos",
    isAvailable: true,
  },
];

const CONTINUE: ContinueCollectingItem[] = [
  {
    creatorId: "sophia",
    creatorName: "Ashley",
    avatarUrl: CREATOR_PHOTOS.nancy.avatar,
    collected: 63,
    total: 100,
    percent: 63,
    rank: 9,
  },
  {
    creatorId: "emily",
    creatorName: "Emily",
    avatarUrl: CREATOR_PHOTOS.emma.avatar,
    collected: 52,
    total: 100,
    percent: 52,
    isNew: true,
  },
  {
    creatorId: "melisa",
    creatorName: "Yuna",
    avatarUrl: CREATOR_PHOTOS.sam.avatar,
    collected: 41,
    total: 100,
    percent: 41,
  },
  {
    creatorId: "lucy",
    creatorName: "Mia",
    avatarUrl: CREATOR_PHOTOS.alex.avatar,
    collected: 28,
    total: 100,
    percent: 28,
  },
  {
    creatorId: "emma",
    creatorName: "Lisa",
    avatarUrl: CREATOR_PHOTOS.emma.portrait,
    collected: 17,
    total: 100,
    percent: 17,
  },
];

const LEADERBOARD: LeaderboardRow[] = [
  row(1, "ep1", "After Class Foil Pack", "Emma", "Teacher", "teacher", 12420, 4.99),
  row(2, "ep2", "Teacher Deluxe Pack", "Luna", "Teacher", "teacher", 9102, 6.99),
  row(3, "ep3", "Office Hours Pack", "Ashley", "Teacher", "teacher", 7801, 3.99),
  row(1, "en1", "Night Shift Foil Pack", "Emma", "Nurse", "nurse", 11200, 4.99),
  row(2, "en2", "Clinic Rush Pack", "Mia", "Nurse", "nurse", 6400, 5.99),
  row(1, "em1", "Velvet Service Pack", "Emma", "Maid", "maid", 8800, 4.49),
  row(1, "eb1", "Sunset Glow Pack", "Emma", "Bikini", "bikini", 15800, 5.99),
  row(2, "eb2", "Poolside Pack", "Nancy Allison", "Bikini", "bikini", 9200, 4.99),
  row(1, "al1", "Edition Zero Pack", "Alex Rivera", "Office", "office", 9900, 7.99),
  row(1, "sw1", "Bonus Rush Pack", "Sam Chen", "Student", "student", 4300, 2.99),
  row(2, "nl1", "Daily Drop Foil Pack", "Nancy Allison", "Student", "student", 6200, 3.99),
];

function row(
  rank: number,
  packId: string,
  packName: string,
  creatorName: string,
  themeName: string,
  category: Exclude<LeaderboardCategory, "all">,
  purchaseCount: number,
  amount: number,
): LeaderboardRow {
  return {
    rank,
    packId,
    packName,
    creatorName,
    themeName,
    thumbnailUrl: PACK_PHOTOS[packId] ?? PACK_PHOTOS.ep1,
    purchaseCount,
    price: { amount, currency: "USD" },
    category,
  };
}

function wait(ms = 420) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchHomepage(): Promise<HomepageData> {
  await wait();
  return {
    featured: FEATURED,
    continueCollecting: [...CONTINUE].sort((a, b) => b.percent - a.percent),
    leaderboard: LEADERBOARD,
  };
}

export async function fetchLeaderboard(
  category: LeaderboardCategory,
): Promise<LeaderboardRow[]> {
  await wait(280);
  const rows =
    category === "all"
      ? [...LEADERBOARD].sort((a, b) => b.purchaseCount - a.purchaseCount)
      : LEADERBOARD.filter((r) => r.category === category).sort(
          (a, b) => a.rank - b.rank,
        );
  return rows.map((r, i) =>
    category === "all" ? { ...r, rank: i + 1 } : r,
  );
}

export async function fetchPackLibrary(): Promise<FeaturedPack[]> {
  await wait(300);
  const defaults = {
    diamondCost: 8,
    collected: 0,
    collectionTotal: 15,
    accentColors: {
      primary: "#F5C669",
      secondary: "#EC4899",
      glow: "rgba(245, 198, 105, 0.22)",
    },
    isAvailable: true as const,
  };
  return FEATURED.concat([
    {
      id: "nl1",
      name: "Daily Drop Foil Pack",
      packTitle: "DAILY\nDROP",
      creatorId: "nancy",
      creatorName: "Nancy Allison",
      collectionName: "NANCY COLLECTION",
      themeName: "Lifestyle",
      coverImageUrl: PACK_PHOTOS.nl1,
      price: { amount: 3.99, currency: "USD" },
      ...defaults,
    },
    {
      id: "em1",
      name: "Velvet Service Pack",
      packTitle: "VELVET\nSERVICE",
      creatorId: "emma",
      creatorName: "Emma",
      collectionName: "EMMA COLLECTION",
      themeName: "Maid",
      coverImageUrl: PACK_PHOTOS.em1,
      price: { amount: 4.49, currency: "USD" },
      ...defaults,
    },
  ]);
}

/** Explore — portrait creator discovery (one per viewport). */
export type FeedPreview = {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  /** Collection / theme title shown under the creator name. */
  collectionName: string;
  packId: string;
  packName: string;
  posterUrl: string;
  videoUrl: string;
  cardCount: number;
  diamondCost: number;
  limited?: boolean;
  liked: boolean;
};

const FEED_VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
];

export async function fetchDiscoveryFeed(): Promise<FeedPreview[]> {
  await wait(500);
  return [
    {
      id: "pv1",
      creatorId: "emma",
      creatorName: "Emily",
      creatorAvatar: CREATOR_PHOTOS.emma.avatar,
      collectionName: "Summer Nights",
      packId: "ep1",
      packName: "After Class Foil Pack",
      posterUrl: CREATOR_PHOTOS.emma.portrait,
      videoUrl: FEED_VIDEOS[0],
      cardCount: 12,
      diamondCost: 10,
      limited: true,
      liked: false,
    },
    {
      id: "pv2",
      creatorId: "nancy",
      creatorName: "Nancy Allison",
      creatorAvatar: CREATOR_PHOTOS.nancy.avatar,
      collectionName: "Daily Ritual",
      packId: "nl1",
      packName: "Daily Drop Foil Pack",
      posterUrl: CREATOR_PHOTOS.nancy.portrait,
      videoUrl: FEED_VIDEOS[1],
      cardCount: 10,
      diamondCost: 8,
      limited: true,
      liked: true,
    },
    {
      id: "pv3",
      creatorId: "alex",
      creatorName: "Alex Rivera",
      creatorAvatar: CREATOR_PHOTOS.alex.avatar,
      collectionName: "Neon Muse",
      packId: "aa1",
      packName: "Neon Muse Pack",
      posterUrl: CREATOR_PHOTOS.alex.portrait,
      videoUrl: FEED_VIDEOS[2],
      cardCount: 15,
      diamondCost: 12,
      liked: false,
    },
    {
      id: "pv4",
      creatorId: "emma",
      creatorName: "Emily",
      creatorAvatar: CREATOR_PHOTOS.emma.avatar,
      collectionName: "Sunset Glow",
      packId: "eb1",
      packName: "Sunset Glow Pack",
      posterUrl: PACK_PHOTOS.eb1,
      videoUrl: FEED_VIDEOS[3],
      cardCount: 12,
      diamondCost: 10,
      limited: true,
      liked: false,
    },
    {
      id: "pv5",
      creatorId: "sam",
      creatorName: "Sam Chen",
      creatorAvatar: CREATOR_PHOTOS.sam.avatar,
      collectionName: "Weekend Edit",
      packId: "sw1",
      packName: "Bonus Rush Pack",
      posterUrl: CREATOR_PHOTOS.sam.portrait,
      videoUrl: FEED_VIDEOS[4],
      cardCount: 8,
      diamondCost: 6,
      liked: false,
    },
    {
      id: "pv6",
      creatorId: "nancy",
      creatorName: "Nancy Allison",
      creatorAvatar: CREATOR_PHOTOS.nancy.avatar,
      collectionName: "Champagne Hours",
      packId: "np1",
      packName: "Champagne Foil Pack",
      posterUrl: PACK_PHOTOS.np1,
      videoUrl: FEED_VIDEOS[0],
      cardCount: 14,
      diamondCost: 15,
      liked: false,
    },
  ];
}
