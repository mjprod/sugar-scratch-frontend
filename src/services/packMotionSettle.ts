import {
  loadGameSession,
  saveGameSession,
  type GameSession,
} from "@/features/game/modules/gameSession";
import { recordRevealedCards } from "@/services/collectionState";
import {
  getReadyToScratch,
  upsertReadyToScratch,
} from "@/services/readyToScratch";

export const PACK_OPENING_REWARD_EVENT = "sugar:pack-opening-reward";

/** Settle one opening card when its linked motion card finishes (idempotent). */
export function settlePackMotionCard(motionCardId: string): GameSession | null {
  const session = loadGameSession();
  if (!session?.packScratch) return session;

  const motionIndex = session.motionCardIds.indexOf(motionCardId);
  if (motionIndex < 0) return session;

  const openingId = session.packScratch.openingCardIds[motionIndex];
  if (!openingId) return session;
  if (session.packScratch.settledOpeningIds.includes(openingId)) {
    return session;
  }

  const { packScratch } = session;
  const card = packScratch.openingSession.cards.find(
    (entry) => entry.id === openingId,
  );
  const coins = card?.reward ?? 0;

  recordRevealedCards({
    count: 1,
    creatorId: packScratch.creator.trim().toLowerCase().replace(/\s+/g, "-"),
    creatorName: packScratch.creator,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PACK_OPENING_REWARD_EVENT, {
        detail: { coins, cards: 1 },
      }),
    );
  }

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
