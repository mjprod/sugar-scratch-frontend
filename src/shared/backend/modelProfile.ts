import {
  CARD_BACK_URL,
  DEFAULT_OVERLAY_BACKGROUND_COLOR,
  DEFAULT_OVERLAY_BACKGROUND_COLOR_END,
  DEFAULT_SWIPE_VIDEO_URL,
  formatSocialHandle,
} from "@/shared/catalog/characters";
import type { SwipeCardData } from "@/features/swipe/constants/cards";
import { normalizeMediaUrl, type BackendModel } from "./collection";

function optionalApiString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function optionalApiMediaUrl(value: unknown): string | null {
  const raw = optionalApiString(value);
  if (!raw) return null;
  const normalized = normalizeMediaUrl(raw);
  return normalized || null;
}

export function modelDisplayName(model: BackendModel): string {
  return (
    optionalApiString(model.influencerName) ??
    optionalApiString(model.label) ??
    optionalApiString(model.id) ??
    "Model"
  );
}

/**
 * Home / recommend swipe deck: one card per `/api/models` entry.
 * Older models first so established profiles lead the stack.
 */
export function createSwipeDeckFromModels(
  models: readonly BackendModel[],
): SwipeCardData[] {
  if (!models.length) return [];

  const ordered = [...models].sort((a, b) => {
    const aCreated =
      typeof a.created_at === "number" && Number.isFinite(a.created_at)
        ? a.created_at
        : Number.POSITIVE_INFINITY;
    const bCreated =
      typeof b.created_at === "number" && Number.isFinite(b.created_at)
        ? b.created_at
        : Number.POSITIVE_INFINITY;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return modelDisplayName(a).localeCompare(modelDisplayName(b));
  });

  return ordered.map((model, index) => {
    const name = modelDisplayName(model);
    const swipeUrl =
      optionalApiMediaUrl(model.swipeVideoUrl) || DEFAULT_SWIPE_VIDEO_URL;
    const posterUrl =
      optionalApiMediaUrl(model.swipePosterUrl) ||
      optionalApiMediaUrl(model.avatar) ||
      undefined;
    const handleRaw =
      optionalApiString(model.label) ?? optionalApiString(model.id);
    const handle = handleRaw ? formatSocialHandle(handleRaw) : "";
    const colorStart = optionalApiString(model.cardOverlayColorStart);
    const colorEnd = optionalApiString(model.cardOverlayColorEnd);

    return {
      id: `swipe-model-${model.id || index + 1}`,
      modelId: optionalApiString(model.id) || undefined,
      name,
      socialhandle: handle,
      mediaType: "video" as const,
      mediaUrl: swipeUrl,
      posterUrl,
      backUrl: CARD_BACK_URL,
      overlay: {
        name,
        city: optionalApiString(model.influencerCity) ?? "",
        country: optionalApiString(model.influencerCountry) ?? "",
        flagEmoji: optionalApiString(model.influencerFlag) ?? "",
        flagSvgUrl: optionalApiMediaUrl(model.influencerFlagSvg) ?? "",
        gradientColor: colorStart || DEFAULT_OVERLAY_BACKGROUND_COLOR,
        gradientColorEnd: colorEnd || DEFAULT_OVERLAY_BACKGROUND_COLOR_END,
      },
    };
  });
}

/** Local one-card deck when `/api/models` is empty so Skip/Continue still work. */
export function createFallbackSwipeDeck(): SwipeCardData[] {
  return [
    {
      id: "swipe-fallback-juliana",
      name: "Juliana",
      socialhandle: "@julianaval",
      mediaType: "video",
      mediaUrl: DEFAULT_SWIPE_VIDEO_URL,
      backUrl: CARD_BACK_URL,
      overlay: {
        name: "Juliana",
        city: "Buenos Aires",
        country: "Argentina",
        flagEmoji: "🇦🇷",
        gradientColor: DEFAULT_OVERLAY_BACKGROUND_COLOR,
        gradientColorEnd: DEFAULT_OVERLAY_BACKGROUND_COLOR_END,
      },
    },
  ];
}
