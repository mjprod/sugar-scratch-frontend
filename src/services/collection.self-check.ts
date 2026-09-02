/**
 * ponytail: tiny assert for collection progress tone + creator theme slots + CTA priority.
 * Run: npx tsx src/v8/flow/collection.self-check.ts
 */
import {
  countMatchingScratchReady,
  countMatchingUnopened,
  findThemeDetail,
  getCreatorPage,
  getStickyCtaMode,
  matchLiveThemeId,
  progressTone,
  resolveThemeDetail,
  scratchReadyCount,
} from "./collection";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(progressTone(100).includes("163.22"), "100% should be green");
assert(progressTone(20).includes("70.08"), "<30% should be orange");
assert(progressTone(52).includes("292.72"), "mid should be brand purple gradient");

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

const liveThemes = [
  { id: "cop", name: "Police" },
  { id: "nurse", name: "Nurse" },
];
assert(
  matchLiveThemeId("police", liveThemes, emily.themes) === "cop",
  "static police remaps onto live cop id",
);
assert(
  matchLiveThemeId("Nurse Pack", liveThemes) === "nurse",
  "name + pack suffix remaps onto live nurse",
);
assert(
  matchLiveThemeId("summer", liveThemes, emily.themes) == null,
  "unmatched static id does not invent a live theme",
);

const nurseChip = { id: "nurse", name: "Nurse", thumbnailUrl: "", collected: 2, total: 13, progressColor: "pink" as const };
assert(findThemeDetail(nurseChip, emily.themeDetails) == null, "nurse has no static detail key");

const remappedPolice = findThemeDetail(
  { id: "cop", name: "Police" },
  emily.themeDetails,
);
assert(remappedPolice?.themeId === "police", "cop/Police resolves static police detail");

const liveNurse = resolveThemeDetail(nurseChip, emily.themeDetails, {
  unopenedPacks: 2,
  scratchReady: 1,
});
assert(liveNurse.unopenedPacks === 2, "live unopened packs survive missing static keys");
assert(scratchReadyCount(liveNurse) === 1, "live scratch-ready survives missing static keys");
assert(
  getStickyCtaMode({
    detail: liveNurse,
    collected: nurseChip.collected,
    total: nurseChip.total,
  }) === "scratch",
  "live nurse with scratch-ready is not forced to buy",
);

const emptyLive = resolveThemeDetail(
  { id: "gym", name: "Gym", thumbnailUrl: "", collected: 13, total: 13, progressColor: "green" },
  emily.themeDetails,
  { unopenedPacks: 0, scratchReady: 0 },
);
assert(
  getStickyCtaMode({
    detail: emptyLive,
    collected: 13,
    total: 13,
  }) === "view",
  "complete live theme without static keys uses view, not buy",
);

assert(
  countMatchingUnopened(nurseChip, [
    { themeName: "Nurse Pack", packName: "Nurse Pack" },
    { themeName: "Police", packName: "Police Pack" },
  ]) === 1,
  "unopened packs match by theme name",
);
assert(
  countMatchingScratchReady(nurseChip, [
    { collectionName: "Nurse", count: 3 },
    { collectionName: "Police Collection", count: 2 },
  ]) === 3,
  "scratch-ready groups match by theme name",
);

console.log("collection.self-check: ok");
