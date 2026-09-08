/**
 * Primary nav chrome constants shared by LiquidGlassNav + self-check.
 * Keep labels in sync with tab configs in LiquidGlassNav.tsx.
 */

/** Top nav shows icon+label from this width (AC8c). Below stays icon-only (AC8b). */
export const NAV_LABEL_MIN_PX = 990;

/** Bottom dock ↔ top chrome swap (mobile vs tablet/desktop). */
export const DESKTOP_MIN_PX = 769;

/** AC4 — authenticated desktop primary destinations (labels). */
export const DESKTOP_PRIMARY_LABELS = [
  "Home",
  "Discover",
  "Store",
  "My Collection",
] as const;

/** AC8a — mobile dock order (labels); index 2 is elevated My Collection. */
export const MOBILE_DOCK_LABELS = [
  "Discover",
  "Home",
  "My Collection",
  "Store",
  "Profile",
] as const;
