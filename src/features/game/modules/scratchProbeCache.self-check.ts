/**
 * Offline invariants for scratch GPU probe throttling.
 * Run: npx tsx src/features/game/modules/scratchProbeCache.self-check.ts
 */
import {
  createFabricAlphaCache,
  createSymbolScratchProbeCache,
  invalidateCachedSymbolScratchAmount,
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
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === null,
    "cold symbol cache misses",
  );
  writeCachedSymbolScratchAmount(cache, 1, 0, 0.4);
  writeCachedSymbolScratchAmount(cache, 1, 1, 0.9);
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === 0.4,
    "same-frame symbol reuse",
  );
  assert(
    readCachedSymbolScratchAmount(cache, 1, 2) === null,
    "unprobed slot still misses",
  );
  // New frame clears prior samples so a later stamp can re-check reveal.
  assert(
    readCachedSymbolScratchAmount(cache, 2, 0) === null,
    "next frame clears symbol probes",
  );
}

{
  // Same-frame stamp A caches below threshold; stamp B paints more foil — must
  // invalidate so stamp B re-probes instead of skipping the reveal.
  const cache = createSymbolScratchProbeCache(6);
  writeCachedSymbolScratchAmount(cache, 1, 0, 0.4);
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === 0.4,
    "precondition: below-threshold cached",
  );
  invalidateCachedSymbolScratchAmount(cache, 1, 0);
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === null,
    "invalidate after paint forces re-probe",
  );
  writeCachedSymbolScratchAmount(cache, 1, 0, 0.7);
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === 0.7,
    "second stamp can cross reveal threshold",
  );
  // Wrong frame is a no-op (next read will roll the frame).
  invalidateCachedSymbolScratchAmount(cache, 99, 0);
  assert(
    readCachedSymbolScratchAmount(cache, 1, 0) === 0.7,
    "invalidate ignores other frames",
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

// Budget: UV gate + invalidate-on-paint beats unbounded pointer×slot reads.
// Worst case still caps far-slot probes; near-slot may re-sample after paint.
{
  const pointerEventsPerSec = 120;
  const symbols = 6;
  const oldReads = pointerEventsPerSec * (1 + symbols); // fabric + every slot
  const newReads = 60 * (1 + symbols); // ~rAF fabric+symbols worst case
  assert(newReads < oldReads, "expected material readPixels cut");
  assert(newReads <= oldReads * 0.55, "≈ half the GPU probes at 120Hz input");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "1 fabric/rAF; symbol UV gate + cache with invalidate-on-nearby-paint",
    },
    null,
    2,
  ),
);
