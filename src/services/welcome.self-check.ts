/**
 * Welcome gift self-check.
 * Run: npx tsx src/services/welcome.self-check.ts
 */
import {
  claimWelcomeRewards,
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

const first = claimWelcomeRewards();
assert(first.granted, "claim grants");
assert(isWelcomeGiftClaimed(), "claimed");
assert(!shouldShowWelcomeOverlay(), "no overlay after claim");

const second = claimWelcomeRewards();
assert(!second.granted, "second claim is a no-op");

console.log("welcome.self-check: ok");
