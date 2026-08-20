import type { AppTab } from "@/types/app";

export const Paths = {
  loading: "/loading",
  preLoader: "/pre-loader",
  /**
   * Home nav tab (pack browse) lives at root.
   * Discover nav tab (home feed) lives at /discover.
   */
  home: "/",
  discover: "/discover",
  /** @deprecated Use Paths.home — kept for older imports / redirects. */
  browse: "/",
  creator: (id: string) => `/creator/${id}`,
  creatorPattern: "/creator/:id",
  collection: "/collection",
  rewards: "/rewards",
  profile: "/profile",
  store: "/store",
  settings: "/settings",
  changePassword: "/settings/change-password",
  favourites: "/profile/favourites",
  inbox: "/inbox",
  purchase: (packId: string) => `/purchase/${packId}`,
  purchasePattern: "/purchase/:packId",
  game: "/game",
  photoScratch: "/photo-scratch",
  /** Motion scratch — same query HoloCard uses by default. */
  gamePlay: (
    modelId: string,
    cardId: string,
    extra?: { creatorId?: string; themeId?: string },
  ) => {
    const params = new URLSearchParams();
    params.set("model", modelId);
    params.set("card", cardId);
    if (extra?.creatorId) params.set("creator", extra.creatorId);
    if (extra?.themeId) params.set("theme", extra.themeId);
    return `/game?${params.toString()}`;
  },
  /** Static photo scratch from collection PHOTO CARDS (no game=1 → exit to collection). */
  photoScratchPlay: (
    photoCardId: string,
    extra?: { modelId?: string },
  ) => {
    const params = new URLSearchParams();
    params.set("card", photoCardId);
    const model = extra?.modelId?.trim();
    if (model) params.set("model", model);
    return `/photo-scratch?${params.toString()}`;
  },
  recommend: "/recommend",
  recommendSwipe: "/recommend/swipe",
  recommendDone: "/recommend/done",
  welcome: "/welcome",
  resetPassword: "/reset-password",
  navTest: "/nav-test",
} as const;

/** Tabs guests can open without auth (Store is browseable; purchase still gates). */
export const PUBLIC_TABS: AppTab[] = ["home", "feed", "hub"];

export function pathForTab(tab: AppTab): string {
  switch (tab) {
    case "home":
      // Discover nav item
      return Paths.discover;
    case "feed":
      // Home nav item (pack browse)
      return Paths.home;
    case "bag":
      return Paths.collection;
    case "hub":
      return Paths.store;
    case "profile":
      return Paths.profile;
    default:
      return Paths.home;
  }
}

export function tabFromPathname(pathname: string): AppTab {
  // Discover feed
  if (pathname.startsWith("/discover")) return "home";
  // Home browse + creator pages
  if (
    pathname === "/" ||
    pathname.startsWith("/browse") ||
    pathname.startsWith("/creator")
  ) {
    return "feed";
  }
  if (pathname.startsWith("/collection")) return "bag";
  if (
    pathname.startsWith("/rewards") ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/inbox")
  ) {
    return "hub";
  }
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings")) {
    return "profile";
  }
  return "feed";
}
