import {
  bestAffordableCoinExchange,
  clearPurchaseSession,
  createPurchaseSession,
  exchangeCoinsForDiamonds,
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

const affordable = bestAffordableCoinExchange(900);
assert(affordable?.id === "x500", "best affordable picks highest tier under balance");
assert(bestAffordableCoinExchange(50) === null, "below cheapest tier is null");

const demoExchange = await exchangeCoinsForDiamonds(
  { id: "x100", diamonds: 100, coins: 100 },
  { diamonds: 10, coins: 250 },
);
assert(demoExchange.status === "success", "demo exchange succeeds");
assert(
  demoExchange.status === "success" &&
    demoExchange.diamonds === 110 &&
    demoExchange.coins === 150,
  "demo exchange applies dust spend + diamond grant",
);

const broke = await exchangeCoinsForDiamonds(
  { id: "x500", diamonds: 500, coins: 780 },
  { diamonds: 0, coins: 100 },
);
assert(broke.status === "failed", "exchange rejects insufficient dust");

console.log("v8 store self-check passed");
