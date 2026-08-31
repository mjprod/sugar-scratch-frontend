/**
 * Homepage Spec 3.0 (Sugar Specification 7) — demo data service.
 * Featured carousel · Continue Collecting · Category Leaderboard
 *
 * Featured + leaderboard stay local mocks; Continue Collecting is live
 * from GET /api/models (+ card counts, local ledger progress).
 */

import {
  CREATOR_PHOTOS,
  HOLO_PACKS,
  MODEL_PACK_PHOTOS,
  PACK_PHOTOS,
} from "../lib/photos";
import { getCollectionPageState } from "./collectionState";
import { isDemoMode } from "../lib/demo";
import { canonicalThemeKey, resolveCollectionThemeLabel } from "./collection";
import {
  formatCollectionLabel,
  loadModels,
  modelDisplayName,
  modelId,
  normalizeMediaUrl,
  profileFromModel,
  type BackendModel,
} from "./models";
import {
  fetchCards,
  type BackendCard,
} from "../shared/backend/collection";

const NEW_MODEL_WINDOW_SEC = 14 * 24 * 60 * 60;

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
  /** Live foil rows: model id (`packId` is the foil slot id). */
  characterId?: string;
  packName: string;
  creatorName: string;
  themeName: string;
  thumbnailUrl: string;
  purchaseCount: number;
  /** @deprecated Prefer diamondCost for purchase surfaces. */
  price: Price;
  /** Pack Diamond cost — same currency used by Purchase / Featured. */
  diamondCost: number;
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
    id: "juliana-police",
    name: "Juliana Police Pack",
    packTitle: "POLICE\nLINEUP",
    creatorId: "julianaval",
    creatorName: "Juliana",
    collectionName: "JULIANA COLLECTION",
    themeName: "Police",
    coverImageUrl: MODEL_PACK_PHOTOS.julianaPolice,
    price: { amount: 5.99, currency: "USD" },
    diamondCost: 12,
    collected: 4,
    collectionTotal: 15,
    isHot: true,
    rarity: "ultra-rare",
    accentColors: {
      primary: "oklch(0.714 0.143 254.62)",
      secondary: "oklch(0.359 0.143 11.42)",
      glow: "oklch(0.714 0.143 254.62 / 0.28)",
    },
    rewardHint: "Complete theme for Replay Mode",
    isAvailable: true,
  },
  {
    id: "juliana-firegirl",
    name: "Juliana Firegirl Pack",
    packTitle: "FIRE\nGIRL",
    creatorId: "julianaval",
    creatorName: "Juliana",
    collectionName: "JULIANA COLLECTION",
    themeName: "Firegirl",
    coverImageUrl: MODEL_PACK_PHOTOS.julianaFiregirl,
    price: { amount: 5.99, currency: "USD" },
    diamondCost: 12,
    collected: 3,
    collectionTotal: 15,
    isNew: true,
    rarity: "super-rare",
    accentColors: {
      primary: "oklch(0.711 0.166 22.22)",
      secondary: "oklch(0.837 0.164 84.43)",
      glow: "oklch(0.711 0.166 22.22 / 0.28)",
    },
    rewardHint: "Unlock Photo Scratch rewards",
    isAvailable: true,
  },
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
      primary: "oklch(0.822 0.14 69.05)",
      secondary: "oklch(0.625 0.217 339.5)",
      glow: "oklch(0.625 0.217 339.5 / 0.28)",
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
      primary: "oklch(0.85 0.123 82.79)",
      secondary: "oklch(0.656 0.212 354.31)",
      glow: "oklch(0.85 0.123 82.79 / 0.28)",
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
      primary: "oklch(0.714 0.143 254.62)",
      secondary: "oklch(0.656 0.212 354.31)",
      glow: "oklch(0.714 0.143 254.62 / 0.28)",
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
      primary: "oklch(0.711 0.166 22.22)",
      secondary: "oklch(0.837 0.164 84.43)",
      glow: "oklch(0.711 0.166 22.22 / 0.28)",
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
      primary: "oklch(0.811 0.101 293.57)",
      secondary: "oklch(0.725 0.175 349.76)",
      glow: "oklch(0.811 0.101 293.57 / 0.28)",
    },
    rewardHint: "Motion Cards unlock Photos",
    isAvailable: true,
  },
];

function cardCountsByModel(cards: BackendCard[] | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards ?? []) {
    const mid = card.model_id?.trim();
    if (!mid) continue;
    counts.set(mid, (counts.get(mid) ?? 0) + 1);
  }
  return counts;
}

function isNewModel(model: BackendModel, nowSec: number): boolean {
  const created = model.created_at;
  if (typeof created !== "number" || !Number.isFinite(created)) return false;
  return nowSec - created <= NEW_MODEL_WINDOW_SEC && nowSec >= created;
}

/** Same key purchases / reveals persist (`pack.creator` → slug). */
function slugCreatorId(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-") || "creator";
}

function normalizeCreatorKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type LedgerProgress = { id: string; name: string; collected: number };

/** Index ledger rows by id, display-name slug, and collapsed alphanumeric keys. */
function indexLedgerProgress(creators: LedgerProgress[]) {
  const index = new Map<string, LedgerProgress>();
  const add = (raw: string, entry: LedgerProgress) => {
    const key = raw.trim();
    if (key && !index.has(key)) index.set(key, entry);
    const normalized = normalizeCreatorKey(key);
    if (normalized && !index.has(normalized)) index.set(normalized, entry);
  };
  for (const creator of creators) {
    add(creator.id, creator);
    add(creator.name, creator);
    add(slugCreatorId(creator.name), creator);
  }
  return index;
}

function ledgerForModel(
  ledgerByKey: Map<string, LedgerProgress>,
  model: BackendModel,
  id: string,
  name: string,
) {
  const candidates = [
    id,
    slugCreatorId(name),
    name,
    model.label ?? "",
    model.influencerName ?? "",
  ];
  for (const candidate of candidates) {
    const exact = ledgerByKey.get(candidate.trim());
    if (exact) return exact;
    const normalized = normalizeCreatorKey(candidate);
    if (normalized) {
      const hit = ledgerByKey.get(normalized);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Map CMS models → Continue Collecting strip items. */
export function continueCollectingFromModels(
  models: BackendModel[],
  cards: BackendCard[] | null,
): ContinueCollectingItem[] {
  if (!models.length) return [];

  const counts = cardCountsByModel(cards);
  const ledgerByKey = indexLedgerProgress(
    getCollectionPageState().continueCreators,
  );
  const nowSec = Date.now() / 1000;

  const items = models.map((model, index) => {
    const id = modelId(model, index);
    const name = modelDisplayName(model);
    const total = counts.get(id) ?? 0;
    const ledger = ledgerForModel(ledgerByKey, model, id, name);
    const collected =
      total > 0
        ? Math.min(total, Math.max(0, ledger?.collected ?? 0))
        : 0;
    const percent =
      total > 0 ? Math.round((collected / total) * 100) : 0;
    const avatarRaw = model.avatar?.trim() ?? "";
    const avatarUrl = avatarRaw
      ? normalizeMediaUrl(avatarRaw)
      : CREATOR_PHOTOS.emma.avatar;
    return {
      creatorId: id,
      creatorName: name,
      avatarUrl,
      collected,
      total,
      percent,
      isNew: isNewModel(model, nowSec),
    } satisfies ContinueCollectingItem;
  });

  return items.sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    return a.creatorName.localeCompare(b.creatorName);
  });
}

async function loadContinueCollecting(): Promise<ContinueCollectingItem[]> {
  try {
    const [models, cards] = await Promise.all([
      loadModels().catch(() => [] as BackendModel[]),
      fetchCards().catch(() => null),
    ]);
    return continueCollectingFromModels(models, cards);
  } catch {
    return [];
  }
}

function themeToLeaderboardCategory(
  themeName: string,
): Exclude<LeaderboardCategory, "all"> {
  const key = canonicalThemeKey(themeName);
  const table: Record<string, Exclude<LeaderboardCategory, "all">> = {
    teacher: "teacher",
    nurse: "nurse",
    maid: "maid",
    bikini: "bikini",
    office: "office",
    student: "student",
    police: "office",
    firegirl: "student",
    fire: "student",
    gym: "student",
  };
  if (table[key]) return table[key];
  for (const [needle, category] of Object.entries(table)) {
    if (key.includes(needle)) return category;
  }
  return "student";
}

/** Map `/api/models` foil packs → leaderboard rows (live prototype). */
export function leaderboardFromModels(
  models: BackendModel[],
): LeaderboardRow[] {
  const rows: LeaderboardRow[] = [];

  for (const model of models) {
    const profile = profileFromModel(model);
    const creatorName = profile.name;
    const avatarRaw = model.avatar?.trim() ?? "";
    const thumbnailUrl = avatarRaw
      ? normalizeMediaUrl(avatarRaw)
      : CREATOR_PHOTOS.emma.avatar;
    const created =
      typeof model.created_at === "number" && Number.isFinite(model.created_at)
        ? model.created_at
        : 0;

    for (const foil of profile.packs) {
      const themeName =
        resolveCollectionThemeLabel({
          packName: foil.label,
          catalogPackId: foil.id,
          creator: creatorName,
        }) || foil.label || creatorName;
      const packName =
        foil.label?.trim() && !/^pack\s/i.test(foil.label)
          ? foil.label.trim()
          : `${creatorName} Pack`;
      const diamondCost = diamondCostForPackId(profile.id);

      rows.push({
        rank: 0,
        packId: foil.id,
        characterId: profile.id,
        packName,
        creatorName,
        themeName,
        thumbnailUrl,
        purchaseCount: Math.max(
          100,
          Math.round(created) + (foil.slot === 1 ? 500 : 200),
        ),
        price: { amount: diamondCost, currency: "SC" },
        diamondCost,
        category: themeToLeaderboardCategory(themeName),
      });
    }
  }

  return rows
    .sort((a, b) => b.purchaseCount - a.purchaseCount)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function loadLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const models = await loadModels();
    return leaderboardFromModels(models);
  } catch {
    return [];
  }
}

const LIVE_PACK_ACCENT = {
  primary: "oklch(0.85 0.123 82.79)",
  secondary: "oklch(0.656 0.212 354.31)",
  glow: "oklch(0.85 0.123 82.79 / 0.22)",
};

/** Map `/api/models` foil packs → pack library cards (live prototype). */
export function packLibraryFromModels(models: BackendModel[]): FeaturedPack[] {
  const packs: FeaturedPack[] = [];

  for (const model of models) {
    const profile = profileFromModel(model);
    const creatorName = profile.name;
    const avatarRaw = model.avatar?.trim() ?? "";
    const coverImageUrl = avatarRaw
      ? normalizeMediaUrl(avatarRaw)
      : CREATOR_PHOTOS.emma.avatar;
    const diamondCost = diamondCostForPackId(profile.id);

    for (const foil of profile.packs) {
      const themeName =
        resolveCollectionThemeLabel({
          packName: foil.label,
          catalogPackId: foil.id,
          creator: creatorName,
        }) || foil.label || creatorName;
      const name =
        foil.label?.trim() && !/^pack\s/i.test(foil.label)
          ? foil.label.trim()
          : `${creatorName} Pack`;

      packs.push({
        id: foil.id,
        name,
        packTitle: name.toUpperCase(),
        creatorId: profile.id,
        creatorName,
        collectionName: formatCollectionLabel(creatorName).toUpperCase(),
        themeName,
        coverImageUrl,
        price: { amount: diamondCost, currency: "SC" },
        diamondCost,
        collected: 0,
        collectionTotal: 15,
        accentColors: LIVE_PACK_ACCENT,
        isAvailable: true,
      });
    }
  }

  return packs;
}

async function loadPackLibrary(): Promise<FeaturedPack[]> {
  try {
    const models = await loadModels();
    return packLibraryFromModels(models);
  } catch {
    return [];
  }
}

const PACK_DIAMOND_COSTS: Record<string, number> = {
  ep1: 50,
  ep2: 70,
  ep3: 40,
  en1: 50,
  en2: 60,
  em1: 45,
  eb1: 60,
  eb2: 50,
  al1: 80,
  sw1: 30,
  nl1: 40,
};

/** Shared Diamond cost for ranking / featured / purchase display. */
export function diamondCostForPackId(packId: string, fallbackUsd?: number) {
  const featured = FEATURED.find((pack) => pack.id === packId);
  if (featured) return featured.diamondCost;
  if (PACK_DIAMOND_COSTS[packId] != null) return PACK_DIAMOND_COSTS[packId];
  if (fallbackUsd != null) return Math.max(1, Math.round(fallbackUsd * 10));
  return 10;
}

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
  const diamondCost = diamondCostForPackId(packId, amount);
  return {
    rank,
    packId,
    packName,
    creatorName,
    themeName,
    thumbnailUrl: PACK_PHOTOS[packId] ?? PACK_PHOTOS.ep1,
    purchaseCount,
    price: { amount: diamondCost, currency: "SC" },
    diamondCost,
    category,
  };
}

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

function wait(ms = 420) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchHomepage(): Promise<HomepageData> {
  const continueCollecting = await loadContinueCollecting();
  if (isDemoMode()) {
    return {
      featured: FEATURED,
      continueCollecting,
      leaderboard: LEADERBOARD,
    };
  }
  return {
    featured: [],
    continueCollecting,
    leaderboard: await loadLeaderboard(),
  };
}

function filterLeaderboardRows(
  rows: LeaderboardRow[],
  category: LeaderboardCategory,
): LeaderboardRow[] {
  const filtered =
    category === "all"
      ? [...rows].sort((a, b) => b.purchaseCount - a.purchaseCount)
      : rows.filter((r) => r.category === category).sort((a, b) => a.rank - b.rank);
  return filtered.map((row, index) =>
    category === "all" ? { ...row, rank: index + 1 } : row,
  );
}

export async function fetchLeaderboard(
  category: LeaderboardCategory,
): Promise<LeaderboardRow[]> {
  if (isDemoMode()) {
    await wait(280);
    return filterLeaderboardRows(LEADERBOARD, category);
  }
  return filterLeaderboardRows(await loadLeaderboard(), category);
}

export async function fetchPackLibrary(): Promise<FeaturedPack[]> {
  if (!isDemoMode()) {
    return loadPackLibrary();
  }
  await wait(300);
  const defaults = {
    diamondCost: 8,
    collected: 0,
    collectionTotal: 15,
    accentColors: {
      primary: "oklch(0.85 0.123 82.79)",
      secondary: "oklch(0.656 0.212 354.31)",
      glow: "oklch(0.85 0.123 82.79 / 0.22)",
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
  videoUrl?: string;
  cardCount: number;
  diamondCost: number;
  limited?: boolean;
  liked: boolean;
};

export async function fetchDiscoveryFeed(): Promise<FeedPreview[]> {
  const models = await loadModels();
  const shuffled = [...models];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = current;
  }
  return shuffled.map((model, index) => {
    const id = modelId(model, index);
    const name = modelDisplayName(model);
    const avatarRaw = model.avatar?.trim() ?? "";
    const avatarUrl = avatarRaw ? normalizeMediaUrl(avatarRaw) : "";
    const videoUrl = model.swipeVideoUrl
      ? normalizeMediaUrl(model.swipeVideoUrl)
      : undefined;
    const packName = model.cardPackName?.trim() || `${name} Collection`;
    return {
      id: `pv-${id}`,
      creatorId: id,
      creatorName: name,
      creatorAvatar: avatarUrl,
      collectionName: packName,
      packId: id,
      packName,
      posterUrl: avatarUrl,
      videoUrl,
      cardCount: 0,
      diamondCost: diamondCostForPackId(id),
      liked: false,
    };
  });
}
