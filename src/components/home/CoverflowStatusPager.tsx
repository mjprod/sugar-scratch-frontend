import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  buildStatusDotMetrics,
  shouldMeasureWithPillGeometry,
  type StatusDotMetric,
} from "./coverflowStatusMetrics";

type DotMetric = StatusDotMetric;

/**
 * Home-v2 status pill. Scrub only moves the pill; parent selection commits on release.
 * // ponytail: no live slideTo while dragging — was freezing the tab via style thrash
 */
export function CoverflowStatusPager({
  count,
  activeIndex,
  onSelectIndex,
  className,
  ariaLabel = "Featured packs",
  itemLabel = (index, total) => `Pack ${index + 1} of ${total}`,
}: {
  count: number;
  activeIndex: number;
  onSelectIndex?: (index: number) => void;
  className?: string;
  /** Accessible name for the tablist (guest home welcome slides, etc.). */
  ariaLabel?: string;
  /** Per-dot accessible name. */
  itemLabel?: (index: number, total: number) => string;
}) {
  const total = Math.max(0, Math.min(count, 12));
  const active = Math.min(Math.max(0, activeIndex), Math.max(0, total - 1));
  const interactive = typeof onSelectIndex === "function";

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const metricsRef = useRef<DotMetric[]>([]);
  const scrubbingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const hoverIndexRef = useRef(active);
  const pillWRef = useRef(37.5);
  const hasLaidOutRef = useRef(false);

  const measure = useCallback(() => {
    if (total <= 1) {
      metricsRef.current = [];
      return;
    }
    const root = rootRef.current;
    // Final geometry from CSS vars (not live rects) so margin transitions
    // can ease dots while the pill still targets the settled layout.
    const styles = root ? getComputedStyle(root) : null;
    const read = (name: string, fallback: number) => {
      const n = Number.parseFloat(styles?.getPropertyValue(name) ?? "");
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    const dotW = read("--status-dot", 12.5);
    const gap = read("--status-gap", 8);
    const pillW = read("--status-pill-w", 37.5);
    const sidePad = read(
      "--status-pill-side-pad",
      (pillW - dotW) / 2 + 4,
    );
    // Interactive / floating pill layout must use has-pill gap + side pads even
    // on the first paint — class may be added in the same layout effect.
    const hasPill = shouldMeasureWithPillGeometry({
      interactive,
      hasPillClass: Boolean(root?.classList.contains("has-pill")),
    });
    pillWRef.current = pillW;
    metricsRef.current = buildStatusDotMetrics({
      total,
      active,
      hasPill,
      dotW,
      gap,
      pillW,
      sidePad,
    });
  }, [active, interactive, total]);

  const paintPill = useCallback((index: number, animate: boolean) => {
    const pill = pillRef.current;
    const metrics = metricsRef.current;
    if (!pill || !metrics.length) return;
    const sample =
      metrics[Math.max(0, Math.min(metrics.length - 1, index))] ?? metrics[0];
    if (!sample) return;
    const x = sample.center - pillWRef.current / 2;
    pill.style.transition = animate
      ? "transform 320ms cubic-bezier(0.34, 1.45, 0.48, 1)"
      : "none";
    pill.style.transform = `translate3d(${x}px, -50%, 0)`;
  }, []);

  const indexFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    const metrics = metricsRef.current;
    if (!track || !metrics.length) return 0;
    const x = clientX - track.getBoundingClientRect().left;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < metrics.length; i++) {
      const d = Math.abs(metrics[i]!.center - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }, []);

  useLayoutEffect(() => {
    if (scrubbingRef.current) return;
    // Add has-pill before measure so gap/side-pad CSS and JS metrics agree on
    // first mount (otherwise the floating pill can sit off the active dot).
    if (interactive) rootRef.current?.classList.add("has-pill");
    measure();
    // Snap on first layout; ease with the CSS margin transition after that
    paintPill(active, hasLaidOutRef.current);
    hasLaidOutRef.current = true;
    hoverIndexRef.current = active;
  }, [active, interactive, measure, paintPill, total]);

  useEffect(() => {
    const onResize = () => {
      if (scrubbingRef.current) return;
      measure();
      paintPill(hoverIndexRef.current, false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, paintPill]);

  const endScrub = useCallback(
    (event?: ReactPointerEvent<HTMLSpanElement>) => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      const pill = pillRef.current;
      if (pill && event && pointerIdRef.current != null) {
        try {
          pill.releasePointerCapture(pointerIdRef.current);
        } catch {
          /* noop */
        }
      }
      pointerIdRef.current = null;
      pill?.classList.remove("is-held");
      rootRef.current?.classList.remove("is-scrubbing");

      const next = event
        ? indexFromClientX(event.clientX)
        : hoverIndexRef.current;
      hoverIndexRef.current = next;
      paintPill(next, true);
      onSelectIndex?.(next);
    },
    [indexFromClientX, onSelectIndex, paintPill],
  );

  const onPillPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (!interactive || total <= 1) return;
      event.preventDefault();
      event.stopPropagation();
      scrubbingRef.current = true;
      pointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add("is-held");
      rootRef.current?.classList.add("is-scrubbing");
      measure();
      const next = indexFromClientX(event.clientX);
      hoverIndexRef.current = next;
      paintPill(next, false);
    },
    [indexFromClientX, interactive, measure, paintPill, total],
  );

  const onPillPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (!scrubbingRef.current) return;
      event.preventDefault();
      const next = indexFromClientX(event.clientX);
      if (next === hoverIndexRef.current) return;
      hoverIndexRef.current = next;
      paintPill(next, false);
    },
    [indexFromClientX, paintPill],
  );

  if (total <= 1) return null;

  return (
    <div
      ref={rootRef}
      className={[
        "coverflow-status-pager",
        interactive ? "is-interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div ref={trackRef} className="coverflow-status-pager__track">
        {interactive ? (
          <span
            ref={pillRef}
            className="coverflow-status-pager__pill"
            aria-hidden="true"
            onPointerDown={onPillPointerDown}
            onPointerMove={onPillPointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
          >
            <span className="coverflow-status-pager__pill-face" />
          </span>
        ) : null}
        {Array.from({ length: total }, (_, index) => {
          const isActive = index === active;
          // first: pad right only; last: pad left only; middle: both
          const edge =
            isActive && total > 1
              ? index === 0
                ? "is-first"
                : index === total - 1
                  ? "is-last"
                  : "is-mid"
              : "";
          const label = itemLabel(index, total);
          const className = [
            "coverflow-status-pager__dot",
            isActive ? "is-active" : "",
            edge,
          ]
            .filter(Boolean)
            .join(" ");
          if (!interactive) {
            return (
              <span
                key={index}
                className={className}
                role="tab"
                aria-selected={isActive}
                aria-label={label}
              />
            );
          }
          return (
            <button
              key={index}
              type="button"
              className={className}
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => {
                if (scrubbingRef.current) return;
                onSelectIndex?.(index);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
