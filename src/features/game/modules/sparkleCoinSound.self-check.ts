/**
 * Offline invariants for sparkle coin SFX helpers.
 * Run: npx tsx src/features/game/modules/sparkleCoinSound.self-check.ts
 *
 * DOM Audio isn't available in Node — we only assert the mute/exclusive API surface
 * and that stop/play are safe no-ops without a document.
 */
import {
  playSparkleCoinSound,
  preloadSparkleCoinSounds,
  stopSparkleCoinSounds,
} from "./sparkleCoinSound";
import { SPARKLE_COIN_BANDS } from "./sparkleCoinAward";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(typeof stopSparkleCoinSounds === "function", "stopSparkleCoinSounds export");
assert(typeof playSparkleCoinSound === "function", "playSparkleCoinSound export");
assert(typeof preloadSparkleCoinSounds === "function", "preloadSparkleCoinSounds export");

// Safe in Node (no HTMLAudioElement) — must not throw.
stopSparkleCoinSounds();
preloadSparkleCoinSounds();
for (const band of SPARKLE_COIN_BANDS) {
  playSparkleCoinSound(band.soundSrc);
}
playSparkleCoinSound("");
stopSparkleCoinSounds();

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "mute → stopSparkleCoinSounds; play → stop all bands first so clips never stack",
    },
    null,
    2,
  ),
);
