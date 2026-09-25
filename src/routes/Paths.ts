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
  /**
   * Opens the global search overlay on the current page.
   * Prefer `openSearch()` from SearchContext; this query is a deep-link fallback.
   */
  homeSearch: "/?library=1",
  /** Deep-link that opens the global search overlay. */
  search: "/search",
  /** @deprecated Use Paths.home — kept for older imports / redirects. */
  browse: "/",
  creator: (id: string) => `/creator/${id}`,
  creatorPattern: "/creator/:id",
  /** Unlocked motion card detail (Figma 93:590 Keep Playing). */
  motionCard: (creatorId: string, cardId: string) =>
    `/creator/${encodeURIComponent(creatorId)}/motion/${encodeURIComponent(cardId)}`,
  motionCardPattern: "/creator/:id/motion/:cardId",
  collection: "/collection",
  /** Collection hub opened on Unopened Packs. */
  collectionPacks: "/collection?reveal=packs",
  rewards: "/rewards",
  profile: "/profile",
  editProfile: "/profile/edit",
  store: "/store",
  settings: "/settings",
  changePassword: "/profile/change-password",
  following: "/profile/following",
  gameSettings: "/profile/game-settings",
  /** Wallet / purchase ledger (Profile → History). */
  transactions: "/profile/transactions",
  /** Completed scratch/reveal results (Profile → History). */
  gameHistory: "/profile/game-history",
  inbox: "/inbox",
  /** Packs ready to check out — not the Store. */
  packPocket: "/pack-pocket",
  /** @deprecated Use Paths.packPocket */
  cart: "/pack-pocket",
  purchase: (packId: string) => `/purchase/${packId}`,
  purchasePattern: "/purchase/:packId",
  /** Shared tear-open stage — not tied to one influencer pack id. */
  purchaseTearOpen: "/purchase/tear-open",
  purchaseTearOpenSlug: "tear-open",
  game: "/game",
  /** Lab sandbox for iterative game UI work (Juliana motion scratch). */
  gameUi: "/game-ui",
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
  /** Static photo scratch from collection PHOTO CARDS (no game=1 → exit to collection / motion page). */
  photoScratchPlay: (
    photoCardId: string,
    extra?: { modelId?: string; creatorId?: string },
  ) => {
    const params = new URLSearchParams();
    params.set("card", photoCardId);
    const model = extra?.modelId?.trim();
    if (model) params.set("model", model);
    const creator = extra?.creatorId?.trim();
    if (creator) params.set("creator", creator);
    return `/photo-scratch?${params.toString()}`;
  },
  recommend: "/recommend",
  recommendSwipe: "/recommend/swipe",
  recommendDone: "/recommend/done",
  welcome: "/welcome",
  resetPassword: "/reset-password",
  coverflowV2: "/coverflow-v2",
  mobileCarousel: "/mobile-carousel",
  /** @deprecated Design is now the logged-in home at Paths.home. */
  homeVersion2: "/home-version2",
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

export function tabFromPathname(pathname: string): AppTab | null {
  // Discover feed
  if (pathname.startsWith("/discover")) return "home";
  // Home browse + search (+ legacy home-version2 redirect)
  if (
    pathname === "/" ||
    pathname.startsWith("/browse") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/home-version2")
  ) {
    return "feed";
  }
  // Collection hub only — creator profile is secondary and selects nothing.
  if (pathname.startsWith("/collection")) {
    return "bag";
  }
  if (pathname.startsWith("/creator")) {
    return null;
  }
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
