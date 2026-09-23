/**
 * Transaction History — client ledger + inventory-derived pack purchases.
 * No backend list API yet; mock seed fills payments/exchanges/refunds in demo mode.
 */

import { isDemoMode } from "../lib/demo";
import { listOwnedPacks, type OwnedPackInstance } from "./packInventory";
import { packCost, packUnitCost, type PackQuantity } from "./purchase";

export type TransactionType =
  | "diamond_purchase"
  | "diamond_coin_exchange"
  | "pack_purchase"
  | "refund"
  | "reversal"
  | "adjustment";

export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "reversed"
  | "cancelled";

export type WalletCurrency = "AUD" | "DIAMOND" | "COIN";

export type TransactionRecord = {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  createdAt: string;
  completedAt?: string;
  sourceAmount?: number;
  sourceCurrency?: WalletCurrency;
  destinationAmount?: number;
  destinationCurrency?: WalletCurrency;
  /** Historical balance after settlement (single-currency events). */
  balanceAfter?: number;
  balanceAfterCurrency?: WalletCurrency;
  /** Exchange / dual-wallet post balances. */
  balanceAfterDiamonds?: number;
  balanceAfterCoins?: number;
  packId?: string;
  packNameSnapshot?: string;
  creatorNameSnapshot?: string;
  quantity?: number;
  originalPrice?: number;
  discountAmount?: number;
  paymentMethodLabel?: string;
  relatedTransactionId?: string;
  receiptUrl?: string;
  /** Group key for inventory-derived rows. */
  purchaseId?: string;
  exchangeRateLabel?: string;
  reason?: string;
};

export type TransactionFilter =
  | "all"
  | "payments"
  | "exchanges"
  | "pack_purchases"
  | "refunds";

export type TransactionDateRange =
  | "7d"
  | "30d"
  | "90d"
  | "custom";

const KEY = "sugar.v8.transactionHistory";
const SEED_FLAG = "sugar.v8.transactionHistory.seeded.v2";

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLedger(): TransactionRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecord);
  } catch {
    return [];
  }
}

function writeLedger(rows: TransactionRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* storage unavailable */
  }
}

function isValidRecord(value: unknown): value is TransactionRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<TransactionRecord>;
  return (
    typeof row.id === "string" &&
    typeof row.type === "string" &&
    typeof row.status === "string" &&
    typeof row.createdAt === "string"
  );
}

function sortNewest(a: TransactionRecord, b: TransactionRecord) {
  const ta = Date.parse(a.completedAt ?? a.createdAt) || 0;
  const tb = Date.parse(b.completedAt ?? b.createdAt) || 0;
  return tb - ta;
}

function seedMockIfNeeded(existing: TransactionRecord[]): TransactionRecord[] {
  if (!isDemoMode()) return existing;
  try {
    if (localStorage.getItem(SEED_FLAG) === "1") return existing;
  } catch {
    return existing;
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const seeded: TransactionRecord[] = [
    {
      id: "seed-diamond-1",
      userId: "local",
      type: "diamond_purchase",
      status: "completed",
      createdAt: new Date(now - 2 * day).toISOString(),
      completedAt: new Date(now - 2 * day).toISOString(),
      sourceAmount: 9.99,
      sourceCurrency: "AUD",
      destinationAmount: 100,
      destinationCurrency: "DIAMOND",
      balanceAfter: 108,
      balanceAfterCurrency: "DIAMOND",
      paymentMethodLabel: "Visa •••• 4242",
    },
    {
      id: "seed-diamond-2",
      userId: "local",
      type: "diamond_purchase",
      status: "completed",
      createdAt: new Date(now - 8 * day).toISOString(),
      completedAt: new Date(now - 8 * day).toISOString(),
      sourceAmount: 19.99,
      sourceCurrency: "AUD",
      destinationAmount: 250,
      destinationCurrency: "DIAMOND",
      balanceAfter: 250,
      balanceAfterCurrency: "DIAMOND",
      paymentMethodLabel: "Visa •••• 4242",
    },
    {
      id: "seed-exchange-1",
      userId: "local",
      type: "diamond_coin_exchange",
      status: "completed",
      createdAt: new Date(now - day).toISOString(),
      completedAt: new Date(now - day).toISOString(),
      sourceAmount: 5,
      sourceCurrency: "DIAMOND",
      destinationAmount: 500,
      destinationCurrency: "COIN",
      balanceAfterDiamonds: 3,
      balanceAfterCoins: 1120,
      exchangeRateLabel: "1 Diamond = 100 Diamond Dust",
    },
    {
      id: "seed-pack-1",
      userId: "local",
      type: "pack_purchase",
      status: "completed",
      createdAt: new Date(now - 4 * day).toISOString(),
      completedAt: new Date(now - 4 * day).toISOString(),
      sourceAmount: 450,
      sourceCurrency: "COIN",
      packNameSnapshot: "Mika Dreams Pack",
      creatorNameSnapshot: "Mika",
      quantity: 5,
      purchaseId: "seed-pack-purchase-1",
      balanceAfter: 620,
      balanceAfterCurrency: "COIN",
    },
    {
      id: "seed-refund-1",
      userId: "local",
      type: "refund",
      status: "refunded",
      createdAt: new Date(now - 3 * day).toISOString(),
      completedAt: new Date(now - 3 * day).toISOString(),
      destinationAmount: 450,
      destinationCurrency: "COIN",
      packNameSnapshot: "Mika Dreams Pack",
      relatedTransactionId: "seed-pack-1",
      reason: "Pack purchase refunded to wallet.",
      balanceAfter: 1070,
      balanceAfterCurrency: "COIN",
    },
  ];

  const merged = [...seeded, ...existing];
  writeLedger(merged);
  try {
    localStorage.setItem(SEED_FLAG, "1");
  } catch {
    /* ignore */
  }
  return merged;
}

function inferPackDiamondCost(catalogPackId: string, quantity: number): number {
  if (quantity === 1 || quantity === 5) {
    return packCost(quantity as PackQuantity, catalogPackId);
  }
  return packUnitCost(catalogPackId) * quantity;
}

function packRowsFromInventory(
  ledger: TransactionRecord[],
): TransactionRecord[] {
  const known = new Set(
    ledger
      .filter((row) => row.type === "pack_purchase")
      .map((row) => row.purchaseId || row.id),
  );

  const byPurchase = new Map<string, OwnedPackInstance[]>();
  for (const pack of listOwnedPacks()) {
    const key = pack.purchaseId.trim();
    if (!key) continue;
    const list = byPurchase.get(key) ?? [];
    list.push(pack);
    byPurchase.set(key, list);
  }

  const derived: TransactionRecord[] = [];
  for (const [purchaseId, packs] of byPurchase) {
    if (known.has(purchaseId)) continue;
    const first = packs[0]!;
    const savedAt = Math.max(...packs.map((p) => p.savedAt || 0));
    const iso = new Date(savedAt || Date.now()).toISOString();
    derived.push({
      id: `inv-${purchaseId}`,
      userId: "local",
      type: "pack_purchase",
      status: "completed",
      createdAt: iso,
      completedAt: iso,
      packId: first.catalogPackId,
      packNameSnapshot: first.packName,
      creatorNameSnapshot: first.creator,
      quantity: packs.length,
      purchaseId,
      sourceAmount: inferPackDiamondCost(first.catalogPackId, packs.length),
      sourceCurrency: "DIAMOND",
    });
  }
  return derived;
}

/** Append a pack purchase after a successful buy. Idempotent on purchaseId. */
export function recordPackPurchaseTransaction(input: {
  purchaseId: string;
  packId: string;
  packName: string;
  creatorName: string;
  quantity: number;
  diamondCost?: number;
}): TransactionRecord {
  const ledger = readLedger();
  const existing = ledger.find(
    (row) =>
      row.type === "pack_purchase" &&
      (row.purchaseId === input.purchaseId || row.id === input.purchaseId),
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const row: TransactionRecord = {
    id: newId("tx"),
    userId: "local",
    type: "pack_purchase",
    status: "completed",
    createdAt: now,
    completedAt: now,
    packId: input.packId,
    packNameSnapshot: input.packName,
    creatorNameSnapshot: input.creatorName,
    quantity: input.quantity,
    purchaseId: input.purchaseId,
    sourceAmount: input.diamondCost,
    sourceCurrency: "DIAMOND",
  };
  writeLedger([row, ...ledger]);
  return row;
}

export function filterTransactions(
  rows: TransactionRecord[],
  filter: TransactionFilter,
): TransactionRecord[] {
  if (filter === "all") return rows;
  return rows.filter((row) => {
    switch (filter) {
      case "payments":
        return row.type === "diamond_purchase";
      case "exchanges":
        return row.type === "diamond_coin_exchange";
      case "pack_purchases":
        return row.type === "pack_purchase";
      case "refunds":
        return (
          row.type === "refund" ||
          row.type === "reversal" ||
          row.status === "refunded" ||
          row.status === "partially_refunded"
        );
      default:
        return true;
    }
  });
}

export function filterByDateRange(
  rows: TransactionRecord[],
  range: TransactionDateRange,
  custom?: { from?: string; to?: string },
): TransactionRecord[] {
  const now = Date.now();
  let fromMs = 0;
  let toMs = now;
  if (range === "7d") fromMs = now - 7 * 24 * 60 * 60 * 1000;
  else if (range === "30d") fromMs = now - 30 * 24 * 60 * 60 * 1000;
  else if (range === "90d") fromMs = now - 90 * 24 * 60 * 60 * 1000;
  else if (range === "custom") {
    if (custom?.from) fromMs = Date.parse(custom.from) || 0;
    if (custom?.to) toMs = Date.parse(custom.to) || now;
  }
  return rows.filter((row) => {
    const t = Date.parse(row.completedAt ?? row.createdAt) || 0;
    return t >= fromMs && t <= toMs;
  });
}

export function getTransactionById(id: string): TransactionRecord | null {
  const all = mergeHistory(readLedger());
  return all.find((row) => row.id === id) ?? null;
}

function mergeHistory(ledger: TransactionRecord[]): TransactionRecord[] {
  const seeded = seedMockIfNeeded(ledger);
  const derived = packRowsFromInventory(seeded);
  const byId = new Map<string, TransactionRecord>();
  for (const row of [...seeded, ...derived]) {
    byId.set(row.id, row);
  }
  return [...byId.values()].sort(sortNewest);
}

/** Async wrapper — ready for a future list API. */
export async function loadTransactionHistory(): Promise<TransactionRecord[]> {
  return mergeHistory(readLedger());
}

export type DateGroup = {
  label: string;
  rows: TransactionRecord[];
};

export function groupByLocalDate(
  rows: TransactionRecord[],
): DateGroup[] {
  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const buckets = new Map<string, { label: string; sortKey: number; rows: TransactionRecord[] }>();

  for (const row of rows) {
    const at = new Date(row.completedAt ?? row.createdAt);
    const day = startOfLocalDay(at);
    const key = day.toISOString();
    let label: string;
    if (day.getTime() === today.getTime()) label = "Today";
    else if (day.getTime() === yesterday.getTime()) label = "Yesterday";
    else {
      label = at.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    const bucket = buckets.get(key) ?? {
      label,
      sortKey: day.getTime(),
      rows: [],
    };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ label, rows: groupRows }) => ({ label, rows: groupRows }));
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatTransactionWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Two-line ledger datetime: `31 Aug 2026` / `10:55` (no seconds). */
export function formatLedgerDateTime(iso: string): {
  date: string;
  time: string;
} {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function formatWalletAmount(
  amount: number,
  currency: WalletCurrency,
): string {
  if (currency === "AUD") return `A$${amount.toFixed(2)}`;
  if (currency === "DIAMOND") {
    return `${amount.toLocaleString()} Diamonds`;
  }
  return `${amount.toLocaleString()} Diamond Dust`;
}

export type ChangeLine = {
  text: string;
  tone: "pos" | "neg" | "paid" | "neutral";
};

/** Multi-line Change column per spec §4.7. */
export function changeLinesFor(row: TransactionRecord): ChangeLine[] {
  if (row.type === "diamond_purchase") {
    const lines: ChangeLine[] = [];
    if (row.sourceAmount != null && row.sourceCurrency === "AUD") {
      lines.push({
        text: `Paid ${formatWalletAmount(row.sourceAmount, "AUD")}`,
        tone: "paid",
      });
    }
    if (row.destinationAmount != null) {
      lines.push({
        text: `+${formatWalletAmount(
          row.destinationAmount,
          row.destinationCurrency ?? "DIAMOND",
        )}`,
        tone: "pos",
      });
    }
    return lines.length ? lines : [{ text: "—", tone: "neutral" }];
  }
  if (row.type === "diamond_coin_exchange") {
    return [
      {
        text: `−${formatWalletAmount(
          row.sourceAmount ?? 0,
          row.sourceCurrency ?? "DIAMOND",
        )}`,
        tone: "neg",
      },
      {
        text: `+${formatWalletAmount(
          row.destinationAmount ?? 0,
          row.destinationCurrency ?? "COIN",
        )}`,
        tone: "pos",
      },
    ];
  }
  if (row.type === "pack_purchase") {
    if (row.sourceAmount == null) {
      return [{ text: "—", tone: "neutral" }];
    }
    return [
      {
        text: `−${formatWalletAmount(
          row.sourceAmount,
          row.sourceCurrency ?? "DIAMOND",
        )}`,
        tone: "neg",
      },
    ];
  }
  if (
    row.type === "refund" ||
    row.type === "reversal" ||
    row.type === "adjustment"
  ) {
    if (row.destinationAmount == null) {
      return [{ text: "—", tone: "neutral" }];
    }
    const currency = row.destinationCurrency ?? "COIN";
    const prefix = currency === "AUD" ? "+" : "+";
    return [
      {
        text: `${prefix}${formatWalletAmount(row.destinationAmount, currency)}`,
        tone: currency === "AUD" ? "neutral" : "pos",
      },
    ];
  }
  return [{ text: "—", tone: "neutral" }];
}

/** Balance after column — historical only; never current wallet. */
export function balanceAfterLines(row: TransactionRecord): string[] {
  if (row.status === "pending" || row.status === "failed") return ["—"];
  if (
    row.balanceAfterDiamonds != null ||
    row.balanceAfterCoins != null
  ) {
    const lines: string[] = [];
    if (row.balanceAfterDiamonds != null) {
      lines.push(formatWalletAmount(row.balanceAfterDiamonds, "DIAMOND"));
    }
    if (row.balanceAfterCoins != null) {
      lines.push(formatWalletAmount(row.balanceAfterCoins, "COIN"));
    }
    return lines.length ? lines : ["—"];
  }
  if (row.balanceAfter != null && row.balanceAfterCurrency) {
    return [formatWalletAmount(row.balanceAfter, row.balanceAfterCurrency)];
  }
  if (row.balanceAfter != null) {
    return [row.balanceAfter.toLocaleString()];
  }
  return ["—"];
}

export function formatAmount(
  amount: number | undefined,
  currency: WalletCurrency | undefined,
): string | null {
  if (amount == null || !currency) return null;
  return formatWalletAmount(amount, currency);
}

export function transactionTitle(row: TransactionRecord): string {
  switch (row.type) {
    case "diamond_purchase":
      return `Purchased ${row.destinationAmount ?? 0} Diamonds`;
    case "diamond_coin_exchange":
      return "Exchanged Diamonds for Diamond Dust";
    case "pack_purchase": {
      const name = row.packNameSnapshot ?? "Pack";
      const qty = row.quantity && row.quantity > 1 ? ` ×${row.quantity}` : "";
      return `${name}${qty}`;
    }
    case "refund":
      return row.packNameSnapshot
        ? `Refund — ${row.packNameSnapshot}`
        : "Refund";
    case "reversal":
      return "Reversal";
    case "adjustment":
      return "Wallet adjustment";
    default:
      return "Transaction";
  }
}

export function statusLabel(status: TransactionStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    case "partially_refunded":
      return "Partially refunded";
    case "reversed":
      return "Reversed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
