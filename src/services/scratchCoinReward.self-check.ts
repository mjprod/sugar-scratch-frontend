/**
 * Scratch coin persist — client wallet must not merge the server snapshot.
 * Run: npx tsx src/services/scratchCoinReward.self-check.ts
 */
import {
  isScratchHandQuotaExhausted,
  markScratchHandQuotaExhausted,
  nextWalletAfterScratchPersist,
  persistScratchCoins,
  resetScratchHandQuotaForTests,
  scratchCoinAwardAction,
  SCRATCH_COIN_MAX,
  SCRATCH_COIN_MIN,
  SCRATCH_HAND_QUOTA_BACKOFF_MS,
} from "./scratchCoinReward.ts";
import {
  SCRATCH_COIN_MAX as AWARD_MAX,
  SCRATCH_COIN_MIN as AWARD_MIN,
} from "../features/game/modules/sparkleCoinAward";

// Compile-time guard: persistScratchCoins must not accept an applyWallet callback argument.
// @ts-expect-error persistScratchCoins should have exactly one argument
type _PersistScratchCoinsSecondArg = Parameters<typeof persistScratchCoins>[1];
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(SCRATCH_COIN_MIN === 30, "service floor is 30");
assert(SCRATCH_COIN_MAX === 100, "service ceil is 100");
assert(SCRATCH_COIN_MIN === AWARD_MIN, "service MIN matches sparkleCoinAward");
assert(SCRATCH_COIN_MAX === AWARD_MAX, "service MAX matches sparkleCoinAward");

const local = { coins: 190, diamonds: 8 };

{
  const next = nextWalletAfterScratchPersist(
    local,
    { coins: 190, diamonds: 0 },
    { authed: true },
  );
  assert(next.diamonds === 8, "persist snapshot must not wipe local diamonds");
  assert(next.coins === 190, "coins stay at optimistic local credit");
}

{
  const next = nextWalletAfterScratchPersist(
    { coins: 0, diamonds: 0 },
    { coins: 500, diamonds: 20 },
    { authed: false },
  );
  assert(next.coins === 0 && next.diamonds === 0, "late persist after logout must not restore prior wallet");
}

{
  const next = nextWalletAfterScratchPersist(
    { coins: 40, diamonds: 10 },
    { coins: 190, diamonds: 3 },
    { authed: true },
  );
  assert(next.coins === 40, "persist must not undo a local coin spend");
  assert(next.diamonds === 10, "persist must not revert local diamond credit");
}

{
  const next = nextWalletAfterScratchPersist(local, null, { authed: true });
  assert(next === local || (next.coins === local.coins && next.diamonds === local.diamonds), "null remote keeps local");
}

{
  resetScratchHandQuotaForTests();
  const t0 = 1_000_000;
  assert(!isScratchHandQuotaExhausted("user-a", t0), "no 429 yet → not exhausted");

  markScratchHandQuotaExhausted("user-a", t0);
  assert(isScratchHandQuotaExhausted("user-a", t0 + 1), "429 blocks the same account");
  assert(
    isScratchHandQuotaExhausted("user-a", t0 + SCRATCH_HAND_QUOTA_BACKOFF_MS - 1),
    "block holds for the whole backoff",
  );
  assert(
    !isScratchHandQuotaExhausted("user-a", t0 + SCRATCH_HAND_QUOTA_BACKOFF_MS),
    "long-lived tab retries after backoff (rolling 24h window)",
  );

  markScratchHandQuotaExhausted("user-a", t0);
  assert(!isScratchHandQuotaExhausted("user-b", t0 + 1), "account switch is not blocked by the previous user's 429");
  assert(!isScratchHandQuotaExhausted("user-a", t0 + 1), "switching away clears the stale block");

  markScratchHandQuotaExhausted("user-a", t0);
  assert(!isScratchHandQuotaExhausted(null, t0 + 1), "logout clears the block");
  resetScratchHandQuotaForTests();
}

{
  assert(
    scratchCoinAwardAction({
      freePlay: true,
      practice: false,
      authed: true,
      handId: "hand-1",
    }) === "skip",
    "theme-toggle free play never awards",
  );
  assert(
    scratchCoinAwardAction({
      freePlay: false,
      practice: true,
      authed: true,
      handId: "hand-1",
    }) === "skip",
    "practice / failed-or-quota hand never awards",
  );
  assert(
    scratchCoinAwardAction({
      freePlay: false,
      practice: false,
      authed: true,
      handId: "hand-1",
    }) === "persist",
    "paid hand with a server id persists",
  );
  assert(
    scratchCoinAwardAction({
      freePlay: false,
      practice: false,
      authed: true,
      handId: "  ",
    }) === "hold",
    "signed-in without a hand must hold, not optimistic-credit",
  );
  assert(
    scratchCoinAwardAction({
      freePlay: false,
      practice: false,
      authed: true,
      handId: "",
    }) === "hold",
    "empty handId while signed in holds milestones until start returns",
  );
  assert(
    scratchCoinAwardAction({
      freePlay: false,
      practice: false,
      authed: false,
      handId: "",
    }) === "local",
    "guest play may juice the HUD without persist",
  );
}

console.log("scratch coin reward self-check passed");
