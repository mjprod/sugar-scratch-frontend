/**
 * Self-check for continuous frame progress geometry.
 * Run: npx tsx src/features/game/modules/scratchFrameGeometry.self-check.ts
 */
import {
  energyTrailPath,
  feedbackLabel,
  nearestEdgePoint,
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

// Nearest edge picks the genuinely closest side, not just the first match.
assert(nearestEdgePoint(0.5, 0.02).edge === "top", "high point → top edge");
assert(nearestEdgePoint(0.5, 0.98).edge === "bottom", "low point → bottom edge");
assert(nearestEdgePoint(0.02, 0.5).edge === "left", "left point → left edge");
assert(nearestEdgePoint(0.98, 0.5).edge === "right", "right point → right edge");

// Edge points must land exactly on the frame, not floating inside it.
const top = nearestEdgePoint(0.5, 0.1, 390, 672);
assert(top.y === 0, "top edge target sits on y=0");
const right = nearestEdgePoint(0.95, 0.5, 390, 672);
assert(right.x === 390, "right edge target sits on x=width");

// Trail path is a single quadratic curve ending on the frame.
const path = energyTrailPath({ nx: 0.5, ny: 0.2 }, 390, 672);
assert(path.startsWith("M "), "trail starts with a move command");
assert(path.includes(" Q "), "trail uses a quadratic curve, not a straight line");

// Milestone copy: only 10, 11, and completion deviate from "X / N FOUND".
assert(feedbackLabel(7, 12).primary === "7 / 12", "normal find shows X / N");
assert(feedbackLabel(7, 12).secondary === "FOUND", "normal find shows FOUND");
assert(feedbackLabel(10, 12).primary === "ALMOST THERE", "10 shows almost there");
assert(feedbackLabel(11, 12).primary === "✦ ONE LEFT", "11 shows one left");
assert(feedbackLabel(12, 12).primary === "12 / 12", "completion shows full count");
// A smaller total must shift the milestones, not hardcode 11.
assert(feedbackLabel(5, 6).primary === "✦ ONE LEFT", "one-left tracks total");

console.log("scratchFrameGeometry.self-check: ok");
