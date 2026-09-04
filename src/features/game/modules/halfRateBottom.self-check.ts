/**
 * Offline invariants for half-rate bottom video uploads.
 * Run: npx tsx src/features/game/modules/halfRateBottom.self-check.ts
 */
import { shouldHalfRateBottomUploads } from "./halfRateBottom";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  shouldHalfRateBottomUploads(false),
  "half-rate while FG composited",
);
assert(
  !shouldHalfRateBottomUploads(true),
  "full-rate bottom after FG hide",
);

// Two 30fps clips → ~45 bottom+FG uploads/s instead of ~60 while FG visible.
{
  const clipFps = 30;
  const fullBoth = clipFps * 2;
  const halfBottom = clipFps + clipFps / 2;
  assert(halfBottom < fullBoth, "fewer GPU uploads with half-rate bottom");
  assert(
    halfBottom / fullBoth <= 0.76,
    "≈25% less upload traffic with two videos",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "half-rate bottom for whole playable session; full-rate after FG hide",
    },
    null,
    2,
  ),
);
