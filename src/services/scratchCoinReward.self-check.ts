/**
 * Scratch coin persist — client wallet must not merge the server snapshot.
 * Run: npx tsx src/services/scratchCoinReward.self-check.ts
 */
import { nextWalletAfterScratchPersist, persistScratchCoins } from "./scratchCoinReward.ts";

// Compile-time guard: persistScratchCoins must not accept an applyWallet callback argument.
// @ts-expect-error persistScratchCoins should have exactly one argument
type _PersistScratchCoinsSecondArg = Parameters<typeof persistScratchCoins>[1];
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

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

console.log("scratch coin reward self-check passed");
