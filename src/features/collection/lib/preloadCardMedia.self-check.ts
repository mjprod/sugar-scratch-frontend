/**
 * Collection warmup must prefer posters over detached video decoders.
 * Run: npx tsx src/features/collection/lib/preloadCardMedia.self-check.ts
 */
import { cardMediaWarmList } from "./preloadCardMedia.ts";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const imageCard = cardMediaWarmList({
  mediaType: "image",
  mediaUrl: "https://cdn.test/face.webp",
  backMediaType: "image",
  backUrl: "https://cdn.test/back.webp",
});
assert(
  imageCard.images.join(" ") ===
    "https://cdn.test/face.webp https://cdn.test/back.webp",
  "image faces warm as images",
);
assert(imageCard.videos.length === 0, "image faces must not create videos");

const posterCard = cardMediaWarmList({
  mediaType: "video",
  mediaUrl: "https://cdn.test/face.mp4",
  posterUrl: "https://cdn.test/face.webp",
  backMediaType: "image",
  backUrl: "https://cdn.test/back.webp",
});
assert(
  posterCard.images.join(" ") ===
    "https://cdn.test/face.webp https://cdn.test/back.webp",
  "video+poster warms the still, not the clip",
);
assert(posterCard.videos.length === 0, "poster present → no detached decoder");

const noPoster = cardMediaWarmList({
  mediaType: "video",
  mediaUrl: "https://cdn.test/face.mp4",
  backMediaType: "video",
  backUrl: "https://cdn.test/back.mp4",
});
assert(
  noPoster.videos.join(" ") ===
    "https://cdn.test/face.mp4 https://cdn.test/back.mp4",
  "no-poster motion still lists the clip so preload can release it",
);
assert(noPoster.images.length === 0, "no stills when both faces are clip-only");

console.log("preloadCardMedia.self-check ok");
