import { useEffect, useRef } from "react";

type PhotoNoWinFeedbackProps = {
  resultId: string;
  onComplete: () => void;
};

const DURATION_MS = 2000;
const SAFETY_MS = 2800;

/** Short automatic no-win beat (~2s) after a photo scratch — no CTAs. */
export function PhotoNoWinFeedback({
  resultId,
  onComplete,
}: PhotoNoWinFeedbackProps) {
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    doneRef.current = false;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onCompleteRef.current();
    };

    const t1 = window.setTimeout(finish, DURATION_MS);
    const t2 = window.setTimeout(finish, SAFETY_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [resultId]);

  return (
    <div
      className="photo-no-win"
      role="status"
      aria-live="polite"
      aria-label="No diamonds this time"
    >
      <div className="photo-no-win__backdrop" aria-hidden="true" />
      <div className="photo-no-win__card">
        <h2 className="photo-no-win__title">No Diamonds This Time</h2>
        <p className="photo-no-win__support">Better luck on the next card.</p>
      </div>
    </div>
  );
}
