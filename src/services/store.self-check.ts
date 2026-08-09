import {
  clearPurchaseSession,
  createPurchaseSession,
  listAvailableProducts,
  loadPurchaseSession,
  returnFromGateway,
  savePurchaseSession,
  type StoreProduct,
} from "./store.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const store = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

const products = listAvailableProducts();
assert(products.length > 0, "catalog has products");
assert(
  products.every((p, i, arr) => i === 0 || arr[i - 1].order <= p.order),
  "products sorted ascending by order",
);
assert(products[0].kind === "rewarded-ad", "rewarded ad is first");

const unavailable: StoreProduct = {
  id: "gone",
  kind: "diamonds",
  title: "Gone",
  priceLabel: "$1",
  diamonds: 1,
  order: 0,
  available: false,
};
assert(
  !listAvailableProducts([...products, unavailable]).some((p) => p.id === "gone"),
  "unavailable products stay hidden",
);

const paid = products.find((p) => p.kind === "diamonds")!;
const session = await createPurchaseSession(paid);
assert(!!session.id, "session id created");
assert(loadPurchaseSession()?.id === session.id, "session persisted");

const confirmed = await returnFromGateway(session, "completed");
assert(confirmed.status === "confirmed", "completed gateway verifies confirmed");
assert(confirmed.status === "confirmed" && confirmed.diamonds === paid.diamonds, "credits match");
assert(loadPurchaseSession() === null, "confirmed session cleared");

const again = await createPurchaseSession(paid);
const cancelled = await returnFromGateway(again, "cancelled");
assert(cancelled.status === "cancelled", "cancelled gateway");
assert(loadPurchaseSession() === null, "cancelled session cleared");

const pendingSession = await createPurchaseSession(paid);
const pending = await returnFromGateway(pendingSession, "pending");
assert(pending.status === "pending", "pending gateway");
assert(loadPurchaseSession()?.verifiedStatus === "pending", "pending session kept");

savePurchaseSession({ ...pendingSession, credited: true, gatewayOutcome: "completed" });
const noDouble = await returnFromGateway(
  { ...pendingSession, credited: true },
  "completed",
);
assert(
  noDouble.status === "confirmed" && noDouble.diamonds === 0,
  "already-credited session does not double grant",
);

clearPurchaseSession();
assert(loadPurchaseSession() === null, "clear removes session");

console.log("v8 store self-check passed");
