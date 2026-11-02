/**
 * Offline invariants for per-rAF getBoundingClientRect coalescing.
 * Run: npx tsx src/features/game/modules/frameClientRect.self-check.ts
 */
import {
  clearFrameClientRectCache,
  createFrameClientRectCache,
  readFrameClientRect,
} from "./frameClientRect";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

{
  let reads = 0;
  const el = {
    getBoundingClientRect() {
      reads += 1;
      return { left: 10, top: 20, width: 100, height: 200 } as DOMRect;
    },
  };
  const cache = createFrameClientRectCache();
  const pending: Array<() => void> = [];
  const schedule = (cb: () => void) => {
    pending.push(cb);
    return pending.length;
  };

  const a = readFrameClientRect(cache, el, schedule);
  const b = readFrameClientRect(cache, el, schedule);
  assert(reads === 1, "one layout read per frame");
  assert(a === b, "same rect object until rAF");
  assert(a.left === 10 && a.width === 100, "returns live rect");

  for (const flush of pending) flush();
  readFrameClientRect(cache, el, schedule);
  assert(reads === 2, "next frame reads again");
}

{
  let cancelled = 0;
  const cache = createFrameClientRectCache();
  const el = {
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1, height: 1 } as DOMRect;
    },
  };
  readFrameClientRect(cache, el, () => 7);
  clearFrameClientRectCache(cache, () => {
    cancelled += 1;
  });
  assert(cancelled === 1, "clear cancels pending rAF");
  assert(cache.rect === null && cache.raf === 0, "clear empties cache");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "getBoundingClientRect once per rAF; pointermove reuses it",
    },
    null,
    2,
  ),
);
