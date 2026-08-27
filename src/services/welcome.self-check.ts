/**
 * Welcome gift self-check.
 * Run: npx tsx src/services/welcome.self-check.ts
 */
import {
  claimWelcomeRewards,
  fulfillPendingWelcomeGift,
  hasPendingWelcomeGift,
  hideWelcomeOverlayForSession,
  isWelcomeGiftClaimed,
  isWelcomeGiftEligible,
  shouldShowWelcomeOverlay,
} from "./welcome.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const local = new Map<string, string>();
const session = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => void local.set(key, value),
  removeItem: (key: string) => void local.delete(key),
};
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => void session.set(key, value),
  removeItem: (key: string) => void session.delete(key),
};

assert(isWelcomeGiftEligible(), "starts eligible");
assert(shouldShowWelcomeOverlay(), "overlay starts visible");
assert(!isWelcomeGiftClaimed(), "not claimed");

hideWelcomeOverlayForSession();
assert(!shouldShowWelcomeOverlay(), "session hide");
assert(isWelcomeGiftEligible(), "close does not claim");

session.clear();
assert(shouldShowWelcomeOverlay(), "overlay can return next session");
assert(!isWelcomeGiftEligible(true), "account flag not eligible");
assert(!shouldShowWelcomeOverlay(true), "account flag hides overlay");
assert(!claimWelcomeRewards(true).granted, "account flag claim is a no-op");
assert(shouldShowWelcomeOverlay(), "local still eligible without account flag");

const deferred = claimWelcomeRewards(false, { deferGrant: true });
assert(deferred.granted, "guest claim grants");
assert(deferred.deferred, "guest claim is deferred");
assert(isWelcomeGiftClaimed(), "claimed");
assert(hasPendingWelcomeGift(), "pending until signup");
assert(!shouldShowWelcomeOverlay(), "no overlay after claim");
assert(!fulfillPendingWelcomeGift(true), "account already claimed skips grant");
assert(hasPendingWelcomeGift() === false, "account claimed clears pending");

local.clear();
session.clear();
const deferredAgain = claimWelcomeRewards(false, { deferGrant: true });
assert(deferredAgain.granted, "guest claim again");
assert(fulfillPendingWelcomeGift(), "signup fulfills pending gift");
assert(!hasPendingWelcomeGift(), "pending cleared after fulfill");
assert(!fulfillPendingWelcomeGift(), "second fulfill is a no-op");

const second = claimWelcomeRewards();
assert(!second.granted, "second claim is a no-op");

console.log("welcome.self-check: ok");
