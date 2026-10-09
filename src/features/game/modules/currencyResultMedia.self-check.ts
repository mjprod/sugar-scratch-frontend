/**
 * Offline invariants for per-card result media teardown (showcase + win + no-match).
 * Run: npx tsx src/features/game/modules/currencyResultMedia.self-check.ts
 */
import {
  shouldClearStagePicture,
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
  shouldClearStagePicture({ topBarPhase: "showcase", motionOutcome: null }),
  "showcase clears stage picture",
);

assert(
  !shouldClearStagePicture({ topBarPhase: "center", motionOutcome: null }),
  "center foil keeps theme video behind the capsule",
);

assert(
  shouldClearStagePicture({ topBarPhase: "docked", motionOutcome: "no-match" }),
  "no-match clears stage picture",
);

assert(
  shouldClearStagePicture({ topBarPhase: "docked", motionOutcome: "diamond" }),
  "currency win clears stage picture",
);

assert(
  !shouldClearStagePicture({ topBarPhase: "docked", motionOutcome: null }),
  "hunt/docked keeps stage picture",
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
