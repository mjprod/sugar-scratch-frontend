/**
 * Catalog visibility for an influencer.
 *
 * A missing status counts as published so a cached `/api/models` payload from
 * before this field existed does not hide the whole catalog.
 *
 * Discovery (store, swipe, search, home feed) must use `isDiscoverableInfluencer`.
 * Collection, cart, and direct profile lookup must keep deprecated rows: buyers
 * still need the creator record. The API returns those rows to everyone on purpose.
 */

export type InfluencerStatus = "published" | "unpublished" | "deprecated";

export function influencerStatus(model: { status?: string | null } | null | undefined): InfluencerStatus {
  if (model?.status === "unpublished" || model?.status === "deprecated") return model.status;
  return "published";
}

/** Store, swipe, search, and home feed. Deprecated influencers stay out of discovery. */
export function isDiscoverableInfluencer(model: { status?: string | null } | null | undefined): boolean {
  return influencerStatus(model) === "published";
}
