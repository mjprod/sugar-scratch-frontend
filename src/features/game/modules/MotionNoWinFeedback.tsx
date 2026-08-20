import { useEffect, useRef } from "react";

type MotionNoWinFeedbackProps = {
  resultId: string;
  onComplete: () => void;
};

const DURATION_MS = 1600;
const SAFETY_MS = 2800;

/** Short automatic no-win beat — no CTAs, no card flip. */
export function MotionNoWinFeedback({
  resultId,
  onComplete,
}: MotionNoWinFeedbackProps) {
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
      className="motion-no-win"
      role="status"
      aria-live="polite"
      aria-label="No photo card this time"
    >
      <div className="motion-no-win__backdrop" aria-hidden="true" />
      <div className="motion-no-win__card">
        <h2 className="motion-no-win__title">No Photo Card This Time</h2>
        <p className="motion-no-win__support">Better luck next time.</p>
      </div>
    </div>
  );
}
