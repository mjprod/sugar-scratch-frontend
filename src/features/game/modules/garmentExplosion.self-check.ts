/**
 * Self-check for the hunt-complete garment explosion finale.
 * Run: npx tsx src/features/game/modules/garmentExplosion.self-check.ts
 */
import {
  chargeAmount,
  explosionOrigin,
  FINALE_BURST_MS,
  FINALE_CHARGE_MS,
  FINALE_REDUCED_MOTION_MS,
  finaleHidesForeground,
  finalePhaseAt,
  finaleTimeline,
  garmentRevealSatisfied,
  shouldExplodeGarment,
} from "./garmentExplosion";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const full = finaleTimeline({ reducedMotion: false });

// Phase order: charge → burst → hold → done, never going backwards.
const order = ["charge", "burst", "hold", "done"];
let last = 0;
for (let ms = 0; ms <= full.resultAtMs + 100; ms += 10) {
  const idx = order.indexOf(finalePhaseAt(ms, full));
  assert(idx >= last, `phase went backwards at ${ms}ms`);
  last = idx;
}
assert(finalePhaseAt(0, full) === "charge", "finale starts charging");
assert(
  finalePhaseAt(FINALE_CHARGE_MS, full) === "burst",
  "burst fires when charge ends",
);

// Load-bearing: the result never shows while shards are still flying.
assert(
  full.resultAtMs >= FINALE_CHARGE_MS + FINALE_BURST_MS,
  "result waits for the burst to finish",
);
assert(
  finalePhaseAt(full.resultAtMs - 1, full) !== "done",
  "not done before resultAtMs",
);
assert(finalePhaseAt(full.resultAtMs, full) === "done", "done at resultAtMs");

// Charge ramps 0 → ~1 and is off once the burst starts.
assert(chargeAmount(0, full) === 0, "charge starts at 0");
assert(
  chargeAmount(FINALE_CHARGE_MS * 0.5, full) <
    chargeAmount(FINALE_CHARGE_MS * 0.9, full),
  "charge builds up",
);
assert(chargeAmount(FINALE_CHARGE_MS, full) === 0, "charge off at burst");

// Clothes keep drawing only while charging.
assert(!finaleHidesForeground("charge"), "clothes visible while charging");
assert(finaleHidesForeground("burst"), "clothes hidden once shattered");
assert(finaleHidesForeground("hold"), "clothes hidden during hold");

// Reduced motion: no charge, short path to the result.
const reduced = finaleTimeline({ reducedMotion: true });
assert(finalePhaseAt(0, reduced) !== "charge", "reduced motion skips charge");
assert(chargeAmount(0, reduced) === 0, "reduced motion has no charge");
assert(
  reduced.resultAtMs === FINALE_REDUCED_MOTION_MS &&
    reduced.resultAtMs < full.resultAtMs,
  "reduced motion resolves sooner",
);

// Trigger policy.
const base = {
  useBodySymbols: true,
  found: 6,
  total: 6,
  alreadyStarted: false,
  packRevealBlocked: false,
};
assert(shouldExplodeGarment(base), "explodes when every symbol is found");
assert(
  !shouldExplodeGarment({ ...base, found: 5 }),
  "waits for the last symbol",
);
assert(
  !shouldExplodeGarment({ ...base, alreadyStarted: true }),
  "fires once per card",
);
assert(
  !shouldExplodeGarment({ ...base, packRevealBlocked: true }),
  "blocked pack reveal keeps the old path",
);
assert(
  !shouldExplodeGarment({ ...base, useBodySymbols: false }),
  "legacy cards without body symbols never explode",
);

// Reveal gate.
assert(
  garmentRevealSatisfied({ exploded: true, fullyRevealed: false }),
  "exploded garment counts as revealed",
);
assert(
  !garmentRevealSatisfied({ exploded: false, fullyRevealed: false }),
  "partially scratched garment is not revealed",
);

// Origin: last resolved symbol, else fallback.
const fallback = { x: 195, y: 336 };
const o1 = explosionOrigin([{ x: 1, y: 2 }, null, { x: 3, y: 4 }], fallback);
assert(o1.x === 3 && o1.y === 4, "origin is the last found symbol");
const o2 = explosionOrigin([{ x: 1, y: 2 }, null], fallback);
assert(o2.x === 1 && o2.y === 2, "skips unresolved points");
const o3 = explosionOrigin([], fallback);
assert(o3.x === fallback.x && o3.y === fallback.y, "falls back to center");

console.log("garmentExplosion self-check OK");
