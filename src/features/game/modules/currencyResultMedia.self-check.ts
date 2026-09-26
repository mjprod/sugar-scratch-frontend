/**
 * Offline invariants for per-card result media teardown (win + no-match).
 * Run: npx tsx src/features/game/modules/currencyResultMedia.self-check.ts
 */
import {
  shouldDeferCardVideoAttach,
  shouldReviveGameVideos,
} from "./currencyResultMedia";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  shouldReviveGameVideos({
    userPaused: false,
    introActive: false,
    cardTransitionActive: false,
    resultOverlayActive: false,
  }),
  "idle play: revive OK",
);

assert(
  !shouldReviveGameVideos({
    userPaused: false,
    introActive: false,
    cardTransitionActive: false,
    resultOverlayActive: true,
  }),
  "result overlay: never revive theme videos",
);

assert(
  !shouldReviveGameVideos({
    userPaused: true,
    introActive: false,
    cardTransitionActive: false,
    resultOverlayActive: false,
  }),
  "user pause: no revive",
);

assert(
  !shouldReviveGameVideos({
    userPaused: false,
    introActive: true,
    cardTransitionActive: false,
    resultOverlayActive: false,
  }),
  "intro: no revive",
);

assert(
  shouldDeferCardVideoAttach({
    introActive: false,
    resultOverlayActive: true,
  }),
  "result overlay defers finished-card attach",
);

assert(
  shouldDeferCardVideoAttach({
    introActive: true,
    resultOverlayActive: false,
  }),
  "intro defers card attach",
);

assert(
  !shouldDeferCardVideoAttach({
    introActive: false,
    resultOverlayActive: false,
  }),
  "play window attaches card videos",
);

console.log("currencyResultMedia.self-check: ok");
