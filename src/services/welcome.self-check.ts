import {
  clearWelcomeGiftState,
  commitWelcomeClaimLocally,
  isWelcomeGiftClaimed,
  isWelcomeGiftEligible,
  shouldShowWelcomeOverlay,
} from "./welcome.ts";
import { clearPackInventory } from "./packInventory.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => store.get(`sess:${key}`) ?? null,
  setItem: (key: string, value: string) => void store.set(`sess:${key}`, value),
  removeItem: (key: string) => void store.delete(`sess:${key}`),
};

clearWelcomeGiftState();
assert(!isWelcomeGiftClaimed(false), "fresh user not claimed");
assert(isWelcomeGiftEligible(false), "fresh user eligible");
assert(shouldShowWelcomeOverlay(false), "overlay shows when eligible");

store.set("sugar.v8.welcomeGiftClaimed", "1");
assert(isWelcomeGiftClaimed(false), "local claimed without account flag");
assert(!isWelcomeGiftEligible(false), "local claimed not eligible");

clearWelcomeGiftState();
assert(isWelcomeGiftClaimed(true), "account claimed ignores localStorage");
assert(!isWelcomeGiftEligible(true), "account claimed not eligible");
assert(!shouldShowWelcomeOverlay(true), "overlay hidden when account claimed");

clearPackInventory();
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

console.log("welcome self-check passed");
