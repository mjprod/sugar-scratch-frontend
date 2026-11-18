/**
 * Route-level push transition policy.
 * Run: npx tsx src/lib/pagePushTransition.self-check.ts
 */
import {
  isCreatorBackHop,
  isCreatorSubpageBackHop,
  isPurchaseFlowPath,
  isScratchGamePath,
  isSettingsBackHop,
  pagePushDirection,
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
assert(isScratchGamePath("/game/win"), "win page skips the canvas slide");
assert(isScratchGamePath("/game/nowin"), "nowin page skips the canvas slide");
assert(!isScratchGamePath("/profile/game-history"), "profile history is not scratch");
assert(!isScratchGamePath("/profile/game-settings"), "game settings is not scratch");
assert(!isScratchGamePath("/"), "home is not scratch");
assert(!isScratchGamePath("/games"), "games prefix is not scratch");

assert(isPurchaseFlowPath("/purchase/tear-open"), "tear-open is purchase");
assert(isPurchaseFlowPath("/purchase/abc"), "pack purchase is purchase");
assert(!isPurchaseFlowPath("/pack-pocket"), "pack pocket is not purchase");

assert(shouldSkipPushTransition("/card-open-test"), "card open lab skips the slide");
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

assert(isCreatorBackHop("/creator/wildhalli", "/collection"), "creator to collect is back");
assert(!isCreatorBackHop("/collection", "/creator/wildhalli"), "collect to creator is not back");
assert(
  pagePushDirection("/creator/x", "/collection", 2, 3) === -1,
  "creator back pops even when history idx increases",
);
assert(
  pagePushDirection("/collection", "/creator/x", 2, 3) === 1,
  "opening creator still pushes",
);

assert(
  isCreatorSubpageBackHop("/creator/julianaval/theme/police", "/creator/julianaval"),
  "theme to creator is back",
);
assert(
  isCreatorSubpageBackHop("/creator/julianaval/packs", "/creator/julianaval"),
  "packs to creator is back",
);
assert(
  isCreatorSubpageBackHop(
    "/creator/julianaval/packs",
    "/creator/julianaval/theme/police",
  ),
  "packs to theme is back",
);
assert(
  !isCreatorSubpageBackHop(
    "/creator/julianaval/theme/police",
    "/creator/julianaval/packs",
  ),
  "theme to packs is not back",
);
assert(
  !isCreatorSubpageBackHop("/creator/julianaval", "/creator/julianaval/theme/police"),
  "opening theme is not back",
);
assert(
  pagePushDirection(
    "/creator/julianaval/packs",
    "/creator/julianaval/theme/police",
    2,
    3,
  ) === -1,
  "packs back to theme pops even when history idx increases",
);
assert(
  pagePushDirection(
    "/creator/julianaval/theme/police",
    "/creator/julianaval",
    2,
    3,
  ) === -1,
  "theme back pops even when history idx increases",
);
assert(
  pagePushDirection(
    "/creator/julianaval",
    "/creator/julianaval/theme/police",
    2,
    3,
  ) === 1,
  "opening theme still pushes",
);

assert(isSettingsBackHop("/profile/edit", "/settings"), "edit profile to settings is back");
assert(isSettingsBackHop("/profile/change-password", "/settings"), "change password to settings is back");
assert(isSettingsBackHop("/help", "/settings"), "help to settings is back");
assert(isSettingsBackHop("/profile/delete-account", "/settings"), "delete account to settings is back");
assert(isSettingsBackHop("/legal/odds", "/settings"), "odds to settings is back");
assert(!isSettingsBackHop("/settings", "/profile/edit"), "opening edit profile is not back");
assert(
  pagePushDirection("/profile/edit", "/settings", 2, 3) === -1,
  "settings back pops even when history idx increases",
);
assert(
  pagePushDirection("/settings", "/profile/edit", 2, 3) === 1,
  "opening edit profile still pushes",
);

console.log("pagePushTransition.self-check: ok");
