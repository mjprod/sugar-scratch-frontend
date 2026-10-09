/**
 * Offline invariants for bottom video uploads (Phase 8).
 * Run: npx tsx src/features/game/modules/halfRateBottom.self-check.ts
 */
import { shouldHalfRateBottomUploads } from "./halfRateBottom";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  !shouldHalfRateBottomUploads({
    hideForeground: false,
    isScratching: false,
    coarsePointer: true,
  }),
  "idle phone: full-rate underlay",
);
assert(
  shouldHalfRateBottomUploads({
    hideForeground: false,
    isScratching: true,
    coarsePointer: true,
  }),
  "scratching phone: half-rate underlay",
);
assert(
  !shouldHalfRateBottomUploads({
    hideForeground: false,
    isScratching: true,
    coarsePointer: false,
  }),
  "desktop scratch: full-rate underlay",
);
assert(
  !shouldHalfRateBottomUploads({
    hideForeground: true,
    isScratching: true,
    coarsePointer: true,
  }),
  "after FG hide: full-rate bottom",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "half-rate bottom only while scratching on coarse; else full-rate",
    },
    null,
    2,
  ),
);
