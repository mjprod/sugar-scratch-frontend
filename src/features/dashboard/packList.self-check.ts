/**
 * Pack list filtering used by the operator packs dashboard.
 * Run: npx tsx src/features/dashboard/packList.self-check.ts
 */
import assert from "node:assert/strict";
import { filterPackModels, foilVideoCount } from "./packList.ts";

const leo = {
  id: "leo_leite",
  label: "Leo",
  influencerName: "Leo Leite",
  packFaceVideoUrl: "/models/leo_leite/pack-face.mp4",
  packFaceVideoUrl2: "  ",
};
const ava = {
  id: "avaalfaro",
  label: "Ava Alfaro",
  influencerName: null,
  packFaceVideoUrl: null,
  packFaceVideoUrl2: null,
};

assert.equal(foilVideoCount(leo), 1);
assert.equal(
  foilVideoCount({
    packFaceVideoUrl: "/a.mp4",
    packFaceVideoUrl2: "/b.mp4",
  }),
  2,
);
assert.equal(foilVideoCount(ava), 0);

const all = filterPackModels([leo, ava], "  ");
assert.equal(all.length, 2);
assert.deepEqual(
  filterPackModels([leo, ava], "LEITE").map((model) => model.id),
  ["leo_leite"],
);
assert.deepEqual(
  filterPackModels([leo, ava], "ava").map((model) => model.id),
  ["avaalfaro"],
);
assert.equal(filterPackModels([leo, ava], "missing").length, 0);

console.log("packList.self-check ok");
