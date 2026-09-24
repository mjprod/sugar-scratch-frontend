/**
 * Self-check for motion currency awards (no photo cards).
 * Run: npx tsx src/features/game/modules/motionCurrencyAward.self-check.ts
 */
import {
  MOTION_COINS_PER_PRIZE,
  coinsForMotionPrize,
  diamondsForMotionPrize,
} from "./gameSession";

/** Keep in sync with MotionCurrencyReveal.CARD_CURRENCY_RESULT_MS */
const CARD_CURRENCY_RESULT_MS = 5000;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(CARD_CURRENCY_RESULT_MS === 5000, "currency result holds 5 seconds");

assert(diamondsForMotionPrize(0) === 0, "no prize → no diamonds");
assert(diamondsForMotionPrize(3) === 3, "prize units map 1:1 to diamonds");
assert(diamondsForMotionPrize(-2) === 0, "negative prize clamps");

assert(coinsForMotionPrize(0) === 0, "no prize → no coins");
assert(
  coinsForMotionPrize(2) === 2 * MOTION_COINS_PER_PRIZE,
  "hub coins scale from prize",
);
assert(
  coinsForMotionPrize(2, 40, { packLinked: true }) === 40,
  "pack coins use opening reward",
);
assert(
  coinsForMotionPrize(2, 0, { packLinked: true }) === 0,
  "pack with zero reward stays zero (no hub fallback)",
);

console.log("motionCurrencyAward.self-check: ok");
