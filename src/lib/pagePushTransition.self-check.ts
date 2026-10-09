/**
 * Route-level push transition policy.
 * Run: npx tsx src/lib/pagePushTransition.self-check.ts
 */
import {
  isPurchaseFlowPath,
  isScratchGamePath,
  pushDirection,
  shouldSkipPushHop,
  shouldSkipPushTransition,
} from "./pagePushTransition.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(isScratchGamePath("/game"), "game is scratch");
assert(isScratchGamePath("/game-ui"), "game-ui is scratch");
assert(isScratchGamePath("/photo-scratch"), "photo-scratch is scratch");
assert(isScratchGamePath("/audio-test"), "audio-test is scratch");
assert(isScratchGamePath("/game?model=a&card=b"), "game query is scratch");
assert(!isScratchGamePath("/profile/game-history"), "profile history is not scratch");
assert(!isScratchGamePath("/profile/game-settings"), "game settings is not scratch");
assert(!isScratchGamePath("/"), "home is not scratch");
assert(!isScratchGamePath("/games"), "games prefix is not scratch");

assert(isPurchaseFlowPath("/purchase/tear-open"), "tear-open is purchase");
assert(isPurchaseFlowPath("/purchase/abc"), "pack purchase is purchase");
assert(!isPurchaseFlowPath("/pack-pocket"), "pack pocket is not purchase");

assert(shouldSkipPushTransition("/game"), "skip game");
assert(shouldSkipPushTransition("/photo-scratch"), "skip photo scratch");
assert(shouldSkipPushTransition("/purchase/x"), "skip purchase");
assert(!shouldSkipPushTransition("/profile"), "profile pushes");
assert(!shouldSkipPushTransition("/settings"), "settings pushes");
assert(!shouldSkipPushTransition("/inbox"), "inbox pushes");
assert(!shouldSkipPushTransition("/collection"), "collection pushes");
assert(!shouldSkipPushTransition("/discover"), "discover pushes");
assert(!shouldSkipPushTransition("/"), "home pushes");
assert(!shouldSkipPushTransition("/creator/sophia"), "creator pushes");

assert(shouldSkipPushHop("/game", "/discover"), "leaving game skips the slide");
assert(shouldSkipPushHop("/collection", "/purchase/x"), "entering purchase skips the slide");
assert(shouldSkipPushHop("/game", "/game"), "same game surface skips");
assert(!shouldSkipPushHop("/profile", "/settings"), "profile to settings pushes");

assert(pushDirection(2, 3) === 1, "forward is push from the right");
assert(pushDirection(3, 2) === -1, "back is pop from the left");
assert(pushDirection(4, 4) === 1, "replace is a push");

console.log("pagePushTransition.self-check: ok");
