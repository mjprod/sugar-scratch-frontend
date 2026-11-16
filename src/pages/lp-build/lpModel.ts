import type { CatalogMotionCard } from "@/features/game/shared/catalog";

/** Pinned influencer for the landing page. The scratch game may rewrite `model`. */
export const LP_MODEL_PARAM = "lpModel";

const TEMPLATE_CARD = "juliana_1";

export function landingPageModelId(params: URLSearchParams): string {
  return (
    params.get(LP_MODEL_PARAM)?.trim() ||
    params.get("model")?.trim() ||
    params.get("username")?.trim() ||
    "julianaval"
  );
}

/**
 * Card to scratch before the landing page.
 * Their own card when they have one. Otherwise a random catalog card, played free.
 * A card already in the URL is kept so replay doesn't roll again.
 */
export function pickLandingPlayCard(
  cards: CatalogMotionCard[],
  owner: string,
  requested: string,
): string {
  const own = cards
    .filter((card) => (card.model_id ?? "").trim() === owner)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
    );
  const owned = own.find((card) => card.id === requested);
  if (owned) return owned.id;
  if (own.length > 0) return own[0]!.id;
  if (requested && cards.some((card) => card.id === requested)) return requested;
  if (cards.length === 0) return TEMPLATE_CARD;
  const index = Math.floor(Math.random() * cards.length);
  return cards[index]!.id;
}
