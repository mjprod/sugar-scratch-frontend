/**
 * Run: npx tsx src/features/game/shared/soundMix.self-check.ts
 */
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  },
});
store.set("sugar.soundMix.debug", JSON.stringify({ intro: 0.4, scratch: 3 }));

const { SOUND_MIX_DEFAULTS, formatSoundMix, setSoundMixGain, soundMixGain } =
  await import("./soundMix.ts");

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(soundMixGain("scratch") === 2, "stored gain is restored and clamped");
assert(soundMixGain("intro") === 0.4, "stored intro survives a reload");
assert(soundMixGain("coins") === 1, "coins start at the tuned level");
setSoundMixGain("scratch", 0.4);
assert(soundMixGain("scratch") === 0.4, "slider writes the channel");
setSoundMixGain("coins", 9);
assert(soundMixGain("coins") === 2, "gain clamps at 2");
setSoundMixGain("bgm", -1);
assert(soundMixGain("bgm") === 0, "gain clamps at 0");
const text = formatSoundMix();
assert(text.includes("scratch: 0.4"), "copy block includes the tuned channel");
assert(text.includes("match: 0.4"), "untouched channels stay at the default");
assert(SOUND_MIX_DEFAULTS.bgm === 1, "defaults are not mutated by the live mix");
assert(SOUND_MIX_DEFAULTS.intro === 0.75, "baked intro is not the stored override");

console.log("soundMix.self-check: ok");
