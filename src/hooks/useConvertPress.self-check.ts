/**
 * Convert button touch phases: preview → confirm, or tap-away cancel.
 * Run: npx tsx src/hooks/useConvertPress.self-check.ts
 */
import { nextConvertTouchPhase } from "./useConvertPress.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const first = nextConvertTouchPhase("idle", "tap-button");
assert(first.phase === "preview" && !first.convert, "first tap only previews");

const second = nextConvertTouchPhase("preview", "tap-button");
assert(second.phase === "idle" && second.convert, "second tap converts");

const away = nextConvertTouchPhase("preview", "tap-away");
assert(away.phase === "idle" && !away.convert, "tap away cancels without convert");

const reset = nextConvertTouchPhase("preview", "reset");
assert(reset.phase === "idle" && !reset.convert, "reset clears preview");

const idleAway = nextConvertTouchPhase("idle", "tap-away");
assert(idleAway.phase === "idle" && !idleAway.convert, "away while idle is a no-op");

console.log("useConvertPress.self-check: ok");
