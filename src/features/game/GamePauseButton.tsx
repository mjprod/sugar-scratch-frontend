import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, Pause, Volume2 } from "lucide-react";

import {
  getGameAudioPrefs,
  setBackgroundMusicEnabled,
  setSoundEffectEnabled,
  subscribeGameAudioPrefs,
} from "@/services/gameAudioPrefs";

/** Same tw-glass stack the top navigation bar uses, so the panel matches it. */
const NAV_GLASS =
  "glass glass-strength-40 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface";

/**
 * Pause control for the scratch stage: opens an overlay with the audio
 * switches plus resume / leave. The overlay covers the stage and swallows
 * input, so the game is effectively suspended while it is open.
 *
 * Layout: sit inside `.stage-game__top-chrome-side` so the button is flex-
 * centered in the gutter between the frame edge and the middle symbol bar.
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
  const [prefs, setPrefs] = useState(getGameAudioPrefs);

  useEffect(
    () => subscribeGameAudioPrefs(() => setPrefs(getGameAudioPrefs())),
    [],
  );

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
        className={`game-pause__panel ${NAV_GLASS}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="game-pause__title">
          Paused
        </h2>
        <div className="game-pause__rows">
          <PauseAudioRow
            icon={Music2}
            label="Background Music"
            checked={prefs.backgroundMusic}
            onChange={setBackgroundMusicEnabled}
          />
          <PauseAudioRow
            icon={Volume2}
            label="Sound Effect"
            checked={prefs.soundEffect}
            onChange={setSoundEffectEnabled}
          />
        </div>
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

function PauseAudioRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof Volume2;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="game-pause__row">
      <span className="game-pause__row-icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className="game-pause__row-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={["game-pause__switch", checked ? "is-on" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onChange(!checked)}
      >
        <span className="game-pause__switch-knob" aria-hidden="true" />
      </button>
    </div>
  );
}
