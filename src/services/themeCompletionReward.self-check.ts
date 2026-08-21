/**
 * Theme completion reward ledger — eligibility + idempotent claim.
 */
import {
  claimThemeCompletionReward,
  getThemeCompletionReward,
  resetThemeCompletionRewardsForTests,
  resolveThemeRewardStatus,
} from "./themeCompletionReward.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

resetThemeCompletionRewardsForTests();

const creatorId = "juliana";
const themeId = "police";

assert(resolveThemeRewardStatus(4, 10, false) === "locked", "incomplete → locked");
assert(resolveThemeRewardStatus(10, 10, false) === "claimable", "complete → claimable");
assert(resolveThemeRewardStatus(10, 10, true) === "claimed", "claimed stays claimed");

const locked = getThemeCompletionReward({
  creatorId,
  themeId,
  themeName: "Police",
  collected: 4,
  total: 10,
});
assert(locked.status === "locked", "view locked");

const fail = claimThemeCompletionReward({
  creatorId,
  themeId,
  themeName: "Police",
  collected: 4,
  total: 10,
});
assert(!fail.ok, "cannot claim incomplete");

const first = claimThemeCompletionReward({
  creatorId,
  themeId,
  themeName: "Police",
  collected: 10,
  total: 10,
});
assert(first.ok && !first.alreadyClaimed && first.diamondAmount > 0, "first claim grants");

const second = claimThemeCompletionReward({
  creatorId,
  themeId,
  themeName: "Police",
  collected: 10,
  total: 10,
});
assert(
  second.ok && second.alreadyClaimed && second.diamondAmount === 0,
  `second claim idempotent (got ${JSON.stringify(second)})`,
);

const after = getThemeCompletionReward({
  creatorId,
  themeId,
  themeName: "Police",
  collected: 10,
  total: 10,
});
assert(after.status === "claimed", "persists claimed");

console.log("themeCompletionReward.self-check: ok");
