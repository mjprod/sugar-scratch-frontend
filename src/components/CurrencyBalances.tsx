import { Gem, Sparkles } from "lucide-react";

/** Inline coin + diamond HUD counters (TopNav, mobile HUD, and subpage headers). */
export function CurrencyBalances({
  coins,
  diamonds,
  onOpenStore,
}: {
  coins: number | null;
  diamonds: number | null;
  /** Diamond tap → Store. Omit when already on Store. */
  onOpenStore?: () => void;
}) {
  const coinLabel = formatBalance(coins);
  const diamondLabel = formatBalance(diamonds);

  const diamondInner = (
    <>
      <Gem className="top-nav-resource-icon top-nav-resource-icon--diamond size-3.5 shrink-0" aria-hidden />
      <span className="top-nav-resource-value text-[13px] font-semibold tabular-nums">
        {diamondLabel}
      </span>
    </>
  );

  return (
    <div
      className="top-nav-resources flex min-w-0 shrink-0 items-center gap-4"
      aria-live="polite"
    >
      <div
        className="top-nav-resource inline-flex items-center gap-1.5"
        aria-label={`${coinLabel} Sugar Coins`}
      >
        <Sparkles className="top-nav-resource-icon top-nav-resource-icon--coin size-3.5 shrink-0" aria-hidden />
        <span className="top-nav-resource-value text-[13px] font-semibold tabular-nums">
          {coinLabel}
        </span>
      </div>
      {onOpenStore ? (
        <button
          type="button"
          onClick={onOpenStore}
          aria-label={`${diamondLabel} Diamonds, open Store`}
          className="top-nav-resource top-nav-resource--action inline-flex min-h-9 min-w-9 items-center gap-1.5 rounded-md px-1.5 transition active:scale-95"
        >
          {diamondInner}
        </button>
      ) : (
        <span
          className="top-nav-resource inline-flex min-h-9 items-center gap-1.5 px-1.5"
          aria-label={`${diamondLabel} Diamonds`}
        >
          {diamondInner}
        </span>
      )}
    </div>
  );
}

export function formatBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}
