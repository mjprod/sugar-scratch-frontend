/**
 * Creator screen board — prices, ownership, and free-play for the signed-in player.
 * Catalog still supplies art. This endpoint supplies the tier fields the catalog omits.
 */

import { apiFetch } from "../lib/api";

export type BoardCardStatus = "locked" | "unlocked";

export type BoardStaticCard = {
  id: string;
  slotId: string;
  price: number;
  owned: boolean;
  unlocked: boolean;
  freePlayable: boolean;
};

export type BoardMotionCard = {
  id: string;
  price: number;
  status: BoardCardStatus;
  freePlayable: boolean;
  staticCardsOwned: number;
  staticCardsTotal: number;
  staticCards: BoardStaticCard[];
};

export type BoardPremiumCard = {
  id: string;
  price: number;
  replayPrice: number;
  maxWin: number;
  unlocked: boolean;
  freePlayable: boolean;
};

export type CreatorBoard = {
  creator: {
    id: string;
    name: string;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    xUrl: string | null;
    onlyfansUrl: string | null;
    joinedAt: number;
  };
  pack: { id: string; price: number } | null;
  motionCardsOwned: number;
  totalMotionCardsOwned: number;
  themes: Array<{
    id: string;
    label: string;
    motionCards: BoardMotionCard[];
    premium: BoardPremiumCard | null;
  }>;
  ultra: BoardPremiumCard | null;
};

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function urlOrNull(value: unknown): string | null {
  const url = str(value);
  return url || null;
}

function parseStatic(raw: unknown): BoardStaticCard | null {
  if (!raw || typeof raw !== "object") return null;
  const card = raw as Partial<BoardStaticCard>;
  const id = str(card.id);
  if (!id) return null;
  return {
    id,
    slotId: str(card.slotId),
    price: num(card.price),
    owned: Boolean(card.owned),
    unlocked: Boolean(card.unlocked),
    freePlayable: Boolean(card.freePlayable),
  };
}

function parseMotion(raw: unknown): BoardMotionCard | null {
  if (!raw || typeof raw !== "object") return null;
  const card = raw as Partial<BoardMotionCard>;
  const id = str(card.id);
  if (!id) return null;
  return {
    id,
    price: num(card.price),
    status: card.status === "unlocked" ? "unlocked" : "locked",
    freePlayable: Boolean(card.freePlayable),
    staticCardsOwned: num(card.staticCardsOwned),
    staticCardsTotal: Math.max(0, num(card.staticCardsTotal)),
    staticCards: Array.isArray(card.staticCards)
      ? card.staticCards.flatMap((entry) => {
          const parsed = parseStatic(entry);
          return parsed ? [parsed] : [];
        })
      : [],
  };
}

function parsePremium(raw: unknown): BoardPremiumCard | null {
  if (!raw || typeof raw !== "object") return null;
  const card = raw as Partial<BoardPremiumCard>;
  const id = str(card.id);
  if (!id) return null;
  return {
    id,
    price: num(card.price),
    replayPrice: num(card.replayPrice),
    maxWin: num(card.maxWin),
    unlocked: Boolean(card.unlocked),
    freePlayable: Boolean(card.freePlayable),
  };
}

export function parseCreatorBoard(raw: unknown): CreatorBoard | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Partial<CreatorBoard>;
  const creator = body.creator;
  if (!creator || typeof creator !== "object" || !str(creator.id)) return null;
  const pack = body.pack;
  return {
    creator: {
      id: str(creator.id),
      name: str(creator.name),
      instagramUrl: urlOrNull(creator.instagramUrl),
      tiktokUrl: urlOrNull(creator.tiktokUrl),
      xUrl: urlOrNull(creator.xUrl),
      onlyfansUrl: urlOrNull(creator.onlyfansUrl),
      joinedAt: num(creator.joinedAt),
    },
    pack:
      pack && typeof pack === "object" && str(pack.id)
        ? { id: str(pack.id), price: num(pack.price) }
        : null,
    motionCardsOwned: num(body.motionCardsOwned),
    totalMotionCardsOwned: num(body.totalMotionCardsOwned),
    themes: Array.isArray(body.themes)
      ? body.themes.flatMap((theme) => {
          if (!theme || typeof theme !== "object" || !str(theme.id)) return [];
          return [
            {
              id: str(theme.id),
              label: str(theme.label),
              motionCards: Array.isArray(theme.motionCards)
                ? theme.motionCards.flatMap((card) => {
                    const parsed = parseMotion(card);
                    return parsed ? [parsed] : [];
                  })
                : [],
              premium: parsePremium(theme.premium),
            },
          ];
        })
      : [],
    ultra: parsePremium(body.ultra),
  };
}

export async function fetchCreatorBoard(
  creatorId: string,
): Promise<CreatorBoard | null> {
  const id = creatorId.trim();
  if (!id) return null;
  const data = await apiFetch<unknown>(
    `/api/me/creators/${encodeURIComponent(id)}/board`,
  );
  return parseCreatorBoard(data);
}

export type CollectionProgressCounts = {
  staticOwned: number;
  staticTotal: number;
  motionOwned: number;
  motionTotal: number;
  ultraOwned: number;
  ultraTotal: number;
  owned: number;
  total: number;
  pct: number;
};

const EMPTY_PROGRESS: CollectionProgressCounts = {
  staticOwned: 0,
  staticTotal: 0,
  motionOwned: 0,
  motionTotal: 0,
  ultraOwned: 0,
  ultraTotal: 0,
  owned: 0,
  total: 0,
  pct: 0,
};

/**
 * Same numbers as the creator Collection Progress bars.
 * Images = owned static cards. Layers = unlocked motion cards plus one Premium
 * slot per theme. Sparkles = the creator Ultra card. Total cannot be 100%
 * until Ultra is unlocked, even when the board still sends ultra: null.
 */
export function collectionProgressFromBoard(
  board: CreatorBoard | null | undefined,
): CollectionProgressCounts {
  if (!board) return EMPTY_PROGRESS;

  let staticOwned = 0;
  let staticTotal = 0;
  let motionOwned = 0;
  let motionTotal = 0;

  for (const theme of board.themes) {
    motionOwned += theme.motionCards.filter(
      (card) => card.status === "unlocked",
    ).length;
    motionOwned += theme.premium?.unlocked ? 1 : 0;
    motionTotal += theme.motionCards.length + 1;

    for (const card of theme.motionCards) {
      staticOwned += Math.max(
        card.staticCards.filter((slot) => slot.owned).length,
        card.staticCardsOwned,
      );
      staticTotal += card.staticCardsTotal || card.staticCards.length;
    }
  }

  const ultraOwned = board.ultra?.unlocked ? 1 : 0;
  const owned = staticOwned + motionOwned + ultraOwned;
  const total = staticTotal + motionTotal + 1;

  return {
    staticOwned,
    staticTotal,
    motionOwned,
    motionTotal,
    ultraOwned,
    ultraTotal: 1,
    owned,
    total,
    pct: total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0,
  };
}

const boardPromises = new Map<string, Promise<CreatorBoard | null>>();

/** One in-flight board fetch per creator, shared by the collection cards. */
export function loadCreatorBoard(creatorId: string): Promise<CreatorBoard | null> {
  const id = creatorId.trim();
  if (!id) return Promise.resolve(null);
  let pending = boardPromises.get(id);
  if (!pending) {
    pending = fetchCreatorBoard(id).catch(() => null);
    boardPromises.set(id, pending);
  }
  return pending;
}
