import { Compass, Home, User, type LucideIcon } from "lucide-react";
import {
  CollectionIcon,
  DiamondIcon,
  GuestCollectionIcon,
  LoginIcon,
  RankIcon,
  ShopIcon,
} from "@/components/navIcons";
import type { AppTab } from "@/types/app";
import {
  DESKTOP_PRIMARY_LABELS,
  GUEST_DESKTOP_PRIMARY_LABELS,
  GUEST_MOBILE_DOCK_LABELS,
  MOBILE_DOCK_LABELS,
} from "@/lib/navChrome";

type NavIcon =
  | LucideIcon
  | typeof LoginIcon
  | typeof DiamondIcon
  | typeof CollectionIcon
  | typeof GuestCollectionIcon
  | typeof ShopIcon
  | typeof RankIcon;

export type TabConfig = {
  id: AppTab;
  label: string;
  icon: NavIcon;
  primary?: boolean;
};

/** Logged-in mobile dock: Rank, Shop, Home (center), Collect, Profile. */
export const TABS: TabConfig[] = [
  { id: "home", label: MOBILE_DOCK_LABELS[0], icon: RankIcon },
  { id: "feed", label: MOBILE_DOCK_LABELS[1], icon: ShopIcon },
  {
    id: "bag",
    label: MOBILE_DOCK_LABELS[2],
    icon: GuestCollectionIcon,
    primary: true,
  },
  { id: "hub", label: MOBILE_DOCK_LABELS[3], icon: CollectionIcon },
  { id: "profile", label: MOBILE_DOCK_LABELS[4], icon: User },
];

/** Guest mobile dock: Discover, Home, Collect (center), Store, Profile. */
export const GUEST_TABS: TabConfig[] = [
  { id: "home", label: GUEST_MOBILE_DOCK_LABELS[0], icon: Compass },
  { id: "feed", label: GUEST_MOBILE_DOCK_LABELS[1], icon: Home },
  {
    id: "bag",
    label: GUEST_MOBILE_DOCK_LABELS[2],
    icon: CollectionIcon,
    primary: true,
  },
  { id: "hub", label: GUEST_MOBILE_DOCK_LABELS[3], icon: DiamondIcon },
  { id: "profile", label: GUEST_MOBILE_DOCK_LABELS[4], icon: User },
];

/**
 * Logged-in desktop top bar.
 * Profile is icon-only in the right utility cluster (not in this list).
 */
export const DESKTOP_TABS: TabConfig[] = [
  { id: "bag", label: DESKTOP_PRIMARY_LABELS[0], icon: Home },
  { id: "feed", label: DESKTOP_PRIMARY_LABELS[1], icon: ShopIcon },
  {
    id: "hub",
    label: DESKTOP_PRIMARY_LABELS[2],
    icon: CollectionIcon,
    primary: true,
  },
  { id: "home", label: DESKTOP_PRIMARY_LABELS[3], icon: RankIcon },
];

/** Guest desktop top bar — Collection omitted. */
export const GUEST_DESKTOP_TABS: TabConfig[] = [
  { id: "feed", label: GUEST_DESKTOP_PRIMARY_LABELS[0], icon: Home },
  { id: "home", label: GUEST_DESKTOP_PRIMARY_LABELS[1], icon: Compass },
  { id: "hub", label: GUEST_DESKTOP_PRIMARY_LABELS[2], icon: DiamondIcon },
];
