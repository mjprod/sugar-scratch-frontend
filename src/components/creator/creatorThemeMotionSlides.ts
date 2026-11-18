import {
  packItemToIteration,
  type Iteration,
} from "@/features/packs/types";
import { canonicalThemeKey } from "@/services/collection";

/** Profile coverflow theme order. */
export const PROFILE_THEME_MOTION_KEYS = [
  "nurse",
  "police",
  "teacher",
  "gym",
  "fire",
  "cowgirl",
  "egypt",
  "greekmythos",
] as const;

/** Static clothes art per theme — files live in /images/creator/clothes/. */
export const PROFILE_THEME_CLOTHES_ART: Partial<
  Record<(typeof PROFILE_THEME_MOTION_KEYS)[number], string>
> = {
  nurse: "imageNurse",
  police: "imagePolice",
  teacher: "imageTeacher",
  gym: "imageGym",
  fire: "imageFire",
};

export function profileThemeClothesArtBase(themeKey: string): string {
  const file =
    PROFILE_THEME_CLOTHES_ART[
      themeKey as keyof typeof PROFILE_THEME_CLOTHES_ART
    ];
  return file ? `/images/creator/clothes/${file}` : "";
}

export type ProfileThemeMotionSlide = {
  item: Iteration;
  themeId: string;
  themeName: string;
};

/**
 * One static clothes card per profile theme (no video).
 * Skips themes without live catalog entry or clothes art yet.
 */
export function buildProfileThemeMotionSlides(
  themes: Array<{ id: string; name: string }>,
): ProfileThemeMotionSlide[] {
  const byKey = new Map<string, { id: string; name: string }>();
  for (const theme of themes) {
    const key =
      canonicalThemeKey(theme.id) || canonicalThemeKey(theme.name);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, theme);
  }

  const slides: ProfileThemeMotionSlide[] = [];
  for (const wanted of PROFILE_THEME_MOTION_KEYS) {
    const theme = byKey.get(wanted);
    if (!theme) continue;
    const artBase = profileThemeClothesArtBase(wanted);
    if (!artBase) continue;
    slides.push({
      item: packItemToIteration({
        id: `profile-theme-${theme.id}`,
        characterId: theme.id,
        name: theme.name,
        modelUrl: "",
        modelName: theme.name,
        videoUrl: "",
        posterUrl: `${artBase}.webp`,
        posterArtBase: artBase,
        price: 0,
        girlName: theme.name,
        packNumber: slides.length + 1,
        packName: theme.name,
        flagEmoji: "",
        backgroundColor: "oklch(0.798 0.104 207.84)",
        backgroundImageUrl: `${artBase}.webp`,
      }),
      themeId: theme.id,
      themeName: theme.name,
    });
  }
  return slides;
}
