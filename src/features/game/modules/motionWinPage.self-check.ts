/**
 * Currency-win route must leave the game memory domain so iOS drops decoders.
 * Run: npx tsx src/features/game/modules/motionWinPage.self-check.ts
 */
import { Paths } from "../../../routes/Paths.ts";
import {
  routeMemoryDomain,
  shouldMemoryTransition,
} from "../../../lib/memory/routeMemoryDomain.ts";
import {
  MOTION_WIN_HOLD_MS,
  isMotionWinPath,
  motionWinHref,
  motionWinPayloadFromPending,
  nextMotionCardId,
  type MotionWinPayload,
} from "./motionWinPage.ts";
import type { GameSession } from "./gameSession.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(MOTION_WIN_HOLD_MS === 7000, "win page holds 7 seconds");
assert(Paths.gameWin === "/game/win", "win path is /game/win");
assert(isMotionWinPath("/game/win"), "exact win path");
assert(isMotionWinPath("/game/win?model=a"), "win path ignores query");
assert(!isMotionWinPath("/game"), "play is not the win page");
assert(!isMotionWinPath("/game/winner"), "prefix is not the win page");

assert(
  motionWinHref("?model=a&card=b&game=1") ===
    "/game/win?model=a&card=b&game=1",
  "win href keeps the hand query",
);
assert(motionWinHref("") === "/game/win", "bare win href");

assert(
  routeMemoryDomain("/game/win") === "light",
  "win page is light so leaving play purges",
);
assert(routeMemoryDomain("/game") === "game", "play stays game");
assert(
  shouldMemoryTransition("/game", "/game/win"),
  "play → win crosses a heavy boundary (decoder drop)",
);
assert(
  shouldMemoryTransition("/game/win", "/game"),
  "win → next card crosses back into game",
);

const pendingWin = {
  cardId: "m1",
  photoIds: [] as string[],
  coins: 10,
  diamonds: 1,
  prize: 1,
  current: 1,
  total: 3,
};
const payload = motionWinPayloadFromPending(pendingWin);
assert(payload?.coins === 10 && payload.diamonds === 1, "pending win payload");
assert(
  motionWinPayloadFromPending({ ...pendingWin, prize: 0, coins: 0, diamonds: 0 }) ===
    null,
  "no-match pending is not a win page",
);

const session = {
  motionCardIds: ["m1", "m2"],
  completedMotionIds: ["m1"],
} as GameSession;
assert(nextMotionCardId(session) === "m2", "next unfinished motion card");
assert(
  nextMotionCardId({ ...session, completedMotionIds: ["m1", "m2"] }) === null,
  "hand done → hub",
);

const _keepType: MotionWinPayload | null = payload;
void _keepType;

console.log("motionWinPage.self-check: ok");
