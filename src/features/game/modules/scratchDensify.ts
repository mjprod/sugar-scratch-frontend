/**
 * In-place densify for one coalesced stroke segment (Phase leftover 6).
 * Same stamp positions as the old alloc-per-rAF helper; no new point objects.
 */

export type DensifyPoint = { x: number; y: number };

/** Fine-pointer cap (`resolveManualScratchBudget` maxPoints). */
export const DENSIFY_STROKE_CAPACITY = 40;

export function createDensifyBuffer(
  capacity = DENSIFY_STROKE_CAPACITY,
): DensifyPoint[] {
  const slots: DensifyPoint[] = [];
  for (let i = 0; i < capacity; i += 1) {
    slots.push({ x: 0, y: 0 });
  }
  return slots;
}

function writeSlot(slot: DensifyPoint, x: number, y: number): void {
  slot.x = x;
  slot.y = y;
}

/**
 * Densify `[from, to]` into `out`. Returns live count.
 * Reads from/to before writing so `from` may alias `out[0]`.
 */
export function densifyStrokeSegment(
  out: DensifyPoint[],
  from: DensifyPoint,
  to: DensifyPoint,
  maxStep: number,
  maxPoints: number,
): number {
  const cap = Math.min(Math.max(maxPoints, 2), out.length);
  if (cap < 2) return 0;

  const x0 = from.x;
  const y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);

  writeSlot(out[0]!, x0, y0);
  writeSlot(out[1]!, x1, y1);
  if (dist <= maxStep) return 2;

  const steps = Math.ceil(dist / maxStep);
  const rawCount = steps + 1;
  if (rawCount <= cap) {
    for (let i = 1; i < rawCount; i += 1) {
      const t = i / steps;
      writeSlot(out[i]!, x0 + dx * t, y0 + dy * t);
    }
    return rawCount;
  }

  const lastIndex = steps;
  for (let i = 1; i < cap - 1; i += 1) {
    const idx = Math.round((i / (cap - 1)) * lastIndex);
    const t = idx / steps;
    writeSlot(out[i]!, x0 + dx * t, y0 + dy * t);
  }
  writeSlot(out[cap - 1]!, x1, y1);
  return cap;
}

/** First stamp of a stroke: one point, no interpolation. */
export function densifyStrokeStart(
  out: DensifyPoint[],
  point: DensifyPoint,
): number {
  if (out.length < 1) return 0;
  writeSlot(out[0]!, point.x, point.y);
  return 1;
}
