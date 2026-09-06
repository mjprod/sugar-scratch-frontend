/**
 * Self-check for the match flight path: arc shape, ease-out pacing, and the
 * scale/opacity/trail ramps.
 *
 * Run: npx tsx src/features/game/modules/matchFlightPath.self-check.ts
 */
import {
  MATCH_OPACITY_TO,
  MATCH_SCALE_FROM,
  MATCH_SCALE_TO,
  MATCH_TRAIL_LIFE_MS,
  MATCH_TRAIL_SPAWN_MS,
  MATCH_TRAIL_STOP_PROGRESS,
  MATCH_TRAVEL_MS,
  easeOutCubic,
  flightControlPoint,
  flightOpacity,
  flightScale,
  quadraticBezier,
  type Point,
} from "./matchFlightPath";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

// Screen space: y grows downward, so "higher up" means a smaller y.
const from: Point = { x: 120, y: 520 };
const to: Point = { x: 300, y: 60 };
const control = flightControlPoint(from, to);

// --- easing: ends pinned, monotonic, and front-loaded (decelerating) ---
assert(near(easeOutCubic(0), 0), "eased 0 must be 0");
assert(near(easeOutCubic(1), 1), "eased 1 must be 1");
assert(
  easeOutCubic(0.5) > 0.5,
  "ease-out must be ahead of linear at the midpoint (fast start, slow finish)",
);
for (let i = 1; i <= 100; i += 1) {
  const prev = easeOutCubic((i - 1) / 100);
  const now = easeOutCubic(i / 100);
  assert(now > prev, `easing must be monotonic (broke at ${i})`);
}
// Decelerating: each later step covers less ground than the one before.
for (let i = 2; i <= 100; i += 1) {
  const a = easeOutCubic((i - 2) / 100);
  const b = easeOutCubic((i - 1) / 100);
  const c = easeOutCubic(i / 100);
  assert(c - b < b - a, `easing must decelerate (broke at ${i})`);
}

// --- control point: horizontal midpoint, lifted above both ends ---
assert(
  near(control.x, (from.x + to.x) / 2),
  "control x must be the horizontal midpoint",
);
assert(
  control.y < Math.min(from.y, to.y),
  "control must sit above the higher of the two ends",
);
assert(
  near(control.y, Math.min(from.y, to.y) - Math.abs(from.y - to.y) * 0.4),
  "arc rise should be 40% of the vertical distance when that clears the floor",
);
// A short, near-horizontal hop still has to bow noticeably.
const flatFrom: Point = { x: 0, y: 100 };
const flatTo: Point = { x: 60, y: 90 };
assert(
  near(flightControlPoint(flatFrom, flatTo).y, 90 - 80),
  "short hops must fall back to the 80px minimum rise",
);

// --- path: endpoints exact, and genuinely curved rather than straight ---
const start = quadraticBezier(from, control, to, 0);
const end = quadraticBezier(from, control, to, 1);
assert(near(start.x, from.x) && near(start.y, from.y), "t=0 must be the start");
assert(near(end.x, to.x) && near(end.y, to.y), "t=1 must be the slot");

// At t=0.5 a midpoint control puts x exactly on the straight line, so any
// difference in y is pure curvature.
const half = quadraticBezier(from, control, to, 0.5);
assert(
  near(half.x, (from.x + to.x) / 2),
  "curve should cross the straight line's midpoint horizontally",
);
assert(
  half.y < (from.y + to.y) / 2,
  "curve must bow upward, not run straight to the slot",
);

// x advances without backtracking.
for (let i = 1; i <= 100; i += 1) {
  const prev = quadraticBezier(from, control, to, (i - 1) / 100).x;
  const now = quadraticBezier(from, control, to, i / 100).x;
  assert(now > prev, `path must not backtrack horizontally (broke at ${i})`);
}

// --- scale and opacity ramps ---
assert(near(flightScale(0), MATCH_SCALE_FROM), "scale starts at 1");
assert(near(flightScale(1), MATCH_SCALE_TO), "scale ends at 0.55");
assert(
  flightScale(1) < flightScale(0),
  "icon must be smaller on arrival than at the find",
);
assert(near(flightOpacity(0), 1), "opacity starts opaque");
assert(near(flightOpacity(1), MATCH_OPACITY_TO), "opacity ends at 0.9");
for (let i = 0; i <= 100; i += 1) {
  assert(
    flightOpacity(i / 100) >= MATCH_OPACITY_TO,
    "this is a slight dim, never a fade-out",
  );
}

// --- trail: stops before arrival, but with no gap before the landing ---
// Eased progress runs ahead of the clock, so 0.9 lands well before the end.
const stopLinear = 1 - (1 - MATCH_TRAIL_STOP_PROGRESS) ** (1 / 3);
assert(
  stopLinear > 0.4 && stopLinear < 0.7,
  `trail should stop around mid-flight, got ${stopLinear}`,
);
const remainingMs = MATCH_TRAVEL_MS * (1 - stopLinear);
assert(
  MATCH_TRAIL_LIFE_MS >= remainingMs,
  `last dot dies ${remainingMs - MATCH_TRAIL_LIFE_MS}ms before arrival, leaving a gap`,
);
assert(
  MATCH_TRAIL_SPAWN_MS * 4 < remainingMs,
  "spawn interval should be short enough to read as a continuous trail",
);

console.log("matchFlightPath.self-check: ok");
