import { Gem, Sparkles } from "lucide-react";

/** Shared coins + diamonds cluster — same source for desktop TopNav and mobile header. */
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

  return (
    <div
      className="flex min-w-0 shrink-0 items-center justify-center gap-3"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-1.5"
        aria-label={`${coinLabel} Sugar Coins`}
      >
        <Sparkles className="size-3.5 shrink-0 text-champagne" aria-hidden />
        <span className="text-[13px] font-semibold tabular-nums text-white">
          {coinLabel}
        </span>
      </div>
      <span className="h-3 w-px bg-white/20" aria-hidden />
      {onOpenStore ? (
        <button
          type="button"
          onClick={onOpenStore}
          aria-label={`${diamondLabel} Diamonds, open Store`}
          className="flex min-h-11 min-w-11 items-center gap-1.5 rounded-full px-2 transition active:scale-95 hover:bg-white/10"
        >
          <Gem className="size-3.5 shrink-0 text-sky-300" aria-hidden />
          <span className="text-[13px] font-semibold tabular-nums text-white">
            {diamondLabel}
          </span>
        </button>
      ) : (
        <span
          className="flex min-h-11 items-center gap-1.5 px-2"
          aria-label={`${diamondLabel} Diamonds`}
        >
          <Gem className="size-3.5 shrink-0 text-sky-300" aria-hidden />
          <span className="text-[13px] font-semibold tabular-nums text-white">
            {diamondLabel}
          </span>
        </span>
      )}
    </div>
  );
}

export function formatBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}
