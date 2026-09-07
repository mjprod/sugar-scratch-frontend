import { catalogMotionIdFromRevealId } from "@/features/game/modules/session";
import {
  loadGameSession,
  saveGameSession,
  themeForMotionCard,
  type GameSession,
} from "@/features/game/modules/gameSession";
import { fetchCatalogMotionCards } from "@/features/game/shared/catalog";
import { recordRevealedCards } from "@/services/collectionState";
import { packHistoryIds, recordGameReveal } from "@/services/gameHistory";
import { revealPackCard } from "@/services/purchase";
import {
  getReadyToScratch,
  upsertReadyToScratch,
} from "@/services/readyToScratch";

export const PACK_OPENING_REWARD_EVENT = "sugar:pack-opening-reward";

export type PackOpeningRewardDetail = {
  coins?: number;
  cards?: number;
  wallet?: { diamonds: number; coins: number };
};

export type PackMotionSettleResult = {
  ok: boolean;
  session: GameSession | null;
};

function persistPackMotionSettle(
  session: GameSession,
  openingId: string,
): GameSession {
  const { packScratch } = session;
  if (!packScratch) return session;

  const ready = getReadyToScratch(packScratch.readyPackId);
  const revealed = [...new Set([...(ready?.revealed ?? []), openingId])];
  upsertReadyToScratch({
    packId: packScratch.readyPackId,
    packName: packScratch.packName,
    creator: packScratch.creator,
    session: packScratch.openingSession,
    revealed,
    coverUrl: packScratch.coverUrl,
    themeName: packScratch.themeName,
  });

  const next: GameSession = {
    ...session,
    packScratch: {
      ...packScratch,
      settledOpeningIds: [...packScratch.settledOpeningIds, openingId],
    },
  };
  saveGameSession(next);
  return next;
}

function slugCreatorId(creator: string) {
  return creator.trim().toLowerCase().replace(/\s+/g, "-");
}

async function appendGameHistoryFromSettle(
  session: GameSession,
  motionCardId: string,
  openingId: string,
  rewardCoins: number,
) {
  const { packScratch } = session;
  if (!packScratch) return;
  const card = packScratch.openingSession.cards.find(
    (entry) => entry.id === openingId,
  );
  const creatorId = slugCreatorId(packScratch.creator);
  const historyIds = packHistoryIds(packScratch.readyPackId);
  const revealSessionId = packScratch.serverOpeningId
    ? `${packScratch.serverOpeningId}:${openingId}`
    : `${packScratch.readyPackId}:${openingId}`;

  let cardName = card?.rarity ? `${card.rarity} Card` : "Card";
  let cardImageUrl = card?.faceUrl;
  try {
    const motionId = catalogMotionIdFromRevealId(motionCardId);
    const motion = (await fetchCatalogMotionCards()).find(
      (entry) => entry.id === motionCardId || entry.id === motionId,
    );
    if (motion) {
      cardName = motion.label;
      cardImageUrl = motion.bottom || motion.foreground || cardImageUrl;
    } else {
      const theme = themeForMotionCard(session, motionCardId)?.trim();
      if (theme) cardName = theme;
    }
  } catch {
    const theme = themeForMotionCard(session, motionCardId)?.trim();
    if (theme) cardName = theme;
  }

  recordGameReveal({
    cardId: motionCardId || openingId,
    cardName,
    cardImageUrl,
    packInstanceId: historyIds.packInstanceId,
    packId: historyIds.packId,
    packName: packScratch.packName,
    creatorId,
    creatorName: packScratch.creator,
    rewardCoins,
    revealSessionId,
    purchaseTransactionId: historyIds.purchaseTransactionId,
  });
}

/** Settle one opening card when its linked motion card finishes (idempotent). */
export async function settlePackMotionCard(
  motionCardId: string,
): Promise<PackMotionSettleResult> {
  const session = loadGameSession();
  if (!session?.packScratch) return { ok: true, session };

  const motionIndex = session.motionCardIds.indexOf(motionCardId);
  if (motionIndex < 0) return { ok: true, session };

  const openingId = session.packScratch.openingCardIds[motionIndex];
  if (!openingId) return { ok: true, session };
  if (session.packScratch.settledOpeningIds.includes(openingId)) {
    return { ok: true, session };
  }

  const { packScratch } = session;
  const serverOpeningId = packScratch.serverOpeningId?.trim();
  const serverCardId = packScratch.serverRevealCardIds?.[motionIndex]?.trim();

  if (serverOpeningId && serverCardId) {
    try {
      const result = await revealPackCard(serverOpeningId, serverCardId);
      recordRevealedCards({
        count: 1,
        creatorId: slugCreatorId(packScratch.creator),
        creatorName: packScratch.creator,
        themeName: packScratch.themeName || packScratch.packName,
      });
      const openingCard = packScratch.openingSession.cards.find(
        (entry) => entry.id === openingId,
      );
      await appendGameHistoryFromSettle(
        session,
        motionCardId,
        openingId,
        result.card.reward ?? openingCard?.reward ?? 0,
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<PackOpeningRewardDetail>(PACK_OPENING_REWARD_EVENT, {
            detail: { cards: 1, wallet: result.wallet },
          }),
        );
      }
      return {
        ok: true,
        session: persistPackMotionSettle(session, openingId),
      };
    } catch {
      return { ok: false, session };
    }
  }

  const card = packScratch.openingSession.cards.find(
    (entry) => entry.id === openingId,
  );
  const coins = card?.reward ?? 0;

  recordRevealedCards({
    count: 1,
    creatorId: slugCreatorId(packScratch.creator),
    creatorName: packScratch.creator,
    themeName: packScratch.themeName || packScratch.packName,
  });
  await appendGameHistoryFromSettle(session, motionCardId, openingId, coins);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<PackOpeningRewardDetail>(PACK_OPENING_REWARD_EVENT, {
        detail: { coins, cards: 1 },
      }),
    );
  }

  return {
    ok: true,
    session: persistPackMotionSettle(session, openingId),
  };
}
