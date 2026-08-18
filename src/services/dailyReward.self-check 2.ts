/**
 * Daily reward self-check.
 * Run: npx tsx src/services/dailyReward.self-check.ts
 */
import {
  DAILY_REWARD_DIAMONDS,
  formatCountdown,
  getDailyRewardResetAt,
} from "./dailyReward.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(DAILY_REWARD_DIAMONDS > 0, "reward amount");
assert(formatCountdown(0) === "00:00:00", "zero countdown");
assert(formatCountdown(3661000) === "01:01:01", "hms countdown");

const now = new Date("2026-08-11T15:00:00");
const resetAt = getDailyRewardResetAt(now);
const reset = new Date(resetAt);
assert(reset.getHours() === 0 && reset.getMinutes() === 0, "midnight reset");
assert(reset.getDate() === 12, "next calendar day");

console.log("v8 daily reward self-check passed");
