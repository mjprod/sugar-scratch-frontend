/**
 * Creator Following ledger — local until a backend follow graph exists.
 * Activity/NEW flags are only stored when the product sets them; we never invent them.
 */
import { getAuthUserId } from "./auth";
import {
  fetchModels,
  normalizeMediaUrl,
  type BackendModel,
} from "./models";
import { formatSocialHandle } from "@/shared/catalog/characters";
import { isDemoMode } from "@/lib/demo";

const KEY_PREFIX = "sugar.v8.creatorFollowing";

/** Window for “Recently Active” using lastActiveAt (not invented NEW). */
export const RECENTLY_ACTIVE_MS = 1000 * 60 * 60 * 24 * 30;

export type FollowingCollection = {
  id: string;
  name: string;
  /** Optional season label when product provides it. */
  season?: string;
  thumbnailUrl: string;
  /** Only set when genuine new-content count is known (> 0). */
  newCardCount?: number;
};

export type FollowedCreator = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  followedAt: number;
  /** Known activity timestamp — omit when unknown. */
  lastActiveAt?: number;
  /** Unseen activity — only true when product marks it. */
  hasUnseenActivity?: boolean;
  currentCollection?: FollowingCollection;
};

export type FollowingSort = "recent" | "recently-followed" | "name";

function storageKey(): string | null {
  const userId = getAuthUserId();
  return userId ? `${KEY_PREFIX}.${userId}` : null;
}

/** One-shot demo seed — never re-run after unfollow-all / empty ledger. */
function seedFlagKey(): string | null {
  const userId = getAuthUserId();
  return userId ? `${KEY_PREFIX}.seeded.${userId}` : null;
}

function hasSeededOnce(): boolean {
  const key = seedFlagKey();
  if (!key) return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function markSeededOnce() {
  const key = seedFlagKey();
  if (!key) return;
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* storage unavailable */
  }
}

function read(): FollowedCreator[] {
  const key = storageKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FollowedCreator[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: FollowedCreator[]) {
  const key = storageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
}

function titleCaseTheme(id: string): string {
  return id
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function collectionFromModel(model: BackendModel): FollowingCollection | undefined {
  const themes = model.theme_avatars;
  if (!themes || typeof themes !== "object") return undefined;
  const entry = Object.entries(themes).find(
    ([, url]) => typeof url === "string" && url.trim(),
  );
  if (!entry) return undefined;
  const [themeId, url] = entry;
  const thumb = normalizeMediaUrl(url);
  if (!thumb) return undefined;
  return {
    id: themeId,
    name: titleCaseTheme(themeId),
    thumbnailUrl: thumb,
  };
}

function displayNameOf(model: BackendModel): string {
  return (
    model.influencerName?.trim() ||
    model.label?.trim() ||
    model.id?.trim() ||
    "Creator"
  );
}

export function followedCreatorFromModel(
  model: BackendModel,
  followedAt = Date.now(),
): FollowedCreator | null {
  const id = (model.id ?? "").trim();
  if (!id) return null;
  const displayName = displayNameOf(model);
  const handleRaw = (model.label ?? model.id ?? "").trim();
  const username = handleRaw ? formatSocialHandle(handleRaw) : "";
  const avatarUrl = normalizeMediaUrl(model.avatar ?? "") || "/img/placeholder.png";
  return {
    id,
    displayName,
    username,
    avatarUrl,
    followedAt,
    // lastActiveAt omitted — never invent activity timestamps
    hasUnseenActivity: false,
    currentCollection: collectionFromModel(model),
  };
}

export function listFollowing(): FollowedCreator[] {
  return read();
}

export function followingCount(): number {
  return read().length;
}

export function isFollowing(creatorId: string): boolean {
  const id = creatorId.trim();
  return read().some((entry) => entry.id === id);
}

export function followCreator(creator: FollowedCreator) {
  const items = read().filter((entry) => entry.id !== creator.id);
  items.unshift({
    ...creator,
    followedAt: creator.followedAt || Date.now(),
    hasUnseenActivity: Boolean(creator.hasUnseenActivity),
  });
  write(items);
  markSeededOnce();
}

export function unfollowCreator(creatorId: string) {
  const id = creatorId.trim();
  write(read().filter((entry) => entry.id !== id));
}

/** Clear unseen badge after opening the creator (local only). */
export function markFollowingCreatorSeen(creatorId: string) {
  const id = creatorId.trim();
  const items = read();
  let changed = false;
  const next = items.map((entry) => {
    if (entry.id !== id || !entry.hasUnseenActivity) return entry;
    changed = true;
    return { ...entry, hasUnseenActivity: false };
  });
  if (changed) write(next);
}

export function sortFollowing(
  items: readonly FollowedCreator[],
  sort: FollowingSort,
): FollowedCreator[] {
  const copy = [...items];
  switch (sort) {
    case "name":
      return copy.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: "base",
        }),
      );
    case "recently-followed":
      return copy.sort((a, b) => b.followedAt - a.followedAt);
    case "recent":
    default: {
      // Prefer real lastActiveAt; fall back to followedAt (never invent activity).
      return copy.sort((a, b) => {
        const aT = a.lastActiveAt ?? a.followedAt;
        const bT = b.lastActiveAt ?? b.followedAt;
        return bT - aT;
      });
    }
  }
}

export function recentlyActiveCreators(
  items: readonly FollowedCreator[],
  now = Date.now(),
): FollowedCreator[] {
  return items
    .filter((entry) => {
      if (entry.hasUnseenActivity) return true;
      const t = entry.lastActiveAt;
      if (typeof t !== "number" || !Number.isFinite(t)) return false;
      return now - t <= RECENTLY_ACTIVE_MS;
    })
    .sort((a, b) => {
      if (Boolean(a.hasUnseenActivity) !== Boolean(b.hasUnseenActivity)) {
        return a.hasUnseenActivity ? -1 : 1;
      }
      const aT = a.lastActiveAt ?? a.followedAt;
      const bT = b.lastActiveAt ?? b.followedAt;
      return bT - aT;
    });
}

/**
 * One-shot demo seed from live models. Never re-seeds after unfollow-all
 * (flag: sugar.v8.creatorFollowing.seeded.<userId>).
 */
export async function hydrateFollowingFromModelsIfEmpty(): Promise<
  FollowedCreator[]
> {
  const existing = read();
  if (existing.length > 0) {
    markSeededOnce();
    return existing;
  }
  if (hasSeededOnce()) return [];
  if (!isDemoMode()) return [];

  try {
    const models = await fetchModels();
    const now = Date.now();
    const seeded: FollowedCreator[] = [];
    for (let i = 0; i < models.length && seeded.length < 6; i++) {
      const creator = followedCreatorFromModel(models[i]!, now - i * 86_400_000);
      if (creator) seeded.push(creator);
    }
    markSeededOnce();
    if (seeded.length) write(seeded);
    return seeded;
  } catch {
    return [];
  }
}
