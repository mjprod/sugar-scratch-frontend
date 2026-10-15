/**
 * AutoScratch shows symbols first, coins after.
 * Run: npx tsx src/features/game/modules/autoScratchPresent.self-check.ts
 */
import {
  queueDeferredMatchIndices,
  shouldDeferAutoScratchCoins,
} from "./autoScratchPresent";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const total = 12;

assert(
  shouldDeferAutoScratchCoins({
    autoEnabled: true,
    symbolsFound: 4,
    symbolTotal: total,
    revealPending: false,
  }),
  "auto hunt defers coins while symbols remain",
);

assert(
  !shouldDeferAutoScratchCoins({
    autoEnabled: true,
    symbolsFound: total,
    symbolTotal: total,
    revealPending: false,
  }),
  "completed hunt can present coins",
);

assert(
  shouldDeferAutoScratchCoins({
    autoEnabled: true,
    symbolsFound: total,
    symbolTotal: total,
    revealPending: true,
  }),
  "pending reveal keeps coins off the scratch frames",
);

assert(
  !shouldDeferAutoScratchCoins({
    autoEnabled: false,
    symbolsFound: 2,
    symbolTotal: total,
    revealPending: false,
  }),
  "manual scratch presents coins immediately",
);

assert(
  queueDeferredMatchIndices([1, 2], [4, 7]).join(",") === "1,2,4,7",
  "queued finds stay in discovery order",
);

assert(
  queueDeferredMatchIndices([1], []).join(",") === "1",
  "empty frame does not drop the queue",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "auto scratch finds symbols first, then coins",
    },
    null,
    2,
  ),
);
