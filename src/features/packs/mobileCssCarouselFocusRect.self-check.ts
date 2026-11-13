/**
 * Run: npx tsx src/features/packs/mobileCssCarouselFocusRect.self-check.ts
 */
import { shouldApplyFocusRect } from "./mobileCssCarouselFocusRect";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(shouldApplyFocusRect(324, 324), "full-size visual should apply");
assert(shouldApplyFocusRect(280, 324), "coverflow ~0.86 scale should apply");
assert(!shouldApplyFocusRect(40, 324), "mid-swipe postage stamp must not apply");
assert(!shouldApplyFocusRect(0, 324), "zero visual must not apply");
assert(shouldApplyFocusRect(40, 0), "unknown layout still allows positive visual");

console.log("mobileCssCarouselFocusRect.self-check: ok");
