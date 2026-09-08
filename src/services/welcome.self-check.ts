/**
 * Welcome gift self-check.
 * Run: npx tsx src/services/welcome.self-check.ts
 */
import {
  claimWelcomeRewards,
  clearWelcomeGiftState,
  commitWelcomeClaimLocally,
  fulfillPendingWelcomeGift,
  hasPendingWelcomeGift,
  hideWelcomeOverlayForSession,
  isWelcomeGiftClaimed,
  isWelcomeGiftEligible,
  shouldShowWelcomeOverlay,
} from "./welcome.ts";
import { clearPackInventory } from "./packInventory.ts";

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

// Force demo path for local grant / fulfill without a live API.
process.env.SUGAR_DEMO = "1";

assert(isWelcomeGiftEligible(), "starts eligible");
assert(shouldShowWelcomeOverlay(), "overlay starts visible when authed");
assert(!shouldShowWelcomeOverlay(false, false), "guest never sees overlay");
assert(!isWelcomeGiftClaimed(), "not claimed");

hideWelcomeOverlayForSession();
assert(!shouldShowWelcomeOverlay(), "session hide");
assert(isWelcomeGiftEligible(), "close does not claim");

session.clear();
assert(shouldShowWelcomeOverlay(), "overlay can return next session");
assert(!isWelcomeGiftEligible(true), "account flag not eligible");
assert(!shouldShowWelcomeOverlay(true), "account flag hides overlay");

const blocked = await claimWelcomeRewards(true);
assert(!blocked.granted, "account flag claim is a no-op");
assert(shouldShowWelcomeOverlay(), "local still eligible without account flag");

const deferred = await claimWelcomeRewards(false, { deferGrant: true });
assert(deferred.granted, "guest claim grants");
assert(deferred.deferred, "guest claim is deferred");
assert(!isWelcomeGiftClaimed(), "deferred does not mark claimed yet");
assert(hasPendingWelcomeGift(), "pending until signup");
assert(!shouldShowWelcomeOverlay(), "no overlay while pending");

const accountAlready = await fulfillPendingWelcomeGift(true);
assert(!accountAlready.granted, "account already claimed skips grant");
assert(hasPendingWelcomeGift() === false, "account claimed clears pending");
assert(isWelcomeGiftClaimed(), "account claimed marks local claimed");

local.clear();
session.clear();
clearPackInventory();
const deferredAgain = await claimWelcomeRewards(false, { deferGrant: true });
assert(deferredAgain.granted, "guest claim again");
assert(hasPendingWelcomeGift(), "pending set again");
assert(!isWelcomeGiftClaimed(), "still unclaimed until fulfill");

const fulfilled = await fulfillPendingWelcomeGift();
assert(fulfilled.granted, "signup fulfills pending gift");
assert(fulfilled.demo, "demo path grants locally");
assert(!hasPendingWelcomeGift(), "pending cleared after fulfill");
assert(isWelcomeGiftClaimed(), "claimed after fulfill");

const secondFulfill = await fulfillPendingWelcomeGift();
assert(!secondFulfill.granted, "second fulfill is a no-op");

const second = await claimWelcomeRewards();
assert(!second.granted, "second claim is a no-op");

// Recovery: pending without claimed keeps overlay closed, but clearing pending restores it.
clearWelcomeGiftState();
assert(shouldShowWelcomeOverlay(), "overlay returns after clear");
const pendingOnly = await claimWelcomeRewards(false, { deferGrant: true });
assert(pendingOnly.deferred, "defer again");
assert(!shouldShowWelcomeOverlay(), "pending hides overlay");
// Simulate failed fulfill leaving pending cleared without claimed — overlay recovers.
local.delete("sugar.v8.welcomeGiftPending");
assert(shouldShowWelcomeOverlay(), "clearing pending without claimed recovers overlay");

clearPackInventory();
clearWelcomeGiftState();
const instance = {
  instanceId: "welcome-uuid-1",
  catalogPackId: "ep1",
  packName: "Starter Scratch Pack",
  creator: "Sugar",
  creatorId: "sugar",
  themeName: "Starter",
  coverUrl: "",
  status: "unopened" as const,
  purchaseId: "purchase-welcome-1",
  savedAt: Date.now(),
};
let walletApplied = false;
assert(
  commitWelcomeClaimLocally(
    { instance, wallet: { diamonds: 3, coins: 120 } },
    () => {
      walletApplied = true;
    },
  ),
  "commit upserts welcome instance",
);
assert(walletApplied, "commit applies wallet");
assert(
  !commitWelcomeClaimLocally({ instance: null, wallet: undefined }, () => {}),
  "commit without instance fails",
);

console.log("welcome.self-check: ok");
