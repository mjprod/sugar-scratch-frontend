/** Swap when brand social URLs are finalized. */
export const SITE_SOCIAL = [
  { id: "facebook", label: "Facebook", href: "https://www.facebook.com/" },
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
  { id: "discord", label: "Discord", href: "https://discord.com/" },
] as const;

export type SiteSocialId = (typeof SITE_SOCIAL)[number]["id"];
