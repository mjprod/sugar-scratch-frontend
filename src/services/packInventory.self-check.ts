import {
  addUnopenedFromPurchase,
  clearPackInventory,
  countOwnedPacks,
  countUnopened,
  getPackInstance,
  isLocalPackInstanceId,
  listUnopenedGroups,
  markPackOpened,
  nextUnopenedInPurchase,
  peekNewestUnopenedInstance,
  peekUnopenedInstance,
  purchaseAlreadyOwned,
  replaceInventoryFromApi,
  upsertInstancesFromApi,
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

clearPackInventory();
const replaced = replaceInventoryFromApi([
  {
    instanceId: "srv-1",
    catalogPackId: "ep1",
    packName: "Neon Rain",
    creator: "Mina",
    creatorId: "mina",
    themeName: "Neon Rain",
    coverUrl: "",
    status: "unopened",
    purchaseId: "buy-1",
    savedAt: 1,
  },
  {
    instanceId: "srv-2",
    catalogPackId: "ep1",
    packName: "Neon Rain",
    creator: "Mina",
    creatorId: "mina",
    themeName: "Neon Rain",
    coverUrl: "",
    status: "opened",
    purchaseId: "buy-1",
    savedAt: 2,
  },
]);
assert(replaced.length === 2, "replace writes server list");
assert(countUnopened() === 1, "replace respects opened status");
assert(getPackInstance("srv-1")?.instanceId === "srv-1", "replace keeps server ids");

const merged = upsertInstancesFromApi([
  {
    instanceId: "srv-3",
    catalogPackId: "ep2",
    packName: "Other",
    creator: "Emily",
    themeName: "Other",
    coverUrl: "",
    status: "unopened",
    purchaseId: "buy-2",
    savedAt: 3,
  },
]);
assert(merged.length === 1, "upsert adds to replaced inventory");
assert(countOwnedPacks() === 3, "upsert merges without dropping replaced rows");

const openedViaApi = upsertInstancesFromApi([
  {
    instanceId: "srv-1",
    catalogPackId: "ep1",
    packName: "Neon Rain",
    creator: "Mina",
    creatorId: "mina",
    themeName: "Neon Rain",
    coverUrl: "",
    status: "opened",
    purchaseId: "buy-1",
    savedAt: 4,
  },
]);
assert(openedViaApi.length === 1, "upsert returns updated instance");
assert(
  getPackInstance("srv-1")?.status === "opened",
  "upsert updates known instance status from api",
);
assert(countUnopened() === 1, "opened update only affects matching instance");

upsertInstancesFromApi([
  {
    instanceId: "srv-old",
    catalogPackId: "ep9",
    packName: "Rank",
    creator: "Emily",
    themeName: "Rank",
    coverUrl: "",
    status: "unopened",
    purchaseId: "buy-old",
    savedAt: 1,
  },
  {
    instanceId: "srv-new",
    catalogPackId: "ep9",
    packName: "Rank",
    creator: "Emily",
    themeName: "Rank",
    coverUrl: "",
    status: "unopened",
    purchaseId: "buy-new",
    savedAt: 99,
  },
]);
assert(
  peekNewestUnopenedInstance("ep9")?.instanceId === "srv-new",
  "newest unopened prefers latest savedAt",
);

assert(isLocalPackInstanceId("pack-abc123"), "local pack id");
assert(isLocalPackInstanceId("demo-pack-xyz"), "demo pack id");
assert(!isLocalPackInstanceId("550e8400-e29b-41d4-a716-446655440000"), "server uuid");

console.log("v8 pack inventory self-check passed");
