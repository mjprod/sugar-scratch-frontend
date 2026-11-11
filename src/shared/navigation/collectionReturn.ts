import { Paths } from "@/routes/Paths";
import { motionCardIdFromPhotoScratchId } from "@/features/collection/lib/photoSlots";

type GameReturnOptions = {
  /** Influencer slug — when set, exit back to creator (or theme when themeId set). */
  creatorId?: string | null;
  /** Theme id — with creatorId, exit to /creator/:id/theme/:themeId. */
  themeId?: string | null;
  modelId?: string | null;
  /** Motion card id, or a photo-scratch slot id (`…_slot_01`). */
  cardId?: string | null;
};

/**
 * Influencer play exits back to the theme page when theme is present, else the
 * creator page with the card still open. Falls back to /collection for bag exits.
 */
export function collectionReturnHref(
  modelOrOptions?: string | null | GameReturnOptions,
  card?: string | null,
  creator?: string | null,
): string {
  let modelId = "";
  let cardId = "";
  let creatorId = "";
  let themeId = "";

  if (modelOrOptions && typeof modelOrOptions === "object") {
    modelId = modelOrOptions.modelId?.trim() || "";
    cardId = modelOrOptions.cardId?.trim() || "";
    creatorId = modelOrOptions.creatorId?.trim() || "";
    themeId = modelOrOptions.themeId?.trim() || "";
  } else {
    modelId = modelOrOptions?.trim() || "";
    cardId = card?.trim() || "";
    creatorId = creator?.trim() || "";
  }

  const motionCardId = cardId
    ? motionCardIdFromPhotoScratchId(cardId)
    : "";

  if (creatorId && themeId) {
    const href = Paths.creatorTheme(creatorId, themeId);
    if (!motionCardId) return href;
    const params = new URLSearchParams();
    params.set("card", motionCardId);
    return `${href}?${params.toString()}`;
  }

  if (creatorId) {
    const params = new URLSearchParams();
    if (motionCardId) params.set("card", motionCardId);
    const qs = params.toString();
    return qs ? `${Paths.creator(creatorId)}?${qs}` : Paths.creator(creatorId);
  }

  const params = new URLSearchParams();
  if (modelId) params.set("model", modelId);
  if (motionCardId) params.set("card", motionCardId);
  const qs = params.toString();
  return qs ? `/collection?${qs}` : "/collection";
}

/** Read creator / theme / model / card from the current game URL for exit routing. */
export function gameReturnHrefFromSearch(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): string {
  const params = new URLSearchParams(search);
  const cardParam = params.get("card")?.trim() || "";
  return collectionReturnHref({
    creatorId: params.get("creator")?.trim() || "",
    themeId: params.get("theme")?.trim() || "",
    modelId: params.get("model")?.trim() || "",
    cardId: cardParam,
  });
}
