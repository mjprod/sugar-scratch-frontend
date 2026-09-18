/**
 * Pure status-pager geometry (has-pill track gap + active side pads).
 * Used by CoverflowStatusPager so first-layout order is offline-testable.
 */

export type StatusDotMetric = { center: number };

/** CSS under `.has-pill` uses `column-gap: calc(var(--status-gap) + 6px)`. */
export const STATUS_PILL_TRACK_GAP_EXTRA = 6;

export function statusTrackColumnGap(baseGap: number, hasPill: boolean): number {
  return hasPill ? baseGap + STATUS_PILL_TRACK_GAP_EXTRA : baseGap;
}

/**
 * Settled centers along the track for each dot.
 * When `hasPill` is true, active dots get side pads and the track uses the
 * expanded column-gap — same geometry CSS applies under `.has-pill`.
 */
export function buildStatusDotMetrics(opts: {
  total: number;
  active: number;
  hasPill: boolean;
  dotW: number;
  gap: number;
  pillW: number;
  sidePad?: number;
}): StatusDotMetric[] {
  const { total, active, hasPill, dotW, gap, pillW } = opts;
  if (total <= 1) return [];

  const sidePad =
    opts.sidePad ??
    (Number.isFinite(pillW) && Number.isFinite(dotW)
      ? (pillW - dotW) / 2 + 4
      : 0);
  const colGap = statusTrackColumnGap(gap, hasPill);

  const metrics: StatusDotMetric[] = [];
  let offset = 0;
  for (let i = 0; i < total; i++) {
    const isActive = i === active;
    const marginLeft = hasPill && isActive && i !== 0 ? sidePad : 0;
    const marginRight = hasPill && isActive && i !== total - 1 ? sidePad : 0;
    metrics.push({ center: offset + marginLeft + dotW / 2 });
    offset += marginLeft + dotW + marginRight;
    if (i < total - 1) offset += colGap;
  }
  return metrics;
}

/** First layout must measure with pill geometry already assumed. */
export function shouldMeasureWithPillGeometry(opts: {
  interactive: boolean;
  hasPillClass: boolean;
}): boolean {
  return opts.interactive || opts.hasPillClass;
}
