/**
 * Offline invariants for coverflow status-pill geometry / first-layout order.
 * Run: npx tsx src/components/home/coverflowStatusMetrics.self-check.ts
 */
import {
  STATUS_PILL_TRACK_GAP_EXTRA,
  buildStatusDotMetrics,
  shouldMeasureWithPillGeometry,
  statusTrackColumnGap,
} from "./coverflowStatusMetrics.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(STATUS_PILL_TRACK_GAP_EXTRA === 6, "has-pill gap extra matches CSS");

assert(statusTrackColumnGap(8, false) === 8, "base gap without pill");
assert(statusTrackColumnGap(8, true) === 14, "has-pill expands column-gap");

assert(
  shouldMeasureWithPillGeometry({ interactive: true, hasPillClass: false }),
  "interactive first paint assumes pill geometry before class lands",
);
assert(
  shouldMeasureWithPillGeometry({ interactive: true, hasPillClass: true }),
  "interactive with class still uses pill geometry",
);
assert(
  !shouldMeasureWithPillGeometry({ interactive: false, hasPillClass: false }),
  "non-interactive without class uses base gap",
);
assert(
  shouldMeasureWithPillGeometry({ interactive: false, hasPillClass: true }),
  "class alone still expands metrics",
);

{
  const base = buildStatusDotMetrics({
    total: 5,
    active: 0,
    hasPill: false,
    dotW: 12.5,
    gap: 8,
    pillW: 37.5,
  });
  const pill = buildStatusDotMetrics({
    total: 5,
    active: 0,
    hasPill: true,
    dotW: 12.5,
    gap: 8,
    pillW: 37.5,
  });
  assert(base.length === 5 && pill.length === 5, "five dots");
  // First active: no left pad either way; centers diverge once gap extra applies.
  assert(base[0]!.center === pill[0]!.center, "first-dot center shared");
  assert(
    pill[1]!.center > base[1]!.center,
    "has-pill pushes later dots by extra gap (+ optional right pad on active)",
  );
}

{
  // First layout bug: measuring without has-pill while painting the floating pill
  // places the pill off the active middle dot.
  const wrongFirstPaint = buildStatusDotMetrics({
    total: 4,
    active: 1,
    hasPill: false,
    dotW: 12.5,
    gap: 8,
    pillW: 37.5,
    sidePad: (37.5 - 12.5) / 2 + 4, // 16.5 — ignored when hasPill false
  });
  const correctFirstPaint = buildStatusDotMetrics({
    total: 4,
    active: 1,
    hasPill: true,
    dotW: 12.5,
    gap: 8,
    pillW: 37.5,
    sidePad: 16.5,
  });
  assert(
    wrongFirstPaint[1]!.center !== correctFirstPaint[1]!.center,
    "middle active center depends on has-pill side pads + gap",
  );
  // Correct order: add has-pill (or assume interactive) THEN measure.
  assert(
    shouldMeasureWithPillGeometry({ interactive: true, hasPillClass: false }),
    "layout effect must measure with pill geometry before class is observable",
  );
  const ordered = buildStatusDotMetrics({
    total: 4,
    active: 1,
    hasPill: shouldMeasureWithPillGeometry({
      interactive: true,
      hasPillClass: false,
    }),
    dotW: 12.5,
    gap: 8,
    pillW: 37.5,
    sidePad: 16.5,
  });
  assert(
    ordered[1]!.center === correctFirstPaint[1]!.center,
    "interactive-first measure matches settled has-pill geometry",
  );
}

assert(buildStatusDotMetrics({
  total: 1,
  active: 0,
  hasPill: true,
  dotW: 12.5,
  gap: 8,
  pillW: 37.5,
}).length === 0, "single dot yields no metrics");

console.log("coverflowStatusMetrics self-check passed");
