/**
 * Decoder claim must drop the outgoing src before attaching the next.
 * Run: npx tsx src/lib/memory/exclusiveMedia.self-check.ts
 */
import {
  claimMediaDecoder,
  releaseClaimedDecoder,
} from "./exclusiveMedia.ts";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

type FakeMedia = HTMLMediaElement & {
  pauseCount: number;
  loadCount: number;
};

function makeFake(src = ""): FakeMedia {
  const el = {
    src,
    currentSrc: src,
    pauseCount: 0,
    loadCount: 0,
    pause() {
      el.pauseCount += 1;
    },
    load() {
      el.loadCount += 1;
    },
    getAttribute(name: string) {
      return name === "src" ? el.src || null : null;
    },
    removeAttribute(name: string) {
      if (name === "src") {
        el.src = "";
        el.currentSrc = "";
      }
    },
  };
  return el as FakeMedia;
}

const first = makeFake();
claimMediaDecoder(first, "https://cdn.test/a.mp4");
assert(first.src === "https://cdn.test/a.mp4", "empty node gets src");
assert(first.loadCount === 1, "blank load() before first src so iOS drops any prior decoder");
assert(first.pauseCount >= 1, "pause before blanking src");

const second = makeFake();
claimMediaDecoder(second, "https://cdn.test/b.mp4");
assert(first.src === "", "outgoing decoder src is blanked before the new claim");
assert(first.loadCount === 2, "outgoing node load() after blank");
assert(second.src === "https://cdn.test/b.mp4", "incoming node has the new src");

const loadsBeforeSame = second.loadCount;
claimMediaDecoder(second, "https://cdn.test/b.mp4");
assert(
  second.loadCount === loadsBeforeSame,
  "same-src re-claim must not load() (would flash / re-decode)",
);

const loadsBeforeSwap = second.loadCount;
claimMediaDecoder(second, "https://cdn.test/c.mp4");
assert(second.src === "https://cdn.test/c.mp4", "src swap on the same node");
assert(
  second.loadCount === loadsBeforeSwap + 1,
  "src swap blanks + load() before the new url",
);

releaseClaimedDecoder(second);
assert(second.src === "", "explicit release blanks src");

claimMediaDecoder(second, "https://cdn.test/d.mp4");
releaseClaimedDecoder();
assert(second.src === "", "release with no args drops the current claim");

console.log("exclusiveMedia.self-check ok");
