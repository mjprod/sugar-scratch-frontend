/**
 * Locked packet-open defaults must stay the production tear + opposite spin.
 * Run: npx tsx src/features/packs/packOpenLock.self-check.ts
 */
import {
  DEFAULT_CARD_TOP_PIVOT,
  getCardTopDebug,
} from "./cardTopDebug.ts";
import {
  DEFAULT_CARD_TOP_TEAR_TIMELINE,
  loadCardTopTearTimeline,
  sampleCardTopTear,
} from "./cardTopTearTimeline.ts";
import {
  PACK_OPEN_HINGE,
  PACK_OPEN_SPIN_YAW,
  PACK_OPEN_TEAR_END,
} from "./packOpenLock.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(PACK_OPEN_HINGE === "bottom-right", "pack open hinge is bottom-right");
assert(
  PACK_OPEN_SPIN_YAW.anticipationSign === 1 &&
    PACK_OPEN_SPIN_YAW.spinPathSign === -1 &&
    PACK_OPEN_SPIN_YAW.overshootSign === -1,
  "pack open yaw is flipped (+anticipation, −spin, −overshoot)",
);

{
  const pivot = getCardTopDebug().pivot;
  assert(
    Math.abs(pivot.x - DEFAULT_CARD_TOP_PIVOT.x) < 1e-9 &&
      Math.abs(pivot.y - DEFAULT_CARD_TOP_PIVOT.y) < 1e-9 &&
      Math.abs(pivot.z - DEFAULT_CARD_TOP_PIVOT.z) < 1e-9,
    "runtime pivot matches locked bottom-right default",
  );
  assert(DEFAULT_CARD_TOP_PIVOT.x > 0 && DEFAULT_CARD_TOP_PIVOT.z > 0, "hinge on +x/+z");
}

{
  const keys = DEFAULT_CARD_TOP_TEAR_TIMELINE.keys;
  assert(keys.length === 6, "locked tear has six keys");
  const end = keys[keys.length - 1];
  assert(end.id === PACK_OPEN_TEAR_END.id, "tear end id locked");
  assert(end.rotX === PACK_OPEN_TEAR_END.rotX, "tear end rotX locked");
  assert(end.rotY === PACK_OPEN_TEAR_END.rotY, "tear end rotY locked");
  assert(end.rotZ === PACK_OPEN_TEAR_END.rotZ, "tear end rotZ locked");
  assert(end.opacity === PACK_OPEN_TEAR_END.opacity, "tear end opacity locked");

  const loaded = loadCardTopTearTimeline();
  const pose = sampleCardTopTear(loaded, 1);
  assert(pose.opacity === 0, "loaded tear ends fully faded");
  assert(Math.abs(pose.rotX - PACK_OPEN_TEAR_END.rotX) < 1e-6, "loaded end rotX");
}

console.log("packOpenLock.self-check: ok");
