import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

type GameExitConfirmModalProps = {
  open: boolean;
  onStay: () => void;
  onExit: () => void;
  copy?: string;
};

export function GameExitConfirmModal({
  open,
  onStay,
  onExit,
  copy = "Your progress is saved. You can continue scratching anytime.",
}: GameExitConfirmModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onStay();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onStay]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="game-exit-modal" role="presentation">
      <button
        type="button"
        className="game-exit-modal__scrim"
        aria-label="Keep scratching"
        onClick={onStay}
      />
      <div
        className="game-exit-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="game-exit-modal__title">
          Finish Later?
        </h2>
        <p className="game-exit-modal__copy">{copy}</p>
        <button
          type="button"
          className="game-exit-modal__exit"
          onClick={onExit}
        >
          Save & Exit
        </button>
        <button
          type="button"
          className="game-exit-modal__stay"
          onClick={onStay}
        >
          Keep Scratching
        </button>
      </div>
    </div>,
    document.body,
  );
}
