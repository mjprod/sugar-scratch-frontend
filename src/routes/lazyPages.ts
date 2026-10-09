/** Loaders for tab pages that are lazy in AppRoutes but prefetched on idle by AppLayout. */
export const loadHomeFeedPage = () => import("@/pages/HomeFeedPage");
export const loadRankPage = () => import("@/pages/RankPage");

export function prefetchTabPages(): void {
  loadHomeFeedPage().catch(() => {});
  loadRankPage().catch(() => {});
}
