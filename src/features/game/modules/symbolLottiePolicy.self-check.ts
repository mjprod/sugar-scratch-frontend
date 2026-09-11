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
  shouldPreferStaticSymbolLottie({ coarsePointer: true }),
  "coarse prefers static",
);
assert(
  !shouldPreferStaticSymbolLottie({ coarsePointer: false }),
  "fine pointer may use workers",
);

assert(
  shouldFreezeSymbolLottie({
    basePaused: false,
    coarsePointer: false,
    isScratching: true,
  }),
  "freeze while scratching",
);
assert(
  shouldFreezeSymbolLottie({
    basePaused: false,
    coarsePointer: true,
    isScratching: false,
  }),
  "freeze on coarse always",
);
assert(
  !shouldFreezeSymbolLottie({
    basePaused: false,
    coarsePointer: false,
    isScratching: false,
  }),
  "desktop idle may animate",
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
        policy: "coarse/static + freeze-while-scratching; preload best-effort",
      },
      null,
      2,
    ),
  );
});
