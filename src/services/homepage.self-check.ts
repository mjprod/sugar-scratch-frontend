/**
 * Leaderboard display helpers.
 * Run: npx tsx src/services/homepage.self-check.ts
 */
import {
  formatPurchaseCount,
  LEADERBOARD_CATEGORIES,
  PURCHASE_COUNT_CAP,
} from "./homepage.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(PURCHASE_COUNT_CAP === 150_000, "buy cap is 150,000");
assert(formatPurchaseCount(0) === "0", "zero prints 0");
assert(formatPurchaseCount(149_999) === "149,999", "under cap is exact");
assert(formatPurchaseCount(150_000) === "150,000", "at cap is exact");
assert(formatPurchaseCount(150_001) === "150,000+", "over cap is capped");
assert(formatPurchaseCount(1_787_209_825) === "150,000+", "billion-scale capped");
assert(
  LEADERBOARD_CATEGORIES.some((c) => c.id === "hot" && c.label === "🔥 Trending"),
  "hot tab is Trending",
);

console.log("homepage self-check passed");
