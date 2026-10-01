/**
 * Offline invariants for the 10% scratch coin badge exit filter.
 * Run: npx tsx src/features/game/modules/useScratchCoinBadge.self-check.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  COIN_BADGE_LEAVE_ANIMATION,
  isCoinBadgeLeaveAnimation,
} from "./useScratchCoinBadge";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(
  isCoinBadgeLeaveAnimation(COIN_BADGE_LEAVE_ANIMATION),
  "leave keyframe finishes the exit",
);
assert(
  isCoinBadgeLeaveAnimation(`_${COIN_BADGE_LEAVE_ANIMATION}_hashed`),
  "mangled leave keyframe name still finishes the exit",
);
assert(
  isCoinBadgeLeaveAnimation(""),
  "unknown animation name (empty) finishes the exit",
);
assert(
  !isCoinBadgeLeaveAnimation("pack-progress-enter-bl"),
  "enter animation must not hide the badge",
);
assert(
  !isCoinBadgeLeaveAnimation("stage-coin-pop"),
  "child pop animation name must not hide the badge",
);

const stylesCss = readFileSync(
  fileURLToPath(new URL("../scratch/styles.css", import.meta.url)),
  "utf8",
);
assert(
  stylesCss.includes(`@keyframes ${COIN_BADGE_LEAVE_ANIMATION}`),
  `scratch/styles.css must define @keyframes ${COIN_BADGE_LEAVE_ANIMATION}`,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      policy: "coin badge hides only on its own leave keyframe",
    },
    null,
    2,
  ),
);
