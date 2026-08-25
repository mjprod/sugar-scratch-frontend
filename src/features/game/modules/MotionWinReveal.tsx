import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_BACK_URL } from "@/features/reveal/lib/cards";
import type { PhotoCard } from "./session";

export type MotionWinRevealProps = {
  photos: PhotoCard[];
  /** Stable id for this result — prevents replay on parent re-render. */
  resultId: string;
  onComplete: () => void;
};

type Phase =
  | "entering"
  | "appearing"
  | "revealing"
  | "confirmed"
  | "minimizing"
  | "complete";

const MAX_VISIBLE = 3;
const SAFETY_MS = 2500;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function PhotoLayers({ photo }: { photo: PhotoCard }) {
  return (
    <div className="motion-win-reveal__layers">
      <img alt="" src={photo.background} />
      <img alt="" src={photo.bikini} />
      <img alt="" src={photo.clothes} />
    </div>
  );
}

/**
 * Automatic Motion Card Win Reveal (~1.5–1.8s) — presentation only.
 * Rewards must already be persisted before this mounts.
 */
export function MotionWinReveal({
  photos,
  resultId,
  onComplete,
}: MotionWinRevealProps) {
  const [phase, setPhase] = useState<Phase>("entering");
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const count = photos.length;
  const visible = photos.slice(0, MAX_VISIBLE);
  const extra = Math.max(0, count - visible.length);
  const reduced = prefersReducedMotion();
  const durationMs = count <= 1 ? 1500 : 1800;

  function finish() {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase("complete");
    onCompleteRef.current();
  }

  useEffect(() => {
    completedRef.current = false;
    setPhase("entering");
    setFlipped(
      reduced
        ? visible.map(() => true)
        : Array.from({ length: visible.length }, () => false),
    );

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    if (reduced) {
      at(60, () => setPhase("appearing"));
      at(140, () => setPhase("revealing"));
      at(400, () => setPhase("confirmed"));
      at(900, () => setPhase("minimizing"));
      at(1200, finish);
      at(SAFETY_MS, finish);
      return () => timers.forEach((id) => window.clearTimeout(id));
    }

    at(100, () => setPhase("appearing"));
    at(280, () => setPhase("revealing"));

    visible.forEach((_, index) => {
      const start = 400 + index * 100;
      at(start, () => {
        setFlipped((prev) => {
          const next = [...prev];
          next[index] = true;
          return next;
        });
      });
    });

    const revealDone = 400 + visible.length * 100 + 180;
    at(Math.max(revealDone, 750), () => setPhase("confirmed"));
    at(Math.max(revealDone + 320, 1100), () => setPhase("minimizing"));
    at(durationMs, finish);
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
        "motion-win-reveal",
        `is-${phase}`,
        reduced ? "is-reduced" : "",
        fading ? "is-fading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label={`You won ${count} photo card${count === 1 ? "" : "s"}`}
    >
      <div className="motion-win-reveal__backdrop" aria-hidden="true" />
      <div className="motion-win-reveal__glow" aria-hidden="true" />
      <div className="motion-win-reveal__particles" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>

      <div className="motion-win-reveal__center">
        {showHeader ? (
          <div className="motion-win-reveal__header">
            <p className="motion-win-reveal__won">YOU WON!</p>
            <p className="motion-win-reveal__count">
              {count} Photo Card{count === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        <div
          className={[
            "motion-win-reveal__stage",
            `is-count-${Math.min(visible.length, 3)}`,
            showMini ? "is-minimizing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {visible.map((photo, index) => {
            const isFlipped = flipped[index] === true;
            return (
              <div
                key={photo.id}
                className={[
                  "motion-win-reveal__card",
                  isFlipped ? "is-flipped" : "",
                  phase === "appearing" ||
                  phase === "revealing" ||
                  phase === "confirmed" ||
                  phase === "minimizing"
                    ? "is-visible"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--card-i": index } as CSSProperties}
              >
                <div className="motion-win-reveal__flip">
                  <div className="motion-win-reveal__face motion-win-reveal__face--back">
                    <img src={DEFAULT_BACK_URL} alt="" />
                  </div>
                  <div className="motion-win-reveal__face motion-win-reveal__face--front">
                    <PhotoLayers photo={photo} />
                  </div>
                </div>
              </div>
            );
          })}
          {extra > 0 && !showMini ? (
            <p className="motion-win-reveal__extra">+{extra} more</p>
          ) : null}
        </div>

        {showConfirm ? (
          <p className="motion-win-reveal__owned">Added to your Collection ✓</p>
        ) : null}
      </div>

      <div
        className={[
          "motion-win-reveal__mini",
          showMini ? "is-shown" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!showMini}
      >
        <div className="motion-win-reveal__mini-stack">
          {visible.slice(0, 2).map((photo, index) => (
            <span
              key={photo.id}
              className="motion-win-reveal__mini-card"
              style={{ "--i": index } as CSSProperties}
            >
              <PhotoLayers photo={photo} />
            </span>
          ))}
        </div>
        <span className="motion-win-reveal__mini-new">{count} NEW</span>
      </div>
    </div>
  );
}
