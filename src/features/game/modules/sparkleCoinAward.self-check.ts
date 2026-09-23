/**
 * Offline invariants for sparkle coin bands + random roll.
 * Run: npx tsx src/features/game/modules/sparkleCoinAward.self-check.ts
 */
import {
  rollSparkleCoin,
  rollSparkleCoinAward,
  SCRATCH_COIN_MAX,
  SCRATCH_COIN_MIN,
  SPARKLE_COIN_BANDS,
  type SparkleCoinBandId,
} from "./sparkleCoinAward";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(SPARKLE_COIN_BANDS.length === 3, "three coin bands");
assert(SCRATCH_COIN_MIN === 30, "floor is 30");
assert(SCRATCH_COIN_MAX === 100, "ceil is 100");

{
  const short = SPARKLE_COIN_BANDS.find((b) => b.id === "short");
  const medium = SPARKLE_COIN_BANDS.find((b) => b.id === "medium");
  const long = SPARKLE_COIN_BANDS.find((b) => b.id === "long");
  assert(!!short && short.min === 30 && short.max === 60, "short 30–60");
  assert(!!medium && medium.min === 61 && medium.max === 80, "medium 61–80");
  assert(!!long && long.min === 81 && long.max === 100, "long 81–100");
  assert(
    short!.soundSrc === "/coins_game/coins_sound_short.mp3",
    "short sound path",
  );
  assert(
    medium!.soundSrc === "/coins_game/coins_sound_medium.mp3",
    "medium sound path",
  );
  assert(
    long!.soundSrc === "/coins_game/coins_sound_long.mp3",
    "long sound path",
  );
}

{
  // Force each band + inclusive endpoints via a scripted RNG sequence.
  // random() calls per roll: 1 (band index) + 1 (amount).
  let step = 0;
  const scripted = () => {
    const values = [
      // short → 30
      0, 0,
      // short → 60
      0, 0.999,
      // medium → 61
      0.34, 0,
      // medium → 80
      0.34, 0.999,
      // long → 81
      0.67, 0,
      // long → 100
      0.67, 0.999,
    ];
    return values[step++] ?? 0;
  };
  const expected: Array<{ band: SparkleCoinBandId; amount: number }> = [
    { band: "short", amount: 30 },
    { band: "short", amount: 60 },
    { band: "medium", amount: 61 },
    { band: "medium", amount: 80 },
    { band: "long", amount: 81 },
    { band: "long", amount: 100 },
  ];
  for (const want of expected) {
    const got = rollSparkleCoinAward(scripted);
    assert(got.band === want.band, `band ${want.band}`);
    assert(got.amount === want.amount, `${want.band} amount ${want.amount}`);
    const meta = SPARKLE_COIN_BANDS.find((b) => b.id === want.band)!;
    assert(got.soundSrc === meta.soundSrc, `${want.band} soundSrc`);
  }
  assert(step === 12, "scripted RNG consumed all steps");
}

{
  const seen = new Set<SparkleCoinBandId>();
  for (let i = 0; i < 300; i += 1) {
    const award = rollSparkleCoinAward();
    const meta = SPARKLE_COIN_BANDS.find((b) => b.id === award.band);
    assert(!!meta, "band exists");
    assert(
      award.amount >= meta!.min && award.amount <= meta!.max,
      `amount ${award.amount} in ${award.band}`,
    );
    assert(award.soundSrc === meta!.soundSrc, "sound matches band");
    assert(
      award.amount >= SCRATCH_COIN_MIN && award.amount <= SCRATCH_COIN_MAX,
      "amount within global floor/ceil",
    );
    seen.add(award.band);
  }
  assert(seen.size === 3, "all three bands appear over many rolls");
}

assert(
  (() => {
    const n = rollSparkleCoin(() => 0);
    return n === 30;
  })(),
  "rollSparkleCoin returns amount only",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "each 10% milestone: random band (30–60 / 61–80 / 81–100) + amount in band + matching coins_game SFX",
    },
    null,
    2,
  ),
);
