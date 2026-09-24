import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getGameAudioPrefs,
  setBackgroundMusicEnabled,
  setSoundEffectEnabled,
  subscribeGameAudioPrefs,
} from "@/services/gameAudioPrefs";
import {
  applyBoundThemeIntroSound,
  introNeedsGestureUnlock,
  introVideoIsAudible,
} from "./shared/media";
import {
  isCountdownAudioPlaying,
  resumeCountdownAudioIfActive,
  stopCountdownAudio,
  unlockCountdownSound,
} from "./modules/InitialCountdown";
import {
  isMotionScratchBgmPlaying,
  preloadMotionScratchBgm,
  syncMotionScratchBgm,
} from "./modules/motionScratchBgm";
import { stageMuteIconShowsSoundOn } from "./stageMuteIconPolicy";

function prefsSoundOn() {
  const prefs = getGameAudioPrefs();
  return prefs.soundEffect || prefs.backgroundMusic;
}

function liveAudioOn() {
  return (
    introVideoIsAudible() ||
    isCountdownAudioPlaying() ||
    isMotionScratchBgmPlaying()
  );
}

/**
 * Icon follows what the user can hear. If intro/countdown audio is already
 * playing, show unmuted so the first tap mutes.
 *
 * Hub Play unlocks countdown only — the theme intro may still be autoplay-
 * muted. Treat that as muted so the first tap unlocks the clip.
 */
function audibleSoundOn() {
  return stageMuteIconShowsSoundOn({
    liveAudioOn: liveAudioOn(),
    prefsSoundOn: prefsSoundOn(),
    introNeedsGestureUnlock: introNeedsGestureUnlock(),
  });
}

/**
 * Right top-chrome control: same pill as pause, mute symbol.
 * Toggles both SFX and background music together (pause popup no longer has rows).
 */
export function StageMuteButton() {
  const [soundOn, setSoundOn] = useState(() => audibleSoundOn());

  useEffect(
    () =>
      subscribeGameAudioPrefs(() => {
        setSoundOn(audibleSoundOn());
      }),
    [],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSoundOn((prev) => {
        const next = audibleSoundOn();
        return next === prev ? prev : next;
      });
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  function toggle() {
    // If audio is already playing, the first tap must mute — even when the
    // icon was still showing muted from autoplay/prefs lag.
    const next = liveAudioOn() ? false : !soundOn;
    applyBoundThemeIntroSound(next);
    if (next) {
      unlockCountdownSound();
      preloadMotionScratchBgm();
      resumeCountdownAudioIfActive();
    } else {
      stopCountdownAudio();
    }
    setSoundEffectEnabled(next);
    setBackgroundMusicEnabled(next);
    // Prefs notify is sync; still call play/pause here so unmute stays inside
    // this user gesture on Safari.
    syncMotionScratchBgm();
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
