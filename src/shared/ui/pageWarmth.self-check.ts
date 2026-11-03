/**
 * Splash wait-list policy.
 * Run: npx tsx src/shared/ui/pageWarmth.self-check.ts
 */
import { routeNeedsWait } from "./pageWarmth.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(routeNeedsWait("/"), "home waits");
assert(routeNeedsWait("/discover"), "discover waits");
assert(routeNeedsWait("/rank"), "rank waits");
assert(routeNeedsWait("/search"), "search waits");
assert(routeNeedsWait("/creator/sophia"), "creator waits");
assert(routeNeedsWait("/purchase/abc"), "purchase waits");
assert(routeNeedsWait("/collection"), "collection waits");
assert(routeNeedsWait("/collection?reveal=packs"), "collection packs waits");
assert(routeNeedsWait("/get-diamonds"), "store waits");

assert(!routeNeedsWait("/settings"), "settings is static");
assert(!routeNeedsWait("/inbox"), "inbox uses local skeleton only");
assert(!routeNeedsWait("/rewards"), "rewards skips splash");
assert(!routeNeedsWait("/pack-pocket"), "pack pocket skips splash");
assert(!routeNeedsWait("/pre-loader"), "pre-loader preview never waits");
assert(!routeNeedsWait("/loading"), "legacy loading never waits");

console.log("pageWarmth.self-check: ok");
