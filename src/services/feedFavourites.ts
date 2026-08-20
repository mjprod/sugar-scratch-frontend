import type { HomeFeedCreator } from "./creatorFeed";

const KEY = "sugar.v8.feedFavourites";

export type FeedFavourite = {
  id: string;
  creatorId: string;
  creatorName: string;
  packName: string;
  posterUrl: string;
  videoUrl?: string;
  mediaType: "video" | "image";
  savedAt: number;
};

function favouriteId(item: { id: string; creatorId: string }) {
  return item.creatorId || item.id;
}

function read(): FeedFavourite[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedFavourite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: FeedFavourite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
}

export function listFeedFavourites(): FeedFavourite[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

export function isFeedFavourite(item: { id: string; creatorId: string }) {
  const id = favouriteId(item);
  return read().some((entry) => entry.id === id);
}

export function addFeedFavourite(item: HomeFeedCreator) {
  const id = favouriteId(item);
  const items = read().filter((entry) => entry.id !== id);
  items.unshift({
    id,
    creatorId: item.creatorId,
    creatorName: item.creatorName,
    packName: item.packName,
    posterUrl: item.posterUrl,
    videoUrl: item.videoUrl,
    mediaType: item.mediaType,
    savedAt: Date.now(),
  });
  write(items);
}

export function removeFeedFavourite(item: { id: string; creatorId: string }) {
  const id = favouriteId(item);
  write(read().filter((entry) => entry.id !== id));
}

export function withFavouriteLikes(items: HomeFeedCreator[]): HomeFeedCreator[] {
  const ids = new Set(read().map((entry) => entry.id));
  return items.map((item) => ({
    ...item,
    liked: ids.has(favouriteId(item)),
  }));
}
