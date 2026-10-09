import { useState } from "react";
import { Film, Music2, Volume2 } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  getGameAudioPrefs,
  setBackgroundMusicEnabled,
  setSoundEffectEnabled,
} from "@/services/gameAudioPrefs";
import {
  getHdVideoEnabled,
  setHdVideoEnabled,
} from "@/services/videoQualityPrefs";
import "./game-settings.css";

export function GameSettingsScreen({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState(() => getGameAudioPrefs());
  const [hdVideo, setHdVideo] = useState(() => getHdVideoEnabled());

  function toggleSoundEffect(next: boolean) {
    setSoundEffectEnabled(next);
    setPrefs((prev) => ({ ...prev, soundEffect: next }));
  }

  function toggleBackgroundMusic(next: boolean) {
    setBackgroundMusicEnabled(next);
    setPrefs((prev) => ({ ...prev, backgroundMusic: next }));
  }

  function toggleHdVideo(next: boolean) {
    setHdVideoEnabled(next);
    setHdVideo(next);
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
          <SettingsToggleRow
            icon={Volume2}
            label="Sound Effect"
            checked={prefs.soundEffect}
            onChange={toggleSoundEffect}
          />
          <SettingsToggleRow
            icon={Music2}
            label="Background Music"
            checked={prefs.backgroundMusic}
            onChange={toggleBackgroundMusic}
          />
        </div>
      </section>

      <section className="game-settings-section" aria-labelledby="video-quality">
        <h2 id="video-quality" className="game-settings-section-label">
          Video Quality
        </h2>
        <div className="game-settings-card">
          <SettingsToggleRow
            icon={Film}
            label="HD Videos"
            hint="Sharper cards on newer phones. Uses more data."
            checked={hdVideo}
            onChange={toggleHdVideo}
          />
        </div>
      </section>
    </AppPageShell>
  );
}

function SettingsToggleRow({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: typeof Volume2;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="game-settings-row">
      <span className="game-settings-row-icon" aria-hidden="true">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className="game-settings-row-text">
        <span className="game-settings-row-label">{label}</span>
        {hint ? <span className="game-settings-row-hint">{hint}</span> : null}
      </span>
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
