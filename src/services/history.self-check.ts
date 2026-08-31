/**
 * Runnable checks for history ledgers.
 * Run: npx tsx src/services/history.self-check.ts
 */

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

const {
  filterTransactions,
  recordPackPurchaseTransaction,
  transactionTitle,
} = await import("./transactionHistory.ts");
const {
  filterGameHistory,
  recordGameReveal,
  rewardOutcomeLabel,
} = await import("./gameHistory.ts");

const pack = recordPackPurchaseTransaction({
  purchaseId: "self-check-purchase",
  packId: "pack-self",
  packName: "Self Check Pack",
  creatorName: "Checker",
  quantity: 2,
  diamondCost: 40,
});
assert(pack.type === "pack_purchase", "pack type");
assert(pack.quantity === 2, "pack qty");
assert(
  transactionTitle(pack).includes("Self Check Pack"),
  "pack title",
);

const again = recordPackPurchaseTransaction({
  purchaseId: "self-check-purchase",
  packId: "pack-self",
  packName: "Self Check Pack",
  creatorName: "Checker",
  quantity: 2,
  diamondCost: 40,
});
assert(again.id === pack.id, "pack purchase idempotent");

const sample = [
  pack,
  {
    id: "pay",
    userId: "local",
    type: "diamond_purchase" as const,
    status: "completed" as const,
    createdAt: new Date().toISOString(),
    destinationAmount: 100,
    destinationCurrency: "DIAMOND" as const,
    sourceAmount: 9.99,
    sourceCurrency: "AUD" as const,
  },
];
assert(filterTransactions(sample, "payments").length === 1, "payments filter");
assert(
  filterTransactions(sample, "pack_purchases").some(
    (row) => row.id === pack.id,
  ),
  "pack filter",
);

const win = recordGameReveal({
  cardId: "card-win",
  cardName: "Win Card",
  packId: "pack-self",
  packName: "Self Check Pack",
  creatorId: "checker",
  creatorName: "Checker",
  rewardCoins: 25,
  revealSessionId: "session-self",
  purchaseTransactionId: "self-check-purchase",
});
assert(win.result === "win", "win result");
assert(rewardOutcomeLabel(win).includes("25"), "win label");

const none = recordGameReveal({
  cardId: "card-none",
  cardName: "Blank Card",
  packId: "pack-self",
  packName: "Self Check Pack",
  creatorId: "checker",
  creatorName: "Checker",
  rewardCoins: 0,
  revealSessionId: "session-self-2",
});
assert(none.result === "no_prize", "no prize result");
assert(
  filterGameHistory([win, none], "wins").length === 1,
  "wins filter",
);
assert(
  filterGameHistory([win, none], "no_prize").length === 1,
  "no prize filter",
);

const dup = recordGameReveal({
  cardId: "card-win",
  cardName: "Win Card",
  packId: "pack-self",
  packName: "Self Check Pack",
  creatorId: "checker",
  creatorName: "Checker",
  rewardCoins: 25,
  revealSessionId: "session-self",
});
assert(dup.id === win.id, "game reveal idempotent");

console.log("history.self-check: ok");
