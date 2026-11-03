/**
 * Sound mix live setters / report.
 * Run: npx tsx src/features/game/shared/soundMix.self-check.ts
 */
import {
  SOUND_MIX_CHANNELS,
  SOUND_MIX_DEFAULTS,
  formatSoundMixReport,
  getSoundMix,
  resetSoundMix,
  setSoundMixGain,
  soundMixGain,
} from "./soundMix.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(SOUND_MIX_CHANNELS.includes("bgm"), "bgm channel");
assert(soundMixGain("match") === SOUND_MIX_DEFAULTS.match, "default match");

setSoundMixGain("match", 0.8);
assert(soundMixGain("match") === 0.8, "set match");
assert(getSoundMix().match === 0.8, "getSoundMix reflects set");

setSoundMixGain("countdown", 99);
assert(soundMixGain("countdown") === 2, "clamp high");
setSoundMixGain("countdown", -1);
assert(soundMixGain("countdown") === 0, "clamp low");

resetSoundMix();
assert(
  SOUND_MIX_CHANNELS.every(
    (channel) => soundMixGain(channel) === SOUND_MIX_DEFAULTS[channel],
  ),
  "reset restores defaults",
);

const report = formatSoundMixReport();
assert(report.includes("SOUND_MIX_DEFAULTS"), "report has const form");
assert(report.includes('"bgm"'), "report has JSON");

console.log("soundMix.self-check: ok");
