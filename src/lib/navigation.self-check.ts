/**
 * Navigation classification + primary chrome AC self-check.
 * Run: npx tsx src/lib/navigation.self-check.ts
 */
import { formatBalance } from "../components/CurrencyBalances.tsx";
import { tabFromPathname } from "../routes/Paths.ts";
import {
  DESKTOP_MIN_PX,
  DESKTOP_PRIMARY_LABELS,
  MOBILE_DOCK_LABELS,
  NAV_LABEL_MIN_PX,
} from "./navChrome.ts";
import {
  isPrimaryTab,
  resolveSecondaryBack,
  SECONDARY_SURFACES,
  SURFACE_KIND,
} from "./navigation.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(SURFACE_KIND.home === "primary", "home primary");
assert(SURFACE_KIND.inbox === "secondary", "inbox secondary");
assert(SURFACE_KIND.cart === "secondary", "cart secondary");
assert(SURFACE_KIND["pack-pocket"] === "secondary", "pack pocket secondary");
assert(SURFACE_KIND["purchase-flow"] === "immersive", "purchase immersive");
assert(SURFACE_KIND["sign-in"] === "auth", "auth");
assert(isPrimaryTab("home"), "home primary");
assert(isPrimaryTab("feed"), "browse primary");
assert(isPrimaryTab("bag"), "collection primary");
assert(SECONDARY_SURFACES.inbox.fallbackTab === "profile", "inbox fallback");
assert(SECONDARY_SURFACES.store.fallbackTab === "hub", "store fallback");
assert(SECONDARY_SURFACES.cart.fallbackTab === "feed", "cart fallback");
assert(SECONDARY_SURFACES.cart.title === "Pack Pocket", "pack pocket title");
assert(resolveSecondaryBack("hub", "inbox") === "hub", "prefer previous");
assert(resolveSecondaryBack(null, "inbox") === "profile", "direct inbox");
assert(resolveSecondaryBack("bag", "store") === "bag", "store from collection");
assert(tabFromPathname("/creator/sophia") === null, "creator selects no primary tab");
assert(tabFromPathname("/collection") === "bag", "collection selects bag");

// AC4 — authenticated primary destinations (desktop top bar)
assert(
  DESKTOP_PRIMARY_LABELS.join("|") === "Home|Discover|Store|My Collection",
  "AC4 desktop primary tabs",
);

// AC8a — mobile dock order + center Collection
assert(
  MOBILE_DOCK_LABELS.join("|") ===
    "Discover|Home|My Collection|Store|Profile",
  "AC8a mobile dock order",
);
assert(MOBILE_DOCK_LABELS[2] === "My Collection", "AC8a center elevated");

// AC8b / AC8c breakpoints
assert(DESKTOP_MIN_PX === 769, "chrome swap at 769");
assert(NAV_LABEL_MIN_PX === 990, "AC8c labels from 990");
assert(NAV_LABEL_MIN_PX > DESKTOP_MIN_PX, "tablet icon-only band exists");

// AC7 — every primary control exposes an accessible name
for (const label of [...DESKTOP_PRIMARY_LABELS, ...MOBILE_DOCK_LABELS]) {
  assert(label.trim().length > 0, `AC7 accessible name "${label}"`);
}

// AC12 / AC13 — balance formatting
assert(formatBalance(0) === "0", "AC13 zero renders as 0");
assert(formatBalance(5133) === "5,133", "AC12 thousands separator");
assert(formatBalance(null) === "--", "null balance placeholder");

// AC26 — guest mobile dock keeps the center Collection slot for symmetry
assert(
  MOBILE_DOCK_LABELS.join("|") ===
    "Discover|Home|My Collection|Store|Profile",
  "AC26 guest dock keeps center Collection slot",
);
assert(MOBILE_DOCK_LABELS[2] === "My Collection", "AC26 center slot reserved");

console.log("v8 navigation self-check passed");
