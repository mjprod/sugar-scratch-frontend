/**
 * Side packs stay on the poster until the front pack has a decoded video frame.
 * Run: npx tsx src/lib/pack3d/usePosterTexture.self-check.ts
 */
import { pickPackFaceTexture } from "./usePosterTexture";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const poster = { kind: "poster" };
const video = { kind: "video" };

assert(
  pickPackFaceTexture(null, poster) === poster,
  "side pack with no decoder must show the poster",
);

assert(
  pickPackFaceTexture({ texture: video, isReady: false }, poster) === poster,
  "front pack must keep the poster until a video frame is ready",
);

assert(
  pickPackFaceTexture({ texture: video, isReady: true }, poster) === video,
  "front pack swaps to video once a frame is ready",
);

assert(
  pickPackFaceTexture({ texture: null, isReady: true }, poster) === poster,
  "ready-but-empty video must not blank the pack",
);

assert(
  pickPackFaceTexture({ texture: null, isReady: false }, null) === null,
  "no media stays blank",
);

console.log("usePosterTexture self-check passed");
