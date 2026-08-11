import type { AppTab } from "@/types/app";

export const Paths = {
  loading: "/loading",
  home: "/",
  browse: "/browse",
  creator: (id: string) => `/creator/${id}`,
  creatorPattern: "/creator/:id",
  collection: "/collection",
  rewards: "/rewards",
  profile: "/profile",
  store: "/store",
  settings: "/settings",
  inbox: "/inbox",
  purchase: (packId: string) => `/purchase/${packId}`,
  purchasePattern: "/purchase/:packId",
  recommend: "/recommend",
  recommendSwipe: "/recommend/swipe",
  recommendDone: "/recommend/done",
  resetPassword: "/reset-password",
} as const;

export const PUBLIC_TABS: AppTab[] = ["home", "feed"];

export function pathForTab(tab: AppTab): string {
  switch (tab) {
    case "home":
      return Paths.home;
    case "feed":
      return Paths.browse;
    case "bag":
      return Paths.collection;
    case "hub":
      return Paths.rewards;
    case "profile":
      return Paths.profile;
    default:
      return Paths.home;
  }
}

export function tabFromPathname(pathname: string): AppTab {
  if (pathname.startsWith("/browse") || pathname.startsWith("/creator")) {
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
  return "home";
}
