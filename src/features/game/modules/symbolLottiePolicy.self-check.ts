/**
 * Offline invariants for symbol lottie quiet/preload policy (Phase 7).
 * Run: npx tsx src/features/game/modules/symbolLottiePolicy.self-check.ts
 */
import {
  preloadLottieUrls,
  shouldFreezeSymbolLottie,
  shouldPreferStaticSymbolLottie,
} from "./symbolLottiePolicy";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  !shouldPreferStaticSymbolLottie({ coarsePointer: true }),
  "coarse uses worker icons (sharp OffscreenCanvas path)",
);
assert(
  !shouldPreferStaticSymbolLottie({ coarsePointer: false }),
  "fine uses worker icons",
);

assert(
  !shouldFreezeSymbolLottie({
    basePaused: false,
    coarsePointer: false,
    isScratching: true,
  }),
  "do not freeze while scratching",
);
assert(
  !shouldFreezeSymbolLottie({
    basePaused: false,
    coarsePointer: true,
    isScratching: false,
  }),
  "coarse may animate",
);
assert(
  shouldFreezeSymbolLottie({
    basePaused: true,
    coarsePointer: false,
    isScratching: false,
  }),
  "basePaused wins",
);

void preloadLottieUrls(["", "/missing.lottie", "/missing.lottie"]).then(() => {
  console.log(
    JSON.stringify(
      {
        ok: true,
        policy: "worker icons on all pointers; freeze only when basePaused; preload",
      },
      null,
      2,
    ),
  );
});
