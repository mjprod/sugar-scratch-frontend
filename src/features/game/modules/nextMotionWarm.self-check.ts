/**
 * Win-page next-card warm: keep flag, URL match, take() miss.
 * Run: npx tsx src/features/game/modules/nextMotionWarm.self-check.ts
 */
import {
  MOTION_WARM_KEEP,
  takeWarmedMotionVideos,
  warmedPairMatches,
  warmedSrcMatches,
} from "./nextMotionWarm.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(MOTION_WARM_KEEP === "1", "purge skips data-memory-keep=1");

assert(warmedSrcMatches("/a.mp4", "/a.mp4"), "same path matches");
assert(
  warmedSrcMatches("https://cdn.example/a.mp4", "https://cdn.example/a.mp4"),
  "same absolute matches",
);
assert(!warmedSrcMatches("/a.mp4", "/b.mp4"), "different path does not match");
assert(!warmedSrcMatches("", "/a.mp4"), "empty actual does not match");

assert(
  warmedPairMatches(
    { cardId: "m2", bottomSrc: "/b.mp4", foregroundSrc: "/f.mp4" },
    "m2",
    "/b.mp4",
    "/f.mp4",
  ),
  "parked pair matches next card urls",
);
assert(
  !warmedPairMatches(
    { cardId: "m2", bottomSrc: "/b.mp4", foregroundSrc: "/f.mp4" },
    "m3",
    "/b.mp4",
    "/f.mp4",
  ),
  "wrong card id does not match",
);
assert(
  !warmedPairMatches(
    { cardId: "m2", bottomSrc: "/b.mp4", foregroundSrc: "/f.mp4" },
    "m2",
    "/other.mp4",
    "/f.mp4",
  ),
  "wrong bottom url does not match",
);
assert(
  !warmedPairMatches(null, "m2", "/b.mp4", "/f.mp4"),
  "no parked pair does not match",
);

assert(
  takeWarmedMotionVideos("m2", "/b.mp4", "/f.mp4") === null,
  "take() with nothing parked returns null",
);

console.log("nextMotionWarm.self-check: ok");
