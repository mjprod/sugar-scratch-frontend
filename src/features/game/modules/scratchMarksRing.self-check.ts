/**
 * Offline invariants for scratch marks ring buffer (Phase 7).
 * Run: npx tsx src/features/game/modules/scratchMarksRing.self-check.ts
 */
import {
  clearScratchMarks,
  createScratchMarksRing,
  pushScratchMark,
  scratchMarksSome,
  SCRATCH_MARKS_CAPACITY,
} from "./scratchMarksRing";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

{
  const ring = createScratchMarksRing(4);
  pushScratchMark(ring, 0.1, 0.2, 0.05);
  pushScratchMark(ring, 0.3, 0.4, 0.05);
  assert(ring.length === 2, "length grows");
  assert(
    scratchMarksSome(ring, (m) => m.u === 0.1 && m.v === 0.2),
    "finds first mark",
  );
  const slot0 = ring.slots[0]!;
  pushScratchMark(ring, 0.5, 0.6, 0.05);
  assert(ring.slots[0] === slot0, "reuses preallocated slot objects");
}

{
  const ring = createScratchMarksRing(3);
  pushScratchMark(ring, 1, 0, 0.1);
  pushScratchMark(ring, 2, 0, 0.1);
  pushScratchMark(ring, 3, 0, 0.1);
  pushScratchMark(ring, 4, 0, 0.1);
  assert(ring.length === 3, "caps at capacity");
  assert(!scratchMarksSome(ring, (m) => m.u === 1), "oldest evicted");
  assert(scratchMarksSome(ring, (m) => m.u === 4), "newest kept");
  assert(scratchMarksSome(ring, (m) => m.u === 2), "middle kept");
}

{
  const ring = createScratchMarksRing(2);
  pushScratchMark(ring, 9, 9, 0.1);
  clearScratchMarks(ring);
  assert(ring.length === 0, "clear resets");
  assert(!scratchMarksSome(ring, () => true), "clear empties");
}

assert(SCRATCH_MARKS_CAPACITY === 180, "capacity matches prior slice(-180)");

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "in-place ring push; no per-stamp array alloc",
      SCRATCH_MARKS_CAPACITY,
    },
    null,
    2,
  ),
);
