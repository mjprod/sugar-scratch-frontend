import { useCallback, useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  HistoryDateRangeSelect,
  HistoryEmpty,
  HistoryError,
  HistoryFilterChips,
  HistoryPageHeader,
  HistoryPrevNext,
  HistoryRowChevron,
  HistorySkeleton,
} from "@/components/history/HistoryShared";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import {
  balanceAfterLines,
  changeLinesFor,
  filterByDateRange,
  filterTransactions,
  formatAmount,
  formatLedgerDateTime,
  formatTransactionWhen,
  loadTransactionHistory,
  statusLabel,
  transactionTitle,
  type TransactionDateRange,
  type TransactionFilter,
  type TransactionRecord,
} from "@/services/transactionHistory";
import "./history.css";

const PAGE_SIZE = 20;

const FILTERS: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "payments", label: "Payments" },
  { id: "exchanges", label: "Exchanges" },
  { id: "pack_purchases", label: "Pack purchases" },
  { id: "refunds", label: "Refunds" },
];

export function TransactionHistoryScreen({
  onBack,
  onVisitStore,
  onOpenGameHistory,
  onGetHelp,
  initialSelectedId,
}: {
  onBack: () => void;
  onVisitStore: () => void;
  onOpenGameHistory: (purchaseTransactionId?: string) => void;
  onGetHelp?: () => void;
  initialSelectedId?: string | null;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [rows, setRows] = useState<TransactionRecord[]>([]);
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [dateRange, setDateRange] = useState<TransactionDateRange>("30d");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useMarkPageReady(status !== "loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await loadTransactionHistory();
      setRows(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter, dateRange]);

  const filtered = useMemo(() => {
    return filterByDateRange(filterTransactions(rows, filter), dateRange);
  }, [rows, filter, dateRange]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      rows.find(
        (row) =>
          row.id === selectedId ||
          row.purchaseId === selectedId ||
          row.relatedTransactionId === selectedId,
      ) ?? null
    );
  }, [rows, selectedId]);

  useEffect(() => {
    if (!initialSelectedId || status !== "ready") return;
    const match = rows.find(
      (row) =>
        row.id === initialSelectedId ||
        row.purchaseId === initialSelectedId ||
        row.relatedTransactionId === initialSelectedId,
    );
    if (match) setSelectedId(match.id);
  }, [initialSelectedId, rows, status]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  }

  function openRow(id: string) {
    setSelectedId(id);
  }

  if (selected) {
    return (
      <AppPageShell
        variant="secondary"
        aria-label="Transaction details"
        className="history-page"
      >
        <SubpageHeader
          title="Transaction"
          onBack={() => setSelectedId(null)}
          backLabel="Back to list"
        />
        <TransactionDetail
          row={selected}
          onViewGameHistory={() =>
            onOpenGameHistory(selected.purchaseId ?? selected.id)
          }
          onReceipt={() => {
            if (selected.receiptUrl) {
              window.open(selected.receiptUrl, "_blank", "noopener,noreferrer");
              return;
            }
            flash("Receipt not available yet");
          }}
          onReport={() => {
            onGetHelp?.();
            flash("Report an issue opened in prototype");
          }}
          onHelp={() => {
            onGetHelp?.();
            flash("Help Centre opened in prototype");
          }}
        />
        {notice ? <HistoryToast message={notice} /> : null}
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Transaction History"
      className="history-page"
    >
      <HistoryPageHeader title="Transaction History" onBack={onBack} />

      <div className="history-controls">
        <HistoryFilterChips
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
        <HistoryDateRangeSelect
          value={dateRange}
          onChange={(next) => setDateRange(next as TransactionDateRange)}
        />
      </div>

      {status === "loading" ? (
        <HistorySkeleton />
      ) : status === "error" ? (
        <HistoryError
          message="We couldn’t load your transactions."
          onRetry={() => void load()}
          onHelp={onGetHelp}
        />
      ) : rows.length === 0 ? (
        <HistoryEmpty
          title="No transactions yet"
          copy="Your purchases and exchanges will appear here."
          actionLabel="Visit Store"
          onAction={onVisitStore}
        />
      ) : filtered.length === 0 ? (
        <HistoryEmpty
          title="No transactions match this filter."
          copy="Try another filter or date range."
          actionLabel="View all transactions"
          onAction={() => {
            setFilter("all");
            setDateRange("90d");
          }}
        />
      ) : (
        <>
          <HistoryPrevNext
            page={safePage}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />

          <div className="history-table-wrap history-desktop-only">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Date / time</th>
                  <th scope="col">Transaction</th>
                  <th scope="col">Change</th>
                  <th scope="col">Balance after</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const when = formatLedgerDateTime(
                    row.completedAt ?? row.createdAt,
                  );
                  const changes = changeLinesFor(row);
                  const balances = balanceAfterLines(row);
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => openRow(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openRow(row.id);
                        }
                      }}
                    >
                      <td>
                        <div className="history-cell-stack">
                          <span>{when.date}</span>
                          <span className="history-cell-muted">{when.time}</span>
                        </div>
                      </td>
                      <td>{transactionTitle(row)}</td>
                      <td>
                        <div className="history-cell-stack">
                          {changes.map((line) => (
                            <span
                              key={line.text}
                              className={[
                                "history-change-line",
                                line.tone === "pos"
                                  ? "is-pos"
                                  : line.tone === "neg"
                                    ? "is-neg"
                                    : line.tone === "paid"
                                      ? "is-paid"
                                      : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {line.text}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="history-cell-stack">
                          {balances.map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="history-status-cell">
                          {statusLabel(row.status)}
                          <HistoryRowChevron />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="history-mobile-list history-mobile-only">
            {pageRows.map((row) => {
              const when = formatLedgerDateTime(
                row.completedAt ?? row.createdAt,
              );
              const changes = changeLinesFor(row);
              const balances = balanceAfterLines(row);
              return (
                <button
                  key={row.id}
                  type="button"
                  className="history-mobile-row"
                  onClick={() => openRow(row.id)}
                >
                  <div className="history-mobile-top">
                    <div>
                      <p className="history-mobile-title">
                        {transactionTitle(row)}
                      </p>
                      <p className="history-mobile-when">
                        {when.date}, {when.time}
                      </p>
                    </div>
                    <HistoryRowChevron />
                  </div>
                  <div>
                    <p className="history-mobile-label">Change</p>
                    <div className="history-cell-stack">
                      {changes.map((line) => (
                        <span
                          key={line.text}
                          className={[
                            "history-change-line",
                            line.tone === "pos"
                              ? "is-pos"
                              : line.tone === "neg"
                                ? "is-neg"
                                : line.tone === "paid"
                                  ? "is-paid"
                                  : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {line.text}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="history-mobile-label">Balance after</p>
                    <p className="history-mobile-status">
                      {balances.join(" · ")}
                    </p>
                  </div>
                  <p className="history-mobile-status">
                    {statusLabel(row.status)}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
      {notice ? <HistoryToast message={notice} /> : null}
    </AppPageShell>
  );
}

function HistoryToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[13px] backdrop-blur-md">
      {message}
    </div>
  );
}

function TransactionDetail({
  row,
  onViewGameHistory,
  onReceipt,
  onReport,
  onHelp,
}: {
  row: TransactionRecord;
  onViewGameHistory: () => void;
  onReceipt: () => void;
  onReport: () => void;
  onHelp: () => void;
}) {
  const showGameLink = row.type === "pack_purchase";
  const balances = balanceAfterLines(row);
  return (
    <div className="history-detail">
      <div className="history-detail-card">
        <p className="history-detail-title">{transactionTitle(row)}</p>
        <p className="history-detail-status">{statusLabel(row.status)}</p>
        <dl className="history-detail-fields">
          <div>
            <dt>Transaction ID</dt>
            <dd>{row.id}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatTransactionWhen(row.createdAt)}</dd>
          </div>
          {row.completedAt && row.completedAt !== row.createdAt ? (
            <div>
              <dt>Completed</dt>
              <dd>{formatTransactionWhen(row.completedAt)}</dd>
            </div>
          ) : null}
          {row.sourceAmount != null ? (
            <div>
              <dt>Deducted</dt>
              <dd>
                {formatAmount(row.sourceAmount, row.sourceCurrency) ?? "—"}
              </dd>
            </div>
          ) : null}
          {row.destinationAmount != null ? (
            <div>
              <dt>Received</dt>
              <dd>
                {formatAmount(row.destinationAmount, row.destinationCurrency) ??
                  "—"}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Balance after</dt>
            <dd>{balances.join(" · ")}</dd>
          </div>
          {row.creatorNameSnapshot ? (
            <div>
              <dt>Creator</dt>
              <dd>{row.creatorNameSnapshot}</dd>
            </div>
          ) : null}
          {row.quantity != null ? (
            <div>
              <dt>Quantity</dt>
              <dd>{row.quantity}</dd>
            </div>
          ) : null}
          {row.exchangeRateLabel ? (
            <div>
              <dt>Rate</dt>
              <dd>{row.exchangeRateLabel}</dd>
            </div>
          ) : null}
          {row.paymentMethodLabel ? (
            <div>
              <dt>Payment</dt>
              <dd>{row.paymentMethodLabel}</dd>
            </div>
          ) : null}
          {row.relatedTransactionId ? (
            <div>
              <dt>Related</dt>
              <dd>{row.relatedTransactionId}</dd>
            </div>
          ) : null}
          {row.reason ? (
            <div>
              <dt>Reason</dt>
              <dd>{row.reason}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="history-detail-actions">
        {row.type === "diamond_purchase" ? (
          <button type="button" className="history-empty-cta" onClick={onReceipt}>
            <Receipt className="mr-1 inline size-4" aria-hidden="true" />
            View receipt
          </button>
        ) : null}
        {showGameLink ? (
          <button
            type="button"
            className="history-empty-cta history-empty-cta--ghost"
            onClick={onViewGameHistory}
          >
            View related game history
          </button>
        ) : null}
        <button
          type="button"
          className="history-empty-cta history-empty-cta--ghost"
          onClick={onReport}
        >
          Report an issue
        </button>
        <button
          type="button"
          className="history-empty-cta history-empty-cta--ghost"
          onClick={onHelp}
        >
          Get help
        </button>
      </div>
    </div>
  );
}
