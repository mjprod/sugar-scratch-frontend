import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import {
  HistoryDateGroup,
  HistoryEmpty,
  HistoryError,
  HistoryFilterChips,
  HistoryPageHeader,
  HistorySkeleton,
} from "@/components/history/HistoryShared";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import {
  filterGameHistory,
  formatRevealWhen,
  groupGameHistoryByLocalDate,
  loadGameHistory,
  rewardOutcomeLabel,
  type GameHistoryFilter,
  type GameHistoryRecord,
} from "@/services/gameHistory";
import "./history.css";

const FILTERS: { id: GameHistoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "wins", label: "Wins" },
  { id: "no_prize", label: "No prize" },
];

export function GameHistoryScreen({
  onBack,
  onExplorePacks,
  onGetHelp,
  purchaseFilterId,
}: {
  onBack: () => void;
  onExplorePacks: () => void;
  onGetHelp?: () => void;
  purchaseFilterId?: string | null;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [rows, setRows] = useState<GameHistoryRecord[]>([]);
  const [filter, setFilter] = useState<GameHistoryFilter>("all");
  const [relatedOnly, setRelatedOnly] = useState(Boolean(purchaseFilterId));

  useMarkPageReady(status !== "loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await loadGameHistory();
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
    setRelatedOnly(Boolean(purchaseFilterId));
  }, [purchaseFilterId]);

  const scoped = useMemo(() => {
    if (!relatedOnly || !purchaseFilterId) return rows;
    const key = purchaseFilterId.trim();
    return rows.filter(
      (row) =>
        row.purchaseTransactionId === key ||
        row.packInstanceId === key ||
        row.packId === key,
    );
  }, [rows, relatedOnly, purchaseFilterId]);

  const filtered = useMemo(
    () => filterGameHistory(scoped, filter),
    [scoped, filter],
  );
  const groups = useMemo(
    () => groupGameHistoryByLocalDate(filtered),
    [filtered],
  );

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Game History"
      className="history-page"
    >
      <HistoryPageHeader title="Game History" onBack={onBack} />

      {purchaseFilterId && relatedOnly ? (
        <p className="history-related-note">
          Showing reveals related to this pack purchase.{" "}
          <button
            type="button"
            className="history-filter-chip is-active"
            onClick={() => setRelatedOnly(false)}
          >
            View all
          </button>
        </p>
      ) : null}

      <div className="history-controls">
        <HistoryFilterChips
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {status === "loading" ? (
        <HistorySkeleton />
      ) : status === "error" ? (
        <HistoryError onRetry={() => void load()} onHelp={onGetHelp} />
      ) : rows.length === 0 ? (
        <HistoryEmpty
          title="No game history yet"
          copy="Cards you reveal will appear here."
          actionLabel="Explore packs"
          onAction={onExplorePacks}
        />
      ) : filtered.length === 0 ? (
        <HistoryEmpty
          title="No game results match this filter."
          copy="Try another filter or view everything."
          actionLabel="View all game history"
          onAction={() => {
            setFilter("all");
            setRelatedOnly(false);
          }}
        />
      ) : (
        <div className="history-list">
          {groups.map((group) => (
            <HistoryDateGroup key={group.label} label={group.label}>
              {group.rows.map((row) => (
                <div key={row.id} className="history-game-row">
                  {row.cardImageSnapshotUrl ? (
                    <img
                      className="history-row-thumb"
                      src={row.cardImageSnapshotUrl}
                      alt={`${row.cardNameSnapshot} card`}
                    />
                  ) : (
                    <span
                      className="history-row-thumb-fallback"
                      aria-hidden="true"
                    >
                      <Sparkles className="size-4" />
                    </span>
                  )}
                  <span className="history-row-copy">
                    <p className="history-row-title">{row.cardNameSnapshot}</p>
                    <p className="history-row-meta">
                      {row.packNameSnapshot}
                      {row.creatorNameSnapshot
                        ? ` · ${row.creatorNameSnapshot}`
                        : ""}
                    </p>
                    <p className="history-row-meta">
                      {formatRevealWhen(row.revealedAt)}
                    </p>
                  </span>
                  <span className="history-row-values">
                    <p
                      className={[
                        "history-row-amount",
                        row.result === "win" ? "is-positive" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {rewardOutcomeLabel(row)}
                    </p>
                  </span>
                </div>
              ))}
            </HistoryDateGroup>
          ))}
        </div>
      )}
    </AppPageShell>
  );
}
