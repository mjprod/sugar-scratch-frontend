/**
 * Navigation classification self-check.
 * Run: npx tsx src/lib/navigation.self-check.ts
 */
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

console.log("v8 navigation self-check passed");
