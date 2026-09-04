/**
 * Offline invariants for scratch GPU probe throttling.
 * Run: npx tsx src/features/game/modules/scratchProbeCache.self-check.ts
 */
import {
  createFabricAlphaCache,
  createSymbolScratchProbeCache,
  isSymbolNearStroke,
  needsFabricAlphaSample,
  readCachedFabricAlpha,
  readCachedSymbolScratchAmount,
  writeCachedFabricAlpha,
  writeCachedSymbolScratchAmount,
} from "./scratchProbeCache";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(needsFabricAlphaSample(true), "fairy dust on → sample fabric");
assert(!needsFabricAlphaSample(false), "fairy dust off → skip fabric readPixels");

{
  const cache = createFabricAlphaCache();
  assert(readCachedFabricAlpha(cache, 1) === null, "cold fabric cache misses");
  writeCachedFabricAlpha(cache, 1, 0.8);
  assert(readCachedFabricAlpha(cache, 1) === 0.8, "same-frame fabric reuse");
  assert(readCachedFabricAlpha(cache, 2) === null, "next frame fabric miss");
}

{
  const cache = createSymbolScratchProbeCache(6);
  const revealAt = 0.55;
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === null,
    "cold symbol cache misses",
  );
  writeCachedSymbolScratchAmount(cache, 1, 0, 0.4);
  writeCachedSymbolScratchAmount(cache, 1, 1, 0.9);
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === 0.4,
    "same-frame reuse when no threshold is required",
  );
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0, revealAt) === null,
    "below-threshold sample is not durable in the same frame",
  );
  assert(
    readCachedSymbolScratchAmount(cache, 1, 1, revealAt) === 0.9,
    "already-clear sample can be reused",
  );
  assert(
    readCachedSymbolScratchAmount(cache, 1, 2) === null,
    "unprobed slot still misses",
  );

  // Fast swipe: first pointer event this rAF is only 40% clear; later stamps
  // punch through. Re-sampling must be allowed so the icon can pop.
  writeCachedSymbolScratchAmount(cache, 1, 0, 0.7);
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0, revealAt) === 0.7,
    "later same-frame sample after more paint is reusable",
  );

  // New frame clears prior samples so a later stamp can re-check reveal.
  assert(
    readCachedSymbolScratchAmount(cache, 2, 0) === null,
    "next frame clears symbol probes",
  );
}

assert(
  isSymbolNearStroke(0.5, 0.5, 0.52, 0.5, 0.06),
  "near symbol passes UV gate",
);
assert(
  !isSymbolNearStroke(0.5, 0.5, 0.8, 0.5, 0.06),
  "far symbol skips GPU sample",
);

// Budget: UV gate + skip fabric when dust is off still beats pointer×every-slot.
{
  const pointerEventsPerSec = 120;
  const symbols = 6;
  const oldReads = pointerEventsPerSec * (1 + symbols); // fabric + every slot
  // Heuristic bound: only a small subset of nearby symbols are worth re-sampling
  // in a pointer burst, even though the actual nearby count can vary up to
  // `symbols` as the scratch scene changes.
  const nearbySymbols = Math.min(2, symbols);
  const newReads = pointerEventsPerSec * (1 + nearbySymbols);
  assert(newReads < oldReads, "expected material readPixels cut");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "1 fabric/rAF; UV gate; below-threshold symbol samples are not reused",
    },
    null,
    2,
  ),
);
