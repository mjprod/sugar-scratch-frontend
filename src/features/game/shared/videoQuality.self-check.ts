/**
 * HD Videos setting: stored pref + catalog clip swap.
 * Run: npx tsx src/features/game/shared/videoQuality.self-check.ts
 */
import {
  getHdVideoEnabled,
  setHdVideoEnabled,
} from "../../../services/videoQualityPrefs.ts";
import { withPreferredVideoQuality, type CatalogMotionCard } from "./catalog.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const local = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => void local.set(key, value),
  removeItem: (key: string) => void local.delete(key),
};
(globalThis as { window?: unknown }).window = {
  localStorage: globalThis.localStorage,
};

assert(getHdVideoEnabled() === false, "HD must default to off");
setHdVideoEnabled(true);
assert(getHdVideoEnabled() === true, "HD on must persist");
local.set("sugar.v8.video.hd", "not json");
assert(getHdVideoEnabled() === false, "corrupt storage must fall back to off");

const base: CatalogMotionCard = {
  id: "card",
  label: "Card",
  bottom: "/cards/card/background.mp4",
  foreground: "/cards/card/foreground.mp4",
  mesh: "card.json",
  chromaKey: false,
};
const withHd: CatalogMotionCard = {
  ...base,
  bottomHd: "/cards/card/background.hd.mp4",
  foregroundHd: "/cards/card/foreground.hd.mp4",
};

const swapped = withPreferredVideoQuality(withHd, true);
assert(
  swapped.bottom === withHd.bottomHd && swapped.foreground === withHd.foregroundHd,
  "HD on must swap both clips",
);
assert(swapped.mesh === base.mesh, "HD swap must keep the same mesh");
assert(
  withPreferredVideoQuality(withHd, false) === withHd,
  "HD off must leave the card untouched",
);
assert(
  withPreferredVideoQuality(base, true) === base,
  "cards without HD clips must fall back to the delivery clips",
);

console.log("videoQuality self-check passed");
