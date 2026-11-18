/**
 * Profile theme static clothes slide picker.
 * Run: npx tsx src/components/creator/creatorThemeMotionSlides.self-check.ts
 */
import {
  PROFILE_THEME_MOTION_KEYS,
  buildProfileThemeMotionSlides,
  profileThemeClothesArtBase,
} from "./creatorThemeMotionSlides.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(PROFILE_THEME_MOTION_KEYS.includes("police"), "police in order");
assert(PROFILE_THEME_MOTION_KEYS.includes("fire"), "firegirl aliases to fire");
assert(
  profileThemeClothesArtBase("fire").endsWith("/imageFire"),
  "fire clothes art",
);
assert(profileThemeClothesArtBase("cowgirl") === "", "no cowgirl art yet");

const slides = buildProfileThemeMotionSlides([
  { id: "police", name: "Police" },
  { id: "nurse", name: "Nurse" },
  { id: "summer", name: "Summer Nights" },
  { id: "firegirl", name: "Firegirl" },
]);

assert(slides.length === 3, "nurse + police + fire only");
assert(slides[0]?.themeId === "nurse", "nurse first in order");
assert(slides[0]?.item.videoUrl === "", "no video on profile cards");
assert(
  slides[0]?.item.posterArtBase?.includes("imageNurse"),
  "nurse clothes art base",
);
assert(slides[2]?.themeName === "Firegirl", "fire alias maps through");

console.log("creatorThemeMotionSlides.self-check: ok");
