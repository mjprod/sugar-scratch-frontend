/**
 * Self-check for continuous frame progress geometry.
 * Run: npx tsx src/features/game/modules/scratchFrameGeometry.self-check.ts
 */
import {
  feedbackLabel,
  roundedRectPerimeter,
} from "./scratchFrameGeometry";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// Perimeter: a zero-radius rect is just 2(w+h).
assert(
  Math.abs(roundedRectPerimeter(100, 200, 0) - 600) < 1e-9,
  "square perimeter should be 2(w+h)",
);
// Rounded corners are shorter than square ones.
assert(
  roundedRectPerimeter(100, 200, 10) < roundedRectPerimeter(100, 200, 0),
  "rounded corners shorten the perimeter",
);

// Milestone copy: only 10, 11, and completion deviate from "X / N Found".
assert(feedbackLabel(7, 12).primary === "7 / 12", "normal find shows X / N");
assert(feedbackLabel(7, 12).secondary === "Found", "normal find shows Found");
assert(feedbackLabel(10, 12).primary === "Almost there…", "10 shows almost there");
assert(feedbackLabel(11, 12).primary === "✦ One left", "11 shows one left");
assert(feedbackLabel(12, 12).primary === "12 / 12", "completion shows full count");
// A smaller total must shift the milestones, not hardcode 11.
assert(feedbackLabel(5, 6).primary === "✦ One left", "one-left tracks total");

console.log("scratchFrameGeometry.self-check: ok");
