/**
 * Offline invariants for the `?flakes=` URL switch.
 * Run: npx tsx src/features/game/modules/flakesUrlFlag.self-check.ts
 */
import {
  AUTO_SCRATCH_STORAGE_KEY,
  applyFlakesUrlFlag,
  parseFlakesUrlFlag,
} from "./flakesUrlFlag";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

assert(parseFlakesUrlFlag("?flakes=1") === true, "?flakes=1 turns flakes on");
assert(parseFlakesUrlFlag("?flakes=true") === true, "?flakes=true turns flakes on");
assert(parseFlakesUrlFlag("?flakes=0") === false, "?flakes=0 turns flakes off");
assert(parseFlakesUrlFlag("?flakes=off") === false, "?flakes=off turns flakes off");
assert(parseFlakesUrlFlag("") === null, "no param leaves the setting alone");
assert(parseFlakesUrlFlag("?flakes=maybe") === null, "unknown value leaves the setting alone");

{
  const storage = memoryStorage({
    [AUTO_SCRATCH_STORAGE_KEY]: JSON.stringify({ enabled: true, speed: 42, flakes: false }),
  });
  assert(applyFlakesUrlFlag("?flakes=1", storage) === true, "apply reports the flag");
  const saved = JSON.parse(storage.getItem(AUTO_SCRATCH_STORAGE_KEY) ?? "{}");
  assert(saved.flakes === true, "flag is persisted");
  assert(saved.enabled === true && saved.speed === 42, "other auto-scratch settings are kept");
}

{
  const storage = memoryStorage({ [AUTO_SCRATCH_STORAGE_KEY]: "not json" });
  applyFlakesUrlFlag("?flakes=1", storage);
  const saved = JSON.parse(storage.getItem(AUTO_SCRATCH_STORAGE_KEY) ?? "{}");
  assert(saved.flakes === true, "corrupt storage is replaced, not thrown on");
}

{
  const storage = memoryStorage();
  assert(applyFlakesUrlFlag("?other=1", storage) === null, "no param → no-op");
  assert(storage.getItem(AUTO_SCRATCH_STORAGE_KEY) === null, "no param → storage untouched");
}

console.log("flakesUrlFlag self-check: ok");
