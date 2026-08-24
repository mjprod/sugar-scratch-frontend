import type { CardConfig } from "@/features/collection/lib/cards";
import type { ThemeDetailData } from "@/services/collection";

export type CollectionPreviewCard = {
  id: string;
  number: string;
  collected: boolean;
  /**
   * Artwork for this slot. Collected → full reveal.
   * Uncollected → same asset rendered as a blurred/dark teaser (unique per card).
   */
  thumbnailUrl?: string;
  motionCardId: string;
};

export const COLLECTION_PREVIEW_LIMIT = 10;

/** First N photo-slot cards across the theme's motion cards (preview only). */
export function buildCollectionPreviewCards(
  motionCards: readonly CardConfig[],
  limit = COLLECTION_PREVIEW_LIMIT,
): CollectionPreviewCard[] {
  const out: CollectionPreviewCard[] = [];
  let sequence = 0;
  for (const card of motionCards) {
    const filled = Math.max(0, Math.min(10, card.photoFilledCount ?? 0));
    const motionTeaser =
      card.mediaType === "image" && card.mediaUrl?.trim()
        ? card.mediaUrl.trim()
        : "";
    for (let slot = 0; slot < 10; slot++) {
      sequence += 1;
      const collected = slot < filled;
      const slotUrl = card.photoUrls?.[slot]?.trim() || "";
      const thumbnailUrl = slotUrl || motionTeaser || undefined;
      out.push({
        id: `${card.id}:slot:${slot}`,
        number: String(sequence).padStart(2, "0"),
        collected,
        thumbnailUrl,
        motionCardId: card.id,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function buildPreviewFromThemeDetail(
  detail: ThemeDetailData | undefined,
  limit = COLLECTION_PREVIEW_LIMIT,
): CollectionPreviewCard[] {
  if (!detail) return [];
  return detail.photoCards.slice(0, limit).map((card) => ({
    id: `${detail.themeId}-photo-${card.index}`,
    number: String(card.index).padStart(2, "0"),
    collected: card.isUnlocked,
    thumbnailUrl: card.thumbnailUrl || undefined,
    motionCardId: detail.motionCards[0]
      ? `${detail.themeId}-m${detail.motionCards[0].index}`
      : detail.themeId,
  }));
}
