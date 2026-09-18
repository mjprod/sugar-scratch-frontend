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

/** Horizontal edge band (px) that arms continuous hold-to-advance. */
const EDGE_HOLD_PX = 28;
/** Base cards/sec while holding at an edge (ramps slightly over time). */
const EDGE_HOLD_RATE = 7.5;
/** Full hold-acceleration after this many still edge seconds. */
const EDGE_HOLD_RAMP_SEC = 0.55;
const EDGE_HOLD_MAX_MULT = 2.4;

/**
 * Home-v2 status pill. Scrub only moves the pill; parent selection commits on release.
 * Overflowing tracks (creator decks) scroll inside a max-width capsule; holding the
 * pill at either edge continuously pages slides.
 * // ponytail: no live slideTo while dragging mid-track — was freezing the tab via style thrash
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
  // No hard cap — creator decks can exceed the homepage featured pack count.
  const total = Math.max(0, Math.floor(count));
  const active = Math.min(Math.max(0, activeIndex), Math.max(0, total - 1));
  const interactive = typeof onSelectIndex === "function";

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const metricsRef = useRef<DotMetric[]>([]);
  const scrubbingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const hoverIndexRef = useRef(active);
  const pillWRef = useRef(37.5);
  const hasLaidOutRef = useRef(false);
  const edgeHoldRafRef = useRef(0);
  const edgeHoldDirRef = useRef<-1 | 0 | 1>(0);
  const edgeHoldLastTRef = useRef(0);
  const edgeHoldAccumRef = useRef(0);
  const edgeHoldIdleSecRef = useRef(0);
  const onSelectIndexRef = useRef(onSelectIndex);
  const totalRef = useRef(total);

  useEffect(() => {
    onSelectIndexRef.current = onSelectIndex;
  }, [onSelectIndex]);
  useEffect(() => {
    totalRef.current = total;
  }, [total]);

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
    // Always use the committed active index so side-pad geometry matches the
    // CSS `.is-active` margins (hover/scrub paints the pill without restyling dots).
    const base = buildStatusDotMetrics({
      total,
      active,
      hasPill,
      dotW,
      gap,
      pillW,
      sidePad,
    });
    // Track CSS adds horizontal inset so the wider floating pill can sit on the
    // first/last dots without being clipped by the scrollport.
    const edgeInset = hasPill ? Math.max(0, (pillW - dotW) / 2) : 0;
    metricsRef.current =
      edgeInset > 0
        ? base.map((m) => ({ center: m.center + edgeInset }))
        : base;
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

  const ensureActiveVisible = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollRef.current;
      const metrics = metricsRef.current;
      if (!scroller || metrics.length === 0) return;
      const clamped = Math.max(
        0,
        Math.min(metrics.length - 1, Math.round(index)),
      );
      const sample = metrics[clamped];
      if (!sample) return;

      const viewW = scroller.clientWidth;
      const maxScroll = Math.max(0, scroller.scrollWidth - viewW);
      if (maxScroll <= 0) return;

      // Keep the full pink pill inside the scrollport (not just the rest-dot).
      // Subpixel + last-dot settle needs a small gutter past half pill width.
      const halfPill = pillWRef.current / 2 + 2;
      const center = sample.center;
      const left = center - halfPill;
      const right = center + halfPill;
      const viewLeft = scroller.scrollLeft;
      const viewRight = viewLeft + viewW;

      let next = viewLeft;
      if (clamped <= 0) {
        next = 0;
      } else if (clamped >= metrics.length - 1) {
        next = maxScroll;
      } else if (left < viewLeft) {
        next = left;
      } else if (right > viewRight) {
        next = right - viewW;
      } else {
        return;
      }

      const target = Math.max(0, Math.min(maxScroll, next));
      if (Math.abs(target - viewLeft) < 0.5) return;
      scroller.scrollTo({ left: target, behavior });
    },
    [],
  );

  const indexFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    const metrics = metricsRef.current;
    if (!track || !metrics.length) return 0;
    // Track rect already accounts for scrollport offset; centers are track-local.
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

  const stopEdgeHoldLoop = useCallback(() => {
    if (edgeHoldRafRef.current) {
      cancelAnimationFrame(edgeHoldRafRef.current);
      edgeHoldRafRef.current = 0;
    }
    edgeHoldDirRef.current = 0;
    edgeHoldAccumRef.current = 0;
    edgeHoldIdleSecRef.current = 0;
    edgeHoldLastTRef.current = 0;
  }, []);

  const commitHoverIndex = useCallback(
    (next: number, animatePill: boolean) => {
      const clamped = Math.max(0, Math.min(totalRef.current - 1, next));
      if (clamped === hoverIndexRef.current) {
        ensureActiveVisible(clamped, "auto");
        return clamped;
      }
      hoverIndexRef.current = clamped;
      // Re-measure with the live hover as "active" so side-pads follow the pill.
      measure();
      paintPill(clamped, animatePill);
      ensureActiveVisible(clamped, "auto");
      onSelectIndexRef.current?.(clamped);
      return clamped;
    },
    [ensureActiveVisible, measure, paintPill],
  );

  const tickEdgeHold = useCallback(() => {
    edgeHoldRafRef.current = 0;
    if (!scrubbingRef.current) {
      stopEdgeHoldLoop();
      return;
    }
    const dir = edgeHoldDirRef.current;
    const now = performance.now();
    const lastT = edgeHoldLastTRef.current || now;
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    edgeHoldLastTRef.current = now;

    if (dir !== 0 && dt > 0) {
      edgeHoldIdleSecRef.current = Math.min(
        EDGE_HOLD_RAMP_SEC,
        edgeHoldIdleSecRef.current + dt,
      );
      const holdT = edgeHoldIdleSecRef.current / EDGE_HOLD_RAMP_SEC;
      const mult = 1 + (EDGE_HOLD_MAX_MULT - 1) * (holdT * holdT);
      edgeHoldAccumRef.current += EDGE_HOLD_RATE * mult * dt;

      let steps = 0;
      while (edgeHoldAccumRef.current >= 1 && steps < 8) {
        edgeHoldAccumRef.current -= 1;
        const before = hoverIndexRef.current;
        const next = before + dir;
        if (next < 0 || next >= totalRef.current) {
          edgeHoldAccumRef.current = 0;
          break;
        }
        commitHoverIndex(next, false);
        steps += 1;
      }
    } else {
      edgeHoldIdleSecRef.current = 0;
      edgeHoldAccumRef.current = 0;
    }

    edgeHoldRafRef.current = requestAnimationFrame(tickEdgeHold);
  }, [commitHoverIndex, stopEdgeHoldLoop]);

  const startEdgeHoldLoop = useCallback(() => {
    if (edgeHoldRafRef.current) return;
    edgeHoldLastTRef.current = performance.now();
    edgeHoldRafRef.current = requestAnimationFrame(tickEdgeHold);
  }, [tickEdgeHold]);

  const updateEdgeHoldFromClientX = useCallback(
    (clientX: number) => {
      const scroller = scrollRef.current;
      if (!scroller || totalRef.current <= 1) {
        edgeHoldDirRef.current = 0;
        return;
      }
      const box = scroller.getBoundingClientRect();
      // Prefer the visible capsule edges so hold works even when the track is short.
      const rootBox = rootRef.current?.getBoundingClientRect() ?? box;
      const left = Math.max(box.left, rootBox.left);
      const right = Math.min(box.right, rootBox.right);
      const leftDist = clientX - left;
      const rightDist = right - clientX;
      let dir: -1 | 0 | 1 = 0;
      if (leftDist <= EDGE_HOLD_PX) dir = -1;
      else if (rightDist <= EDGE_HOLD_PX) dir = 1;

      if (dir !== edgeHoldDirRef.current) {
        edgeHoldAccumRef.current = 0;
        edgeHoldIdleSecRef.current = 0;
      }
      edgeHoldDirRef.current = dir;
      if (dir !== 0) startEdgeHoldLoop();
    },
    [startEdgeHoldLoop],
  );

  useLayoutEffect(() => {
    if (scrubbingRef.current) return;
    // Add has-pill before measure so gap/side-pad CSS and JS metrics agree on
    // first mount (otherwise the floating pill can sit off the active dot).
    if (interactive) rootRef.current?.classList.add("has-pill");
    measure();
    // Snap on first layout; ease with the CSS margin transition after that
    paintPill(active, hasLaidOutRef.current);
    ensureActiveVisible(active, hasLaidOutRef.current ? "smooth" : "auto");
    hasLaidOutRef.current = true;
    hoverIndexRef.current = active;
  }, [active, ensureActiveVisible, interactive, measure, paintPill, total]);

  useEffect(() => {
    const onResize = () => {
      if (scrubbingRef.current) return;
      measure();
      paintPill(hoverIndexRef.current, false);
      ensureActiveVisible(hoverIndexRef.current, "auto");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ensureActiveVisible, measure, paintPill]);

  useEffect(
    () => () => {
      stopEdgeHoldLoop();
    },
    [stopEdgeHoldLoop],
  );

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
      stopEdgeHoldLoop();

      const next = event
        ? indexFromClientX(event.clientX)
        : hoverIndexRef.current;
      hoverIndexRef.current = next;
      measure();
      paintPill(next, true);
      ensureActiveVisible(next, "smooth");
      onSelectIndex?.(next);
    },
    [
      ensureActiveVisible,
      indexFromClientX,
      measure,
      onSelectIndex,
      paintPill,
      stopEdgeHoldLoop,
    ],
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
      ensureActiveVisible(next, "auto");
      updateEdgeHoldFromClientX(event.clientX);
    },
    [
      ensureActiveVisible,
      indexFromClientX,
      interactive,
      measure,
      paintPill,
      total,
      updateEdgeHoldFromClientX,
    ],
  );

  const onPillPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (!scrubbingRef.current) return;
      event.preventDefault();
      updateEdgeHoldFromClientX(event.clientX);
      // While edge-hold owns continuous paging, still mirror the finger when
      // it is clearly over a specific dot away from the edge band.
      if (edgeHoldDirRef.current !== 0) return;
      const next = indexFromClientX(event.clientX);
      if (next === hoverIndexRef.current) return;
      hoverIndexRef.current = next;
      paintPill(next, false);
      ensureActiveVisible(next, "auto");
    },
    [
      ensureActiveVisible,
      indexFromClientX,
      paintPill,
      updateEdgeHoldFromClientX,
    ],
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
      <div ref={scrollRef} className="coverflow-status-pager__scroll">
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
    </div>
  );
}
