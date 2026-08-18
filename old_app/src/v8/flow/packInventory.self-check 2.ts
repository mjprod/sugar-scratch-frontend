import {
  addUnopenedFromPurchase,
  clearPackInventory,
  countUnopened,
  getPackInstance,
  listUnopenedGroups,
  markPackOpened,
  nextUnopenedInPurchase,
  peekUnopenedInstance,
  purchaseAlreadyOwned,
} from "./packInventory.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

clearPackInventory();
assert(countUnopened() === 0, "starts empty");

const purchaseId = "tx-1";
const created = addUnopenedFromPurchase({
  purchaseId,
  catalogPackId: "cyber",
  packName: "Cyber Nights",
  creator: "Emily",
  count: 5,
});
assert(created.length === 5, "five packs after purchase");
assert(countUnopened() === 5, "all unopened");
assert(purchaseAlreadyOwned(purchaseId), "purchase recorded");

const again = addUnopenedFromPurchase({
  purchaseId,
  catalogPackId: "cyber",
  packName: "Cyber Nights",
  creator: "Emily",
  count: 5,
});
assert(again.length === 5, "duplicate purchase returns existing unopened");
assert(countUnopened() === 5, "no duplicate ownership");

const groups = listUnopenedGroups();
assert(groups.length === 1, "grouped by theme");
assert(groups[0].count === 5, "group count");

const first = peekUnopenedInstance(groups[0].id);
assert(first != null, "peek instance");
const opened = markPackOpened(first!.instanceId);
assert(opened?.status === "opened", "tear marks opened");
assert(countUnopened() === 4, "opened leaves unopened");
assert(getPackInstance(first!.instanceId)?.status === "opened", "stays opened");
assert(markPackOpened(first!.instanceId)?.status === "opened", "idempotent open");

const next = nextUnopenedInPurchase(purchaseId);
assert(next != null && next.instanceId !== first!.instanceId, "next in purchase");

console.log("v8 pack inventory self-check passed");
