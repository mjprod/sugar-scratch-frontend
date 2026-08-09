/**
 * ponytail: tiny assert for collection progress tone + creator theme slots + CTA priority.
 * Run: npx tsx src/v8/flow/collection.self-check.ts
 */
import {
  getCreatorPage,
  getStickyCtaMode,
  progressTone,
  scratchReadyCount,
} from "./collection";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(progressTone(100).includes("34D399"), "100% should be green");
assert(progressTone(20).includes("F59E0B"), "<30% should be orange");
assert(progressTone(52).includes("8B5CF6"), "mid should be brand purple gradient");

const emily = getCreatorPage("emily");
assert(emily.themes.length === 5, "each creator has 5 themes");
assert(emily.themeDetails.summer.photoCards.length === 10, "10 photo slots");
assert(emily.themeDetails.summer.motionCards.length === 3, "3 motion slots");
assert(
  emily.themeDetails.summer.photoCards.filter((c) => c.isUnlocked).length === 6,
  "summer starts with 6 unlocked photos",
);
assert(
  emily.themeDetails.summer.photoCards.every((c) => Boolean(c.thumbnailUrl)),
  "locked photo slots keep silhouette thumbnails",
);
assert(
  emily.creator.stats.motionCardsTotal === 15,
  "motion totals sum theme motion slots",
);
assert(
  emily.creator.stats.photoCardsTotal === 50,
  "photo totals are 5 themes × 10",
);

const summer = emily.themes[0];
const summerDetail = emily.themeDetails.summer;
assert(scratchReadyCount(summerDetail) > 0, "summer has scratch-ready cards");
assert(
  getStickyCtaMode({
    detail: summerDetail,
    collected: summer.collected,
    total: summer.total,
  }) === "scratch",
  "scratch-ready beats open-pack",
);

const police = emily.themes[1];
assert(
  getStickyCtaMode({
    detail: emily.themeDetails.police,
    collected: police.collected,
    total: police.total,
  }) === "open-pack",
  "police packs + no scratch → open-pack",
);

const cyber = emily.themes[2];
assert(
  getStickyCtaMode({
    detail: emily.themeDetails.cyber,
    collected: cyber.collected,
    total: cyber.total,
  }) === "claim",
  "complete + rewardReady → claim",
);
assert(
  getStickyCtaMode({
    detail: { ...emily.themeDetails.cyber, rewardReady: false },
    collected: cyber.collected,
    total: cyber.total,
  }) === "view",
  "complete without reward → view",
);

const midnight = emily.themes[3];
assert(
  getStickyCtaMode({
    detail: emily.themeDetails.midnight,
    collected: midnight.collected,
    total: midnight.total,
  }) === "buy-theme-pack",
  "incomplete + no packs → buy-theme-pack",
);

assert(getStickyCtaMode({ detail: null, collected: 0, total: 0 }) === null, "null detail hides CTA");

console.log("collection.self-check: ok");
