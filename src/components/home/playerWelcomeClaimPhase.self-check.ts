/**
 * Offline invariants for daily-claim chrome phase recovery.
 * Run: npx tsx src/components/home/playerWelcomeClaimPhase.self-check.ts
 */
import {
  CLAIM_CARD_EXIT_FALLBACK_MS,
  CLAIM_CARD_EXIT_MS,
  nextClaimUiPhaseOnTick,
  shouldArmClaimExitFallback,
} from "./playerWelcomeClaimPhase.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(CLAIM_CARD_EXIT_MS === 620, "matches theme exit duration");
assert(
  CLAIM_CARD_EXIT_FALLBACK_MS > CLAIM_CARD_EXIT_MS,
  "fallback sits past CSS exit",
);
assert(
  CLAIM_CARD_EXIT_FALLBACK_MS - CLAIM_CARD_EXIT_MS >= 100,
  "fallback has headroom for animationend lag",
);

assert(nextClaimUiPhaseOnTick("ready", false) === "ready", "ready stays ready");
assert(
  nextClaimUiPhaseOnTick("exiting", false) === "ready",
  "midnight clears exiting",
);
assert(
  nextClaimUiPhaseOnTick("claimed", false) === "ready",
  "midnight clears claimed",
);

assert(
  nextClaimUiPhaseOnTick("ready", true) === "ready",
  "claimed day does not force ready→claimed without exit",
);
assert(
  nextClaimUiPhaseOnTick("exiting", true) === "claimed",
  "stuck exiting recovers to claimed when already granted",
);
assert(
  nextClaimUiPhaseOnTick("claimed", true) === "claimed",
  "claimed stays claimed",
);

assert(shouldArmClaimExitFallback("exiting"), "arm timeout while exiting");
assert(!shouldArmClaimExitFallback("ready"), "no timeout on ready");
assert(!shouldArmClaimExitFallback("claimed"), "no timeout on claimed");

// ready → exiting → claimed (happy path contract)
{
  let phase = nextClaimUiPhaseOnTick("ready", false);
  assert(phase === "ready", "start ready");
  phase = "exiting";
  assert(shouldArmClaimExitFallback(phase), "exit arms fallback");
  phase = nextClaimUiPhaseOnTick(phase, true);
  assert(phase === "claimed", "exit settles claimed");
  assert(!shouldArmClaimExitFallback(phase), "claimed disarms fallback");
}

console.log("playerWelcomeClaimPhase self-check passed");
