import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  feedbackLabel,
  FRAME_H,
  FRAME_RX,
  FRAME_W,
  roundedRectPerimeter,
  energyTrailPath,
  type NormalizedPoint,
} from "./scratchFrameGeometry";

export type SymbolDiscoveryBatch = {
  key: number;
  positions: NormalizedPoint[];
  foundAfter: number;
};

type ActiveTrail = {
  id: number;
  d: string;
};

type ScratchFrameProgressProps = {
  active: boolean;
  found: number;
  total: number;
  batches: SymbolDiscoveryBatch[];
  /** Card resolved with no match — let the accumulated energy fade out. */
  settling?: boolean;
};

/** Keep the stroke fully inside the clipped stage box. */
const FRAME_INSET = 4;
const RECT_W = FRAME_W - FRAME_INSET * 2;
const RECT_H = FRAME_H - FRAME_INSET * 2;
const PERIMETER = roundedRectPerimeter(RECT_W, RECT_H, FRAME_RX);
/* Keep in sync with the matching CSS durations in scratch/styles.css. */
const TRAIL_MS = 420;
const SWEEP_MS = 760;
const PULSE_MS = 280;
const FEEDBACK_SHOW_MS = 1600;
const FEEDBACK_FADE_MS = 250;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const ScratchFrameProgress = memo(function ScratchFrameProgress({
  active,
  found,
  total,
  batches,
  settling = false,
}: ScratchFrameProgressProps) {
  const uid = useId().replace(/:/g, "");
  const reducedMotion = prefersReducedMotion();
  const [trails, setTrails] = useState<ActiveTrail[]>([]);
  const [feedback, setFeedback] = useState<{
    found: number;
    fading: boolean;
  } | null>(null);
  const [completeSweep, setCompleteSweep] = useState(false);
  const [completePulse, setCompletePulse] = useState(false);
  const processedBatchKeys = useRef(new Set<number>());
  const trailIdRef = useRef(0);
  const feedbackTimerRef = useRef<number | null>(null);

  // Frame growth is the CSS transition on stroke-dashoffset (260ms, no delay).
  const dashOffset =
    PERIMETER * (1 - (total > 0 ? Math.min(1, found / total) : 0));

  useEffect(() => {
    if (!active) return;
    for (const batch of batches) {
      if (processedBatchKeys.current.has(batch.key)) continue;
      processedBatchKeys.current.add(batch.key);

      setFeedback({ found: batch.foundAfter, fading: false });
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback((current) =>
          current ? { ...current, fading: true } : current,
        );
        window.setTimeout(() => setFeedback(null), FEEDBACK_FADE_MS);
      }, FEEDBACK_SHOW_MS);

      if (reducedMotion) continue;

      for (const pos of batch.positions) {
        const id = (trailIdRef.current += 1);
        const d = energyTrailPath(pos);
        setTrails((current) => [...current, { id, d }]);
        window.setTimeout(() => {
          setTrails((current) => current.filter((trail) => trail.id !== id));
        }, TRAIL_MS + 80);
      }

      if (batch.foundAfter === total) {
        const sweepAt = TRAIL_MS + 180;
        window.setTimeout(() => setCompleteSweep(true), sweepAt);
        window.setTimeout(() => {
          setCompleteSweep(false);
          setCompletePulse(true);
        }, sweepAt + SWEEP_MS);
        window.setTimeout(
          () => setCompletePulse(false),
          sweepAt + SWEEP_MS + PULSE_MS,
        );
      }
    }
  }, [active, batches, reducedMotion, total]);

  // `found === 0` also resets: the frame stays mounted across the no-match
  // settle, so a card handoff can happen without `active` ever going false.
  useEffect(() => {
    if (!active || found === 0) {
      processedBatchKeys.current.clear();
      setTrails([]);
      setFeedback(null);
      setCompleteSweep(false);
      setCompletePulse(false);
    }
  }, [active, found]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  if (!active) return null;

  const frameClass = [
    "scratch-frame-progress",
    settling ? "is-settling" : "",
    found >= total ? "is-complete" : "",
    found === 4 ? "is-milestone-4" : "",
    found === 8 ? "is-milestone-8" : "",
    found === 11 ? "is-almost" : "",
    completeSweep ? "is-sweeping" : "",
    completePulse ? "is-pulsing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const feedbackCopy = feedback
    ? feedbackLabel(feedback.found, total)
    : null;

  return (
    <div className={frameClass} aria-hidden="true">
      <svg
        className="scratch-frame-progress__svg"
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`${uid}-progress-gradient`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={FRAME_W}
            y2={FRAME_H}
          >
            <stop offset="0%" stopColor="#FF9BCB" />
            <stop offset="45%" stopColor="#FFD6B0" />
            <stop offset="75%" stopColor="#F4B7FF" />
            <stop offset="100%" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <rect
          className="scratch-frame-progress__track"
          x={FRAME_INSET}
          y={FRAME_INSET}
          width={RECT_W}
          height={RECT_H}
          rx={FRAME_RX}
          ry={FRAME_RX}
          vectorEffect="non-scaling-stroke"
        />
        <rect
          className="scratch-frame-progress__progress"
          x={FRAME_INSET}
          y={FRAME_INSET}
          width={RECT_W}
          height={RECT_H}
          rx={FRAME_RX}
          ry={FRAME_RX}
          stroke={`url(#${uid}-progress-gradient)`}
          vectorEffect="non-scaling-stroke"
          style={
            {
              "--frame-perimeter": PERIMETER,
              "--frame-dashoffset": dashOffset,
            } as CSSProperties
          }
        />
        {completeSweep ? (
          <rect
            className="scratch-frame-progress__sweep"
            x={FRAME_INSET}
            y={FRAME_INSET}
            width={RECT_W}
            height={RECT_H}
            rx={FRAME_RX}
            ry={FRAME_RX}
            stroke={`url(#${uid}-progress-gradient)`}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      <svg
        className="scratch-frame-progress__energy"
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        preserveAspectRatio="none"
      >
        {trails.map((trail) => (
          <path
            key={trail.id}
            className="scratch-frame-progress__trail"
            d={trail.d}
            /* Normalized so a short trail (symbol near an edge) travels at the
               same readable speed as a long one from the middle of the card. */
            pathLength={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {feedback && feedbackCopy ? (
        <div
          className={[
            "scratch-frame-progress__feedback",
            feedback.fading ? "is-fading" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          <strong>{feedbackCopy.primary}</strong>
          {feedbackCopy.secondary ? <span>{feedbackCopy.secondary}</span> : null}
        </div>
      ) : null}
    </div>
  );
});
