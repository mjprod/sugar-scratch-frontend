/**
 * Offline invariants for the 10% scratch coin badge exit filter.
 * Run: npx tsx src/features/game/modules/useScratchCoinBadge.self-check.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  COIN_BADGE_LEAVE_ANIMATION,
  coinCountMountState,
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

{
  // Shell remounted with the award already credited (first show / after idle hide).
  const mount = coinCountMountState(130, 1, 10);
  assert(mount.display === 120, "award mount counts up from the pre-credit total");
  assert(mount.prevPopNonce === 0, "award mount treats popNonce as unseen (+N / pop run)");
}
{
  const mount = coinCountMountState(130, 3, 10);
  assert(mount.prevPopNonce === 2, "re-show mount still replays the latest award");
}
{
  const mount = coinCountMountState(130, 0, 0);
  assert(mount.display === 130, "plain mount shows the wallet total");
  assert(mount.prevPopNonce === 0, "plain mount does not pop");
}
assert(
  coinCountMountState(5, 1, 10).display === 0,
  "pre-credit baseline never goes negative",
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
      policy:
        "coin badge hides only on its own leave keyframe; award mounts replay +N / pop / count-up",
    },
    null,
    2,
  ),
);
