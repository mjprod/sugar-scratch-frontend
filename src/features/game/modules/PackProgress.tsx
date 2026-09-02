import type { CSSProperties } from "react";

type PackProgressProps = {
  current: number;
  total: number;
};

/** Compact card-stack pack progress — top-right gameplay HUD. */
export function PackProgress({ current, total }: PackProgressProps) {
  if (total <= 0 || current < 1 || current > total) return null;
  const remaining = total - current;
  const isFinal = remaining === 0;
  const stack = Math.min(remaining, 4);

  return (
    <div
      className={["pack-progress", isFinal ? "is-final" : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label={
        isFinal
          ? `Final card, card ${current} of ${total}`
          : `${remaining} left, card ${current} of ${total}`
      }
    >
      {!isFinal ? (
        <span
          key={remaining}
          className="pack-progress__stack"
          aria-hidden="true"
        >
          {Array.from({ length: stack }, (_, i) => (
            <span
              key={i}
              className="pack-progress__card"
              style={{ "--i": i } as CSSProperties}
            />
          ))}
        </span>
      ) : null}
      <div className="pack-progress__copy">
        <p className="pack-progress__remain">
          {isFinal ? (
            <>
              <span className="pack-progress__spark" aria-hidden="true">
                ✦
              </span>
              FINAL CARD
            </>
          ) : (
            `${remaining} LEFT`
          )}
        </p>
        <p className="pack-progress__pos">
          CARD {current} OF {total}
        </p>
      </div>
    </div>
  );
}
