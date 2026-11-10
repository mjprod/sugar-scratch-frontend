/**
 * Profile theme motion slide picker.
 * Run: npx tsx src/components/creator/creatorThemeMotionSlides.self-check.ts
 */
import {
  PROFILE_THEME_MOTION_KEYS,
  buildProfileThemeMotionSlides,
} from "./creatorThemeMotionSlides.ts";
import type { CardConfig } from "@/features/collection/lib/cards";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(PROFILE_THEME_MOTION_KEYS.includes("police"), "police in order");
assert(PROFILE_THEME_MOTION_KEYS.includes("fire"), "firegirl aliases to fire");

const motionCard = {
  id: "police-motion-1",
  name: "Police 01",
  mediaType: "video",
  mediaUrl: "/cards/police-motion-1/motion.mp4",
  posterUrl: "/cards/police-motion-1/motion-poster.webp",
} as unknown as CardConfig;

const placeholderCard = {
  id: "nurse-placeholder-1",
  name: "Nurse",
  mediaType: "image",
  mediaUrl: "",
} as unknown as CardConfig;

const slides = buildProfileThemeMotionSlides(
  [
    { id: "police", name: "Police" },
    { id: "nurse", name: "Nurse" },
    { id: "summer", name: "Summer Nights" },
  ],
  {
    police: [motionCard],
    nurse: [placeholderCard],
  },
);

assert(slides.length === 1, "only police has motion media");
assert(slides[0]?.themeId === "police", "police first among available");
assert(slides[0]?.item.videoUrl.includes("motion.mp4"), "uses motion video");

console.log("creatorThemeMotionSlides.self-check: ok");
