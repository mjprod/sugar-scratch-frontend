import type { CardConfig } from "@/features/collection/lib/cards";
import {
  packItemToIteration,
  type Iteration,
} from "@/features/packs/types";
import { canonicalThemeKey } from "@/services/collection";

/** Profile coverflow: one motion clip per theme, in this order. */
export const PROFILE_THEME_MOTION_KEYS = [
  "nurse",
  "police",
  "teacher",
  "gym",
  "fire",
  "cowgirl",
  "egypt",
  "greekmythos",
] as const;

function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(src);
}

export function motionTileStillUrl(card: CardConfig): string {
  const poster = card.posterUrl?.trim() || "";
  if (poster && !isVideoSrc(poster)) return poster;
  if (card.mediaType === "image") {
    const media = card.mediaUrl?.trim() || "";
    if (media && !isVideoSrc(media) && !media.includes("placeholder")) return media;
  }
  const photo = card.photoUrls?.find((url) => url?.trim())?.trim() || "";
  if (photo) return photo;
  const id = card.id.trim();
  if (id && !id.includes("-placeholder-")) {
    return `/cards/${encodeURIComponent(id)}/motion-poster.webp`;
  }
  return "";
}

export function motionVideoUrl(card: CardConfig): string {
  const trailer = card.mediaUrl?.trim() || "";
  if (trailer && isVideoSrc(trailer)) return trailer;
  const motion = card.motionUrl?.trim() || "";
  return motion && isVideoSrc(motion) ? motion : "";
}

function cardToIteration(
  card: CardConfig,
  themeName: string,
  index: number,
): Iteration {
  const still = motionTileStillUrl(card);
  const video = motionVideoUrl(card);
  return packItemToIteration({
    id: card.id,
    characterId: card.modelId || card.id,
    name: themeName,
    modelUrl: "",
    modelName: themeName,
    videoUrl: video,
    posterUrl: still || undefined,
    price: 0,
    girlName: themeName,
    packNumber: index + 1,
    packName: themeName,
    flagEmoji: "",
    backgroundColor: "oklch(0.798 0.104 207.84)",
    backgroundImageUrl: still || undefined,
  });
}

function firstMotionCard(cards: CardConfig[]): CardConfig | null {
  return (
    cards.find((card) => {
      if (card.id.includes("-placeholder-")) return false;
      return Boolean(motionVideoUrl(card) || motionTileStillUrl(card));
    }) ?? null
  );
}

export type ProfileThemeMotionSlide = {
  item: Iteration;
  themeId: string;
  themeName: string;
};

/**
 * Pick one motion card per profile theme key from the live collection.
 * Skips themes that are missing or have no motion media yet.
 */
export function buildProfileThemeMotionSlides(
  themes: Array<{ id: string; name: string }>,
  cardsByThemeId: Record<string, CardConfig[]>,
): ProfileThemeMotionSlide[] {
  const byKey = new Map<string, { id: string; name: string }>();
  for (const theme of themes) {
    const key =
      canonicalThemeKey(theme.id) || canonicalThemeKey(theme.name);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, theme);
  }

  const slides: ProfileThemeMotionSlide[] = [];
  for (const wanted of PROFILE_THEME_MOTION_KEYS) {
    const theme = byKey.get(wanted);
    if (!theme) continue;
    const card = firstMotionCard(cardsByThemeId[theme.id] ?? []);
    if (!card) continue;
    slides.push({
      item: cardToIteration(card, theme.name, slides.length),
      themeId: theme.id,
      themeName: theme.name,
    });
  }
  return slides;
}
