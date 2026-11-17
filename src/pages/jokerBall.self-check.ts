import {
  JOKER_COUNT,
  JOKER_MAX,
  JOKER_MIN,
  customNumberIndex,
  flingIndex,
  motionBlurPx,
} from "./jokerBall.ts";
import {
  DROP_START_Y,
  dropLandStrength,
  stepBallDrop,
} from "./jokerBallDrop.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const width = 200;

assert(JOKER_MIN === 1 && JOKER_MAX === 38, "range is 1–38");
assert(JOKER_COUNT === 38, "38 numbered slots");

assert(flingIndex(36 * width, width, 0, JOKER_COUNT) === 36, "still finger settles");
assert(
  flingIndex(36.2 * width, width, 0, JOKER_COUNT) === 36,
  "slow release snaps to nearest",
);

const gentle = flingIndex(20 * width, width, -0.4, JOKER_COUNT);
const hard = flingIndex(20 * width, width, -2.4, JOKER_COUNT);
assert(gentle > 20, "leftward flick advances");
assert(hard > gentle, "faster leftward flick travels further");
assert(flingIndex(20 * width, width, 2.4, JOKER_COUNT) < 20, "rightward flick goes backward");
assert(flingIndex(0, width, 3, JOKER_COUNT) === 0, "coast stops at 1");
assert(
  flingIndex(37 * width, width, -3, JOKER_COUNT) === 37,
  "coast stops at 38",
);

assert(motionBlurPx(0) === 0, "rest is sharp");
assert(motionBlurPx(0.3) === 0, "slow / short settle stays sharp");
assert(motionBlurPx(0.44) === 0, "under fling threshold stays sharp");
const softBlur = motionBlurPx(0.7);
const hardBlur = motionBlurPx(1.4);
assert(softBlur > 0 && hardBlur > softBlur, "faster fling blurs more");
assert(motionBlurPx(3) === 10, "flick blur caps at 10px");
assert(motionBlurPx(20) === motionBlurPx(30), "blur is capped");

{
  const restY = 0.15;
  let y = DROP_START_Y;
  let v = 0;
  let settled = false;
  for (let i = 0; i < 240 && !settled; i++) {
    const next = stepBallDrop(y, v, 1 / 60, restY);
    y = next.y;
    v = next.v;
    settled = next.settled;
  }
  assert(settled, "drop settles");
  assert(Math.abs(y - restY) < 0.001, "drop rests on the plane");
  assert(dropLandStrength(DROP_START_Y, restY) === 0, "apex has no land strength");
  assert(dropLandStrength(restY, restY) === 1, "rest is full land strength");
}

assert(customNumberIndex("1") === 0, "1 maps to first slot");
assert(customNumberIndex("38") === 37, "38 maps to last slot");
assert(customNumberIndex(" 12 ") === 11, "whitespace is fine");
assert(customNumberIndex("0") === null, "0 is out of range");
assert(customNumberIndex("39") === null, "39 is out of range");
assert(customNumberIndex("") === null, "empty is ignored");
assert(customNumberIndex("12.5") === null, "fractions are ignored");

console.log("jokerBall self-check ok");
