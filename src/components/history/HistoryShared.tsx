import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./history.css";

export function HistoryEmpty({
  title,
  copy,
  actionLabel,
  onAction,
}: {
  title: string;
  copy: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="history-empty">
      <p className="history-empty-title">{title}</p>
      <p className="history-empty-copy">{copy}</p>
      <button type="button" className="history-empty-cta" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

export function HistoryError({
  message = "We couldn’t load your history.",
  onRetry,
  onHelp,
}: {
  message?: string;
  onRetry: () => void;
  onHelp?: () => void;
}) {
  return (
    <div className="history-empty">
      <p className="history-empty-title">{message}</p>
      <p className="history-empty-copy">Check your connection, then try again.</p>
      <div className="history-empty-actions">
        <button type="button" className="history-empty-cta" onClick={onRetry}>
          Try again
        </button>
        {onHelp ? (
          <button
            type="button"
            className="history-empty-cta history-empty-cta--ghost"
            onClick={onHelp}
          >
            Get help
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function HistorySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="history-skeleton" aria-hidden="true">
      <div className="history-skeleton-row history-skeleton-row--head" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="history-skeleton-row" />
      ))}
    </div>
  );
}

export function HistoryFilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="history-filters" role="tablist" aria-label="Filters">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={["history-filter-chip", active ? "is-active" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function HistoryDateRangeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="history-date-range">
      <span className="sr-only">Date range</span>
      <select
        className="history-date-range-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
      </select>
    </label>
  );
}

export function HistoryPrevNext({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="history-pager">
      <p className="history-pager-range">
        {total === 0 ? "0 of 0" : `${start}–${end} of ${total}`}
      </p>
      <div className="history-pager-btns">
        <button
          type="button"
          className="history-pager-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="history-pager-btn"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function HistoryPageHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <header className="history-page-head">
      <button
        type="button"
        className="history-back-btn"
        onClick={onBack}
        aria-label="Back to profile"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <h1 className="history-page-title">{title}</h1>
    </header>
  );
}

export function HistoryDateGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="history-date-group" aria-label={label}>
      <h2 className="history-date-label">{label}</h2>
      <div className="history-date-card">{children}</div>
    </section>
  );
}

export function HistoryRowChevron() {
  return (
    <ChevronRight className="history-row-chevron size-4" aria-hidden="true" />
  );
}
