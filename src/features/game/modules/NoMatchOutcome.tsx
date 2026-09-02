import { useEffect, useRef } from "react";
import { GalleryVerticalEnd } from "lucide-react";

type NoMatchOutcomeProps = {
  onComplete: () => void;
};

/* Keep in sync with the .no-match animation timings in game.css. */
const CONTENT_IN_MS = 780;
const HOLD_MS = 2000;
const FADE_MS = 300;
const TOTAL_MS = CONTENT_IN_MS + HOLD_MS + FADE_MS;

/**
 * Resolved "this card produced nothing" beat. Sits over the scratched card so
 * the player still sees what they just played — an outcome, not an error modal.
 * Advances on its own so a dead card never costs the player a tap.
 */
export function NoMatchOutcome({ onComplete }: NoMatchOutcomeProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = window.setTimeout(() => onCompleteRef.current(), TOTAL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="no-match"
      role="status"
      aria-live="polite"
      aria-label="No match. No symbol found on this card."
    >
      <div className="no-match__overlay" aria-hidden="true" />
      <div className="no-match__content">
        <GalleryVerticalEnd
          className="no-match__icon"
          aria-hidden="true"
          size={36}
          strokeWidth={1.4}
        />
        <h2 className="no-match__title">NO MATCH</h2>
        <p className="no-match__subtitle">No symbol found</p>
      </div>
    </div>
  );
}
