import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";

export type PhotoDiamondRevealProps = {
  diamonds: number;
  /** Stable id for this result — prevents replay on parent re-render. */
  resultId: string;
  onComplete: () => void;
};

type Phase =
  | "entering"
  | "appearing"
  | "confirmed"
  | "minimizing"
  | "complete";

/** Per-card result hold before auto-advance to the next card. */
export const CARD_DIAMOND_RESULT_MS = 2000;
const SAFETY_MS = CARD_DIAMOND_RESULT_MS + 800;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Per-card diamond win reveal — presentation only.
 * Session diamonds must already be persisted before this mounts.
 * Auto-advances after ~2s; navigation is handled by the parent.
 */
export function PhotoDiamondReveal({
  diamonds,
  resultId,
  onComplete,
}: PhotoDiamondRevealProps) {
  const [phase, setPhase] = useState<Phase>("entering");
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const reduced = prefersReducedMotion();

  function finish() {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase("complete");
    onCompleteRef.current();
  }

  useEffect(() => {
    completedRef.current = false;
    setPhase("entering");

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const holdMs = reduced ? 1500 : CARD_DIAMOND_RESULT_MS;

    if (reduced) {
      at(120, () => setPhase("appearing"));
      at(600, () => setPhase("confirmed"));
      at(holdMs - 200, () => setPhase("minimizing"));
      at(holdMs, finish);
      at(SAFETY_MS, finish);
      return () => timers.forEach((id) => window.clearTimeout(id));
    }

    at(200, () => setPhase("appearing"));
    at(700, () => setPhase("confirmed"));
    at(holdMs - 300, () => setPhase("minimizing"));
    at(holdMs, finish);
    at(SAFETY_MS, finish);

    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart timeline per resultId
  }, [resultId]);

  const showHeader =
    phase !== "entering" && phase !== "minimizing" && phase !== "complete";
  const showConfirm = phase === "confirmed" || phase === "minimizing";
  const showMini = phase === "minimizing" || phase === "complete";
  const fading = phase === "complete";

  return (
    <div
      className={[
        "photo-diamond-reveal",
        `is-${phase}`,
        reduced ? "is-reduced" : "",
        fading ? "is-fading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label={`You won ${diamonds} diamond${diamonds === 1 ? "" : "s"}`}
    >
      <div className="photo-diamond-reveal__backdrop" aria-hidden="true" />
      <div className="photo-diamond-reveal__glow" aria-hidden="true" />
      <div className="photo-diamond-reveal__particles" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>

      <div className="photo-diamond-reveal__center">
        {showHeader ? (
          <div className="photo-diamond-reveal__header">
            <p className="photo-diamond-reveal__won">YOU WON!</p>
            <p className="photo-diamond-reveal__count">
              {diamonds} Diamond{diamonds === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        <div
          className={[
            "photo-diamond-reveal__hero",
            phase === "appearing" ||
            phase === "confirmed" ||
            phase === "minimizing"
              ? "is-visible"
              : "",
            showMini ? "is-minimizing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="photo-diamond-reveal__icon" aria-hidden="true">
            <DiamondLottie size={88} />
          </div>
          <p className="photo-diamond-reveal__amount">{diamonds}</p>
        </div>
      </div>

      <div
        className={[
          "photo-diamond-reveal__mini",
          showMini ? "is-shown" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!showMini}
      >
        <span className="photo-diamond-reveal__mini-icon" aria-hidden="true">
          <DiamondLottie size={28} />
        </span>
        <span className="photo-diamond-reveal__mini-new">+{diamonds}</span>
      </div>
    </div>
  );
}
