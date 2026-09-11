import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause } from "lucide-react";

/**
 * Pause control for the scratch stage: opens an overlay with resume / leave.
 * Audio is controlled by the stage mute button (SFX + BGM together).
 *
 * Layout: sit inside `.stage-game__top-chrome-side` so the button is flex-
 * centered in the gutter between the frame edge and the middle symbol bar.
 * Panel is solid (no backdrop-filter / glass).
 */
export function GamePauseButton({ onLeave }: { onLeave: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="stage-game__pause"
        aria-label="Pause game"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Pause aria-hidden="true" size={17} strokeWidth={2.4} />
      </button>
      {open ? (
        <GamePauseModal onResume={() => setOpen(false)} onLeave={onLeave} />
      ) : null}
    </>
  );
}

function GamePauseModal({
  onResume,
  onLeave,
}: {
  onResume: () => void;
  onLeave: () => void;
}) {
  const titleId = useId();
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onResume();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onResume]);

  // Land keyboard focus inside the dialog rather than back on the stage.
  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="game-pause" role="presentation">
      <button
        type="button"
        className="game-pause__scrim"
        aria-label="Resume game"
        onClick={onResume}
      />
      <div
        className="game-pause__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="game-pause__title">
          Paused
        </h2>
        <button
          ref={resumeRef}
          type="button"
          className="game-pause__resume"
          onClick={onResume}
        >
          Resume
        </button>
        <button type="button" className="game-pause__leave" onClick={onLeave}>
          Leave Game
        </button>
      </div>
    </div>,
    document.body,
  );
}
