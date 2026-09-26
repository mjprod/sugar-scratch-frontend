/**
 * Keep heavy game/collection pages off the eager AppRoutes graph so /game
 * scratch does not download SlideDeck / three / PhotoScratch / hub fan.
 * Run: npx tsx src/routes/routeLazySplit.self-check.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const here = dirname(fileURLToPath(import.meta.url));
const appRoutes = readFileSync(join(here, "AppRoutes.tsx"), "utf8");
const gamePage = readFileSync(join(here, "../pages/GamePage.tsx"), "utf8");
const creatorScreen = readFileSync(
  join(here, "../components/creator/CreatorScreen.tsx"),
  "utf8",
);

for (const page of [
  "CreatorPage",
  "MotionCardPage",
  "GamePage",
  "PhotoScratchPage",
] as const) {
  assert(
    !new RegExp(`import \\{ ${page} \\} from`).test(appRoutes),
    `${page} must not be a static AppRoutes import`,
  );
  assert(
    appRoutes.includes(`import("@/pages/${page}")`),
    `${page} must be lazy(() => import("@/pages/${page}"))`,
  );
}

assert(
  !/import \{ GameHub \} from/.test(gamePage),
  "GameHub must not be a static GamePage import",
);
assert(
  gamePage.includes('import("@/features/game/GameHub")'),
  "GameHub must be lazy on the bare /game hub path",
);
assert(
  gamePage.includes('import { ScratchPrototype }'),
  "scratch embed still eagerly mounts ScratchPrototype",
);

assert(
  !/import \{ FeaturedCardOverlay \} from/.test(creatorScreen),
  "FeaturedCardOverlay (SlideDeck) must not be a static CreatorScreen import",
);
assert(
  creatorScreen.includes('import("@/components/creator/FeaturedCardOverlay")'),
  "FeaturedCardOverlay must be lazy until overlay opens",
);

console.log("routeLazySplit.self-check: ok");
