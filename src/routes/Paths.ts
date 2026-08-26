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
  /** Search / find — entered from Home HUD. */
  search: "/search",
  /** @deprecated Use Paths.home — kept for older imports / redirects. */
  browse: "/",
  creator: (id: string) => `/creator/${id}`,
  creatorPattern: "/creator/:id",
  collection: "/collection",
  /** Collection hub opened on Unopened Packs. */
  collectionPacks: "/collection?reveal=packs",
  rewards: "/rewards",
  profile: "/profile",
  editProfile: "/profile/edit",
  store: "/store",
  settings: "/settings",
  changePassword: "/settings/change-password",
  following: "/profile/following",
  gameSettings: "/profile/game-settings",
  inbox: "/inbox",
  /** Packs ready to check out — not the Store. */
  packPocket: "/pack-pocket",
  /** @deprecated Use Paths.packPocket */
  cart: "/pack-pocket",
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
  coverflowV2: "/coverflow-v2",
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
  // Home browse + search + creator pages
  if (
    pathname === "/" ||
    pathname.startsWith("/browse") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/creator")
  ) {
    return "feed";
  }
  if (pathname.startsWith("/collection")) return "bag";
  if (pathname.startsWith("/rewards") || pathname.startsWith("/store")) {
    return "hub";
  }
  if (
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/inbox")
  ) {
    return "profile";
  }
  return "feed";
}
