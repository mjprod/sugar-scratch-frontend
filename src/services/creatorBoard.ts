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
