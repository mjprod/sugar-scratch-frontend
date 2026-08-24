import type { CardConfig } from "@/features/collection/lib/cards";
import type { ThemeCardData, ThemeDetailData } from "@/services/collection";

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

export const PREVIEW_LIMIT = 10;

/** Photo slots per motion card — mirrors PHOTO_SLOTS in features/collection. */
const SLOTS_PER_MOTION_CARD = 10;

const THEME_GLYPH: Record<string, string> = {
  firegirl: "🔥",
  firefighter: "🔥",
  fire: "🔥",
  nurse: "✚",
  teacher: "📖",
  gym: "🏋",
  police: "🚓",
  cop: "🚓",
  bikini: "☀",
  summer: "☀",
  casual: "✦",
  office: "💼",
  cyber: "⚡",
  midnight: "🌙",
};

export function themeGlyph(theme: Pick<ThemeCardData, "id" | "name">): string {
  const key = `${theme.id} ${theme.name}`.toLowerCase();
  for (const [id, glyph] of Object.entries(THEME_GLYPH)) {
    if (key.includes(id)) return glyph;
  }
  return "✦";
}

/** First N photo-slot cards across the theme's motion cards (preview only). */
export function buildCollectionPreviewCards(
  motionCards: readonly CardConfig[],
  limit = PREVIEW_LIMIT,
): CollectionPreviewCard[] {
  const out: CollectionPreviewCard[] = [];
  if (limit <= 0) return out;
  let sequence = 0;
  for (const card of motionCards) {
    const filled = Math.max(
      0,
      Math.min(SLOTS_PER_MOTION_CARD, card.photoFilledCount ?? 0),
    );
    const motionTeaser =
      card.mediaType === "image" && card.mediaUrl?.trim()
        ? card.mediaUrl.trim()
        : "";
    for (let slot = 0; slot < SLOTS_PER_MOTION_CARD; slot++) {
      sequence += 1;
      const slotUrl = card.photoUrls?.[slot]?.trim() || "";
      out.push({
        id: `${card.id}:slot:${slot}`,
        number: String(sequence).padStart(2, "0"),
        collected: slot < filled,
        thumbnailUrl: slotUrl || motionTeaser || undefined,
        motionCardId: card.id,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function buildPreviewFromThemeDetail(
  detail: ThemeDetailData | undefined,
  limit = PREVIEW_LIMIT,
): CollectionPreviewCard[] {
  if (!detail) return [];
  return detail.photoCards.slice(0, Math.max(0, limit)).map((card) => ({
    id: `${detail.themeId}-photo-${card.index}`,
    number: String(card.index).padStart(2, "0"),
    collected: card.isUnlocked,
    thumbnailUrl: card.thumbnailUrl || undefined,
    motionCardId: detail.motionCards[0]
      ? `${detail.themeId}-m${detail.motionCards[0].index}`
      : detail.themeId,
  }));
}
