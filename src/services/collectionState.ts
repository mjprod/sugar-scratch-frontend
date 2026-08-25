/**
 * Persistent Collection ledger — revealed cards + started creators.
 * Pack inventory + ready-to-scratch remain source of pending ownership.
 */
import {
  resolveCollectionThemeLabel,
  canonicalThemeKey,
  type CreatorProgress,
} from "./collection";
import {
  countOwnedPacks,
  countUnopened,
  listOwnedPacks,
} from "./packInventory";
import { CREATOR_PHOTOS } from "../lib/photos";
import { listStoredGameSessions } from "@/features/game/modules/gameSession";
import { listReadyToScratch } from "./readyToScratch";
import {
  creatorHasAnyThemeCompletionClaim,
  isThemeCompletionClaimed,
} from "./themeCompletionReward";
import { apiFetch } from "../lib/api";

type CreatorLedger = {
  id: string;
  name: string;
  collected: number;
  total: number;
  lastActiveAt: number;
  /** Most recent theme / pack collection name, when known. */
  themeName?: string;
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


function countReadyPhotoScratch(): number {
  return listStoredGameSessions().reduce((total, session) => {
    if (session.phase !== "photo_reveal" && session.phase !== "photo") {
      return total;
    }
    const won = session.wonPhotoIds ?? [];
    const done = session.completedPhotoIds ?? [];
    return total + won.filter((id) => !done.includes(id)).length;
  }, 0);
}

/** Mid-session motion left when readyToScratch inventory hasn't caught up. */
function countOrphanMotionFromSession(): number {
  const shelfIds = new Set(listReadyToScratch().map((group) => group.id));
  return listStoredGameSessions().reduce((total, session) => {
    if (session.phase !== "motion") return total;
    const remaining = (session.motionCardIds ?? []).filter(
      (id) => !(session.completedMotionIds ?? []).includes(id),
    );
    if (remaining.length === 0) return total;
    const packId = session.packScratch?.readyPackId;
    if (packId && shelfIds.has(packId)) return total;
    return total + remaining.length;
  }, 0);
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

function themeLabelFromPack(
  themeName?: string,
  packName?: string,
  catalogPackId?: string,
  creator?: string,
): string {
  return resolveCollectionThemeLabel({
    themeName,
    packName,
    catalogPackId,
    creator,
  });
}

/** Mark a Creator as started (e.g. after first Pack purchase). */
export function noteCreatorStarted(
  creatorId: string,
  creatorName: string,
  themeName?: string,
) {
  const id = creatorId || slugId(creatorName);
  const ledger = readLedger();
  const theme = themeLabelFromPack(themeName);
  const existing = ledger.creators[id];
  if (existing) {
    existing.lastActiveAt = Date.now();
    existing.name = creatorName || existing.name;
    if (theme) existing.themeName = theme;
  } else {
    ledger.creators[id] = {
      id,
      name: creatorName,
      collected: 0,
      total: 15,
      lastActiveAt: Date.now(),
      themeName: theme || undefined,
    };
  }
  writeLedger(ledger);
}

/** Record newly revealed cards into Collection Summary stats. */
export function recordRevealedCards(input: {
  count: number;
  creatorId: string;
  creatorName: string;
  themeName?: string;
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
  const theme = themeLabelFromPack(input.themeName);
  const existing = ledger.creators[id];
  if (existing) {
    existing.collected = Math.min(
      existing.total,
      existing.collected + input.count,
    );
    existing.lastActiveAt = Date.now();
    existing.name = input.creatorName || existing.name;
    if (theme) existing.themeName = theme;
  } else {
    const total = 15;
    ledger.creators[id] = {
      id,
      name: input.creatorName,
      collected: Math.min(total, input.count),
      total,
      lastActiveAt: Date.now(),
      themeName: theme || undefined,
    };
  }
  writeLedger(ledger);
}

/** Photo Cards earned from a Motion Card win — owned before the result UI. */
export function recordWonPhotoCards(input: {
  count: number;
  creatorId: string;
  creatorName: string;
}) {
  if (input.count < 1) return;
  recordRevealedCards({
    count: input.count,
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    motionCount: 0,
  });
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
    /** Absolute revealed/collected card count — never a global denominator. */
    cardsCollected: number;
    /** Unique creators represented by collected cards. */
    creatorsCollectedFrom: number;
    /** Incomplete theme/sets with at least one collected card. */
    collectionsInProgress: number;
    /** Unclaimed theme-completion rewards (> 0 to show Reward Ready). */
    rewardReadyCount: number;
    /** @deprecated Prefer cardsCollected */
    collectedCards: number;
    /** @deprecated Removed from UI — kept for older callers. */
    totalCards: number;
    pct: number;
    creators: number;
    themes: number;
    uniqueCards: number;
    motionCards: number;
    photoCards: number;
  };
  continueCreators: CreatorProgress[];
};

function mergeStartedCreators(
  ledger: CollectionLedger,
): Record<string, CreatorLedger> {
  const creators: Record<string, CreatorLedger> = { ...ledger.creators };
  for (const pack of listOwnedPacks()) {
    const id = pack.creatorId || slugId(pack.creator);
    const theme = themeLabelFromPack(
      pack.themeName,
      pack.packName,
      pack.catalogPackId,
      pack.creator,
    );
    if (!creators[id]) {
      creators[id] = {
        id,
        name: pack.creator,
        collected: 0,
        total: 15,
        lastActiveAt: pack.savedAt,
        themeName: theme || undefined,
      };
    } else {
      const next = { ...creators[id] };
      if (pack.savedAt > next.lastActiveAt) {
        next.lastActiveAt = pack.savedAt;
        next.name = pack.creator || next.name;
      }
      if (theme && (!next.themeName || pack.savedAt >= next.lastActiveAt)) {
        next.themeName = theme;
      }
      creators[id] = next;
    }
  }
  return creators;
}

/** Live Collection page visibility + summary inputs. */
export function getCollectionPageState(): CollectionPageState {
  const owned = countOwnedPacks();
  const unopenedPackCount = countUnopened();
  const unscratchedCardCount =
    listReadyToScratch().reduce((sum, group) => sum + group.count, 0) +
    countOrphanMotionFromSession() +
    countReadyPhotoScratch();
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

  const ownedPacks = listOwnedPacks();
  const continueCreators: CreatorProgress[] = Object.values(creators)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .map((creator) => {
      const pct = Math.round(
        (creator.collected / Math.max(1, creator.total)) * 100,
      );
      const packTheme = ownedPacks
        .filter(
          (pack) =>
            (pack.creatorId || slugId(pack.creator)) === creator.id,
        )
        .sort((a, b) => b.savedAt - a.savedAt)
        .map((pack) =>
          themeLabelFromPack(
            pack.themeName,
            pack.packName,
            pack.catalogPackId,
            pack.creator,
          ),
        )
        .find(Boolean);
      const themeName =
        packTheme ||
        themeLabelFromPack(creator.themeName) ||
        undefined;
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
        themeName,
      };
    });

  const creatorsWithProgress = continueCreators.filter((c) => c.collected > 0);
  const collectionsInProgress = creatorsWithProgress.filter(
    (c) => c.collected < c.total,
  ).length;
  // Match claim ledger keys: theme-complete:${creatorId}:${themeId}
  // (never a fake "primary" id — that never gets written on claim).
  const rewardReadyCount = creatorsWithProgress.filter((c) => {
    if (!(c.collected >= c.total && c.total > 0)) return false;
    const themeId = canonicalThemeKey(c.themeName);
    if (themeId) return !isThemeCompletionClaimed(c.id, themeId);
    // No resolvable theme on the hub row — clear after any claim for this creator.
    return !creatorHasAnyThemeCompletionClaim(c.id);
  }).length;

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
      cardsCollected: collectedCardCount,
      creatorsCollectedFrom: creatorsWithProgress.length,
      collectionsInProgress,
      rewardReadyCount,
      collectedCards: collectedCardCount,
      totalCards: 0,
      pct: 0,
      creators: creatorsWithProgress.length,
      themes: collectionsInProgress,
      uniqueCards: collectedCardCount,
      motionCards: ledger.motionCards,
      photoCards: ledger.photoCards,
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
