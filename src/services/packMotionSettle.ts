import {
  loadGameSession,
  saveGameSession,
  type GameSession,
} from "@/features/game/modules/gameSession";
import { recordRevealedCards } from "@/services/collectionState";
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
        creatorId: packScratch.creator.trim().toLowerCase().replace(/\s+/g, "-"),
        creatorName: packScratch.creator,
        themeName: packScratch.themeName || packScratch.packName,
      });
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
    creatorId: packScratch.creator.trim().toLowerCase().replace(/\s+/g, "-"),
    creatorName: packScratch.creator,
    themeName: packScratch.themeName || packScratch.packName,
  });

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
