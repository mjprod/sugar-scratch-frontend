/**
 * Primary nav chrome constants shared by LiquidGlassNav + self-check.
 * Keep labels in sync with tab configs in LiquidGlassNav.tsx.
 */

/** Top nav shows icon+label from this width (AC8c). Below stays icon-only (AC8b). */
export const NAV_LABEL_MIN_PX = 990;

/** Bottom dock ↔ top chrome swap (mobile vs tablet/desktop). */
export const DESKTOP_MIN_PX = 769;

/** Authenticated desktop primary destinations (labels). */
export const DESKTOP_PRIMARY_LABELS = [
  "Home",
  "Shop",
  "Collect",
  "Rank",
] as const;

/** Guest desktop primary destinations (labels). */
export const GUEST_DESKTOP_PRIMARY_LABELS = [
  "Home",
  "Discover",
  "Store",
] as const;

/** Authenticated mobile dock order (labels); index 2 is elevated Home. */
export const MOBILE_DOCK_LABELS = [
  "Rank",
  "Shop",
  "Home",
  "Collect",
  "Profile",
] as const;

/** Guest mobile dock order (labels); index 2 is elevated Collect. */
export const GUEST_MOBILE_DOCK_LABELS = [
  "Discover",
  "Home",
  "Collect",
  "Store",
  "Profile",
] as const;
