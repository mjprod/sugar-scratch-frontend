/**
 * Offline invariants for in-place stroke densify.
 * Run: npx tsx src/features/game/modules/scratchDensify.self-check.ts
 */
import { resolveManualScratchBudget } from "./scratchStampBudget";
import {
  createDensifyBuffer,
  DENSIFY_STROKE_CAPACITY,
  densifyStrokeSegment,
  densifyStrokeStart,
} from "./scratchDensify";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function coords(out: { x: number; y: number }[], n: number) {
  return out.slice(0, n).map((p) => [p.x, p.y]);
}

/** Previous alloc-per-call densify, kept here as the shape oracle. */
function legacyDensify(
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxStep: number,
  maxPoints: number,
): { x: number; y: number }[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxStep) return [from, to];
  const steps = Math.ceil(dist / maxStep);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push({ x: from.x + dx * t, y: from.y + dy * t });
  }
  if (points.length <= maxPoints) return points;
  const kept: { x: number; y: number }[] = [points[0]!];
  const lastIndex = points.length - 1;
  for (let i = 1; i < maxPoints - 1; i += 1) {
    const idx = Math.round((i / (maxPoints - 1)) * lastIndex);
    kept.push(points[idx]!);
  }
  kept.push(points[lastIndex]!);
  return kept;
}

const fine = resolveManualScratchBudget({ coarsePointer: false });
const coarse = resolveManualScratchBudget({ coarsePointer: true });
assert(
  DENSIFY_STROKE_CAPACITY >= fine.maxPoints,
  "buffer covers fine maxPoints",
);
assert(fine.maxPoints > coarse.maxPoints, "coarse densifies fewer");

{
  const buf = createDensifyBuffer(4);
  const n = densifyStrokeStart(buf, { x: 3, y: 7 });
  assert(n === 1, "start is one stamp");
  assert(buf[0]!.x === 3 && buf[0]!.y === 7, "start writes slot 0");
  const slot0 = buf[0];
  densifyStrokeStart(buf, { x: 1, y: 2 });
  assert(buf[0] === slot0, "start reuses slot object");
}

{
  const buf = createDensifyBuffer();
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  const n = densifyStrokeSegment(buf, from, to, 100, 12);
  assert(n === 2, "short segment is two stamps");
  assert(buf[0]!.x === 0 && buf[1]!.x === 10, "keeps endpoints");
}

{
  const buf = createDensifyBuffer();
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 0 };
  const maxStep = 10;
  const maxPoints = 40;
  const n = densifyStrokeSegment(buf, from, to, maxStep, maxPoints);
  const legacy = legacyDensify(from, to, maxStep, maxPoints);
  assert(n === legacy.length, "full densify count matches");
  for (let i = 0; i < n; i += 1) {
    assert(
      buf[i]!.x === legacy[i]!.x && buf[i]!.y === legacy[i]!.y,
      `stamp ${i} matches legacy`,
    );
  }
}

{
  const buf = createDensifyBuffer();
  const from = { x: 0, y: 0 };
  const to = { x: 400, y: 300 };
  const n = densifyStrokeSegment(buf, from, to, 8, 12);
  const legacy = legacyDensify(from, to, 8, 12);
  assert(n === 12, "long segment caps at maxPoints");
  assert(n === legacy.length, "downsample count matches");
  for (let i = 0; i < n; i += 1) {
    assert(
      Math.abs(buf[i]!.x - legacy[i]!.x) < 1e-9 &&
        Math.abs(buf[i]!.y - legacy[i]!.y) < 1e-9,
      `downsampled stamp ${i} matches legacy`,
    );
  }
}

{
  const buf = createDensifyBuffer(8);
  const slot0 = buf[0]!;
  slot0.x = 5;
  slot0.y = 5;
  const n = densifyStrokeSegment(buf, slot0, { x: 15, y: 5 }, 100, 8);
  assert(n === 2, "alias from still two stamps");
  assert(buf[0]!.x === 5 && buf[1]!.x === 15, "alias from keeps start");
  assert(buf[0] === slot0, "still the same slot object");
}

{
  const buf = createDensifyBuffer();
  densifyStrokeSegment(buf, { x: 1, y: 1 }, { x: 2, y: 2 }, 0.5, 12);
  const first = coords(buf, 2);
  densifyStrokeSegment(buf, { x: 9, y: 9 }, { x: 10, y: 10 }, 0.5, 12);
  assert(buf[0]!.x === 9 && buf[0]!.y === 9, "second call overwrites slots");
  assert(first[0]![0] === 1, "oracle captured previous coords");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "in-place densify; stamp coords match legacy",
      DENSIFY_STROKE_CAPACITY,
    },
    null,
    2,
  ),
);
