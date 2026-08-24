import { useState } from "react";
import { Music2, Volume2 } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  getGameAudioPrefs,
  setBackgroundMusicEnabled,
  setSoundEffectEnabled,
} from "@/services/gameAudioPrefs";
import "./game-settings.css";

export function GameSettingsScreen({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState(() => getGameAudioPrefs());

  function toggleSoundEffect(next: boolean) {
    setSoundEffectEnabled(next);
    setPrefs((prev) => ({ ...prev, soundEffect: next }));
  }

  function toggleBackgroundMusic(next: boolean) {
    setBackgroundMusicEnabled(next);
    setPrefs((prev) => ({ ...prev, backgroundMusic: next }));
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Game Settings"
      className="game-settings-page"
    >
      <SubpageHeader
        title="Game Settings"
        onBack={onBack}
        backLabel="Back to profile"
      />

      <section className="game-settings-section" aria-labelledby="music-control">
        <h2 id="music-control" className="game-settings-section-label">
          Music Control
        </h2>
        <div className="game-settings-card">
          <AudioToggleRow
            icon={Volume2}
            label="Sound Effect"
            checked={prefs.soundEffect}
            onChange={toggleSoundEffect}
          />
          <AudioToggleRow
            icon={Music2}
            label="Background Music"
            checked={prefs.backgroundMusic}
            onChange={toggleBackgroundMusic}
          />
        </div>
      </section>
    </AppPageShell>
  );
}

function AudioToggleRow({
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
    <div className="game-settings-row">
      <span className="game-settings-row-icon" aria-hidden="true">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className="game-settings-row-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={["game-settings-switch", checked ? "is-on" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onChange(!checked)}
      >
        <span className="game-settings-switch-knob" aria-hidden="true" />
      </button>
    </div>
  );
}
