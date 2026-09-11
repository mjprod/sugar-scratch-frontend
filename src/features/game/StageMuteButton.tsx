import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getGameAudioPrefs,
  setBackgroundMusicEnabled,
  setSoundEffectEnabled,
  subscribeGameAudioPrefs,
} from "@/services/gameAudioPrefs";

/**
 * Right top-chrome control: same pill as pause, mute symbol.
 * Toggles both SFX and background music together (pause popup no longer has rows).
 */
export function StageMuteButton() {
  const [soundOn, setSoundOn] = useState(() => {
    const prefs = getGameAudioPrefs();
    return prefs.soundEffect || prefs.backgroundMusic;
  });

  useEffect(
    () =>
      subscribeGameAudioPrefs(() => {
        const prefs = getGameAudioPrefs();
        setSoundOn(prefs.soundEffect || prefs.backgroundMusic);
      }),
    [],
  );

  function toggle() {
    const next = !soundOn;
    setSoundEffectEnabled(next);
    setBackgroundMusicEnabled(next);
    setSoundOn(next);
  }

  return (
    <button
      type="button"
      className={`stage-game__pause stage-game__mute${soundOn ? "" : " is-muted"}`}
      aria-label={soundOn ? "Mute sounds" : "Unmute sounds"}
      aria-pressed={!soundOn}
      onClick={toggle}
    >
      {soundOn ? (
        <Volume2 aria-hidden="true" size={17} strokeWidth={2.4} />
      ) : (
        <VolumeX aria-hidden="true" size={17} strokeWidth={2.4} />
      )}
    </button>
  );
}
