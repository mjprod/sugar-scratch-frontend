import type { HomeFeedCreator } from "./creatorFeed";
import { getAuthUserId } from "./auth";

const KEY_PREFIX = "sugar.v8.feedFavourites";

export type FeedFavourite = {
  /** Feed video instance id (includes page index suffix). */
  id: string;
  creatorId: string;
  creatorName: string;
  avatarUrl: string;
  packName: string;
  posterUrl: string;
  videoUrl?: string;
  mediaType: "video" | "image";
  savedAt: number;
};

function storageKey(): string | null {
  const userId = getAuthUserId();
  return userId ? `${KEY_PREFIX}.${userId}` : null;
}

function read(): FeedFavourite[] {
  const key = storageKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedFavourite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: FeedFavourite[]) {
  const key = storageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
}

export function listFeedFavourites(): FeedFavourite[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

export function isFeedFavourite(item: { id: string }) {
  return read().some((entry) => entry.id === item.id);
}

export function addFeedFavourite(item: HomeFeedCreator) {
  const items = read().filter((entry) => entry.id !== item.id);
  items.unshift({
    id: item.id,
    creatorId: item.creatorId,
    creatorName: item.creatorName,
    avatarUrl: item.avatarUrl || "",
    packName: item.packName,
    posterUrl: item.swipePosterUrl || item.avatarUrl || "",
    videoUrl: item.videoUrl,
    mediaType: item.mediaType,
    savedAt: Date.now(),
  });
  write(items);
}

export function removeFeedFavourite(item: { id: string }) {
  write(read().filter((entry) => entry.id !== item.id));
}

export function withFavouriteLikes(items: HomeFeedCreator[]): HomeFeedCreator[] {
  const ids = new Set(read().map((entry) => entry.id));
  return items.map((item) => ({
    ...item,
    liked: ids.has(item.id),
  }));
}
