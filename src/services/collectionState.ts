/**
 * Persistent Collection ledger — revealed cards + started creators.
 * Pack inventory + ready-to-scratch remain source of pending ownership.
 */
import type { CreatorProgress } from "./collection";
import {
  countOwnedPacks,
  countUnopened,
  listOwnedPacks,
} from "./packInventory";
import { CREATOR_PHOTOS } from "../lib/photos";
import { listReadyToScratch } from "./readyToScratch";
import { apiFetch } from "../lib/api";

type CreatorLedger = {
  id: string;
  name: string;
  collected: number;
  total: number;
  lastActiveAt: number;
};

type CollectionLedger = {
  collectedCardCount: number;
  motionCards: number;
  photoCards: number;
  creators: Record<string, CreatorLedger>;
};

const KEY = "sugar.v8.collectionLedger";

function emptyLedger(): CollectionLedger {
  return {
    collectedCardCount: 0,
    motionCards: 0,
    photoCards: 0,
    creators: {},
  };
}

function readLedger(): CollectionLedger {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyLedger();
    const parsed = JSON.parse(raw) as Partial<CollectionLedger>;
    return {
      collectedCardCount: Number(parsed.collectedCardCount) || 0,
      motionCards: Number(parsed.motionCards) || 0,
      photoCards: Number(parsed.photoCards) || 0,
      creators:
        parsed.creators && typeof parsed.creators === "object"
          ? parsed.creators
          : {},
    };
  } catch {
    return emptyLedger();
  }
}

function writeLedger(ledger: CollectionLedger) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    /* storage unavailable */
  }
}

function slugId(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-") || "creator";
}

function avatarFor(creatorId: string, name: string) {
  const key = creatorId.toLowerCase();
  const byKey = (CREATOR_PHOTOS as Record<string, { avatar: string }>)[key];
  if (byKey?.avatar) return byKey.avatar;
  const nameKey = name.trim().toLowerCase();
  const match = Object.entries(CREATOR_PHOTOS).find(
    ([id, photo]) =>
      id === nameKey || photo.avatar.toLowerCase().includes(nameKey),
  );
  return match?.[1].avatar ?? Object.values(CREATOR_PHOTOS)[0]?.avatar ?? "";
}

/** Mark a Creator as started (e.g. after first Pack purchase). */
export function noteCreatorStarted(creatorId: string, creatorName: string) {
  const id = creatorId || slugId(creatorName);
  const ledger = readLedger();
  const existing = ledger.creators[id];
  if (existing) {
    existing.lastActiveAt = Date.now();
    existing.name = creatorName || existing.name;
  } else {
    ledger.creators[id] = {
      id,
      name: creatorName,
      collected: 0,
      total: 15,
      lastActiveAt: Date.now(),
    };
  }
  writeLedger(ledger);
}

/** Record newly revealed cards into Collection Summary stats. */
export function recordRevealedCards(input: {
  count: number;
  creatorId: string;
  creatorName: string;
  /** Defaults: ~1/3 motion, rest photo — demo split until rarity metadata exists. */
  motionCount?: number;
}) {
  if (input.count < 1) return;
  const ledger = readLedger();
  const motion = Math.min(
    input.count,
    input.motionCount ?? Math.max(0, Math.round(input.count / 3)),
  );
  const photo = input.count - motion;
  ledger.collectedCardCount += input.count;
  ledger.motionCards += motion;
  ledger.photoCards += photo;

  const id = input.creatorId || slugId(input.creatorName);
  const existing = ledger.creators[id];
  if (existing) {
    existing.collected = Math.min(
      existing.total,
      existing.collected + input.count,
    );
    existing.lastActiveAt = Date.now();
    existing.name = input.creatorName || existing.name;
  } else {
    const total = 15;
    ledger.creators[id] = {
      id,
      name: input.creatorName,
      collected: Math.min(total, input.count),
      total,
      lastActiveAt: Date.now(),
    };
  }
  writeLedger(ledger);
}

export type CollectionPageState = {
  totalPurchasedPacks: number;
  unopenedPackCount: number;
  unscratchedCardCount: number;
  collectedCardCount: number;
  hasEverPurchasedPack: boolean;
  hasCollectedCards: boolean;
  hasUnopenedPacks: boolean;
  hasUnscratchedCards: boolean;
  hasPendingReveal: boolean;
  isTrueEmpty: boolean;
  hasStartedCollection: boolean;
  summary: {
    uniqueCards: number;
    motionCards: number;
    photoCards: number;
    creators: number;
  };
  continueCreators: CreatorProgress[];
};

function mergeStartedCreators(
  ledger: CollectionLedger,
): Record<string, CreatorLedger> {
  const creators: Record<string, CreatorLedger> = { ...ledger.creators };
  for (const pack of listOwnedPacks()) {
    const id = pack.creatorId || slugId(pack.creator);
    if (!creators[id]) {
      creators[id] = {
        id,
        name: pack.creator,
        collected: 0,
        total: 15,
        lastActiveAt: pack.savedAt,
      };
    } else if (pack.savedAt > creators[id].lastActiveAt) {
      creators[id] = {
        ...creators[id],
        lastActiveAt: pack.savedAt,
        name: pack.creator || creators[id].name,
      };
    }
  }
  return creators;
}

/** Live Collection page visibility + summary inputs. */
export function getCollectionPageState(): CollectionPageState {
  const owned = countOwnedPacks();
  const unopenedPackCount = countUnopened();
  const unscratchedCardCount = listReadyToScratch().reduce(
    (sum, group) => sum + group.count,
    0,
  );
  const ledger = readLedger();
  const creators = mergeStartedCreators(ledger);

  const collectedCardCount = ledger.collectedCardCount;
  const hasEverPurchasedPack = owned > 0;
  const hasCollectedCards = collectedCardCount > 0;
  const hasUnopenedPacks = unopenedPackCount > 0;
  const hasUnscratchedCards = unscratchedCardCount > 0;
  const hasPendingReveal = hasUnopenedPacks || hasUnscratchedCards;
  const isTrueEmpty =
    owned === 0 &&
    collectedCardCount === 0 &&
    unopenedPackCount === 0 &&
    unscratchedCardCount === 0;

  const continueCreators: CreatorProgress[] = Object.values(creators)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .map((creator) => {
      const pct = Math.round(
        (creator.collected / Math.max(1, creator.total)) * 100,
      );
      return {
        id: creator.id,
        name: creator.name,
        avatarUrl: avatarFor(creator.id, creator.name),
        coverUrl: avatarFor(creator.id, creator.name),
        collected: creator.collected,
        total: creator.total,
        pct,
        themesStarted: creator.collected > 0 ? 1 : 0,
        themesTotal: 5,
        cta: "continue" as const,
      };
    });

  return {
    totalPurchasedPacks: owned,
    unopenedPackCount,
    unscratchedCardCount,
    collectedCardCount,
    hasEverPurchasedPack,
    hasCollectedCards,
    hasUnopenedPacks,
    hasUnscratchedCards,
    hasPendingReveal,
    isTrueEmpty,
    hasStartedCollection: hasEverPurchasedPack,
    summary: {
      uniqueCards: ledger.collectedCardCount,
      motionCards: ledger.motionCards,
      photoCards: ledger.photoCards,
      creators: Object.values(creators).filter((c) => c.collected > 0).length,
    },
    continueCreators,
  };
}

export function clearCollectionLedger() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchCollectionPageStateRemote() {
  return apiFetch<CollectionPageState>("/api/me/collection");
}
