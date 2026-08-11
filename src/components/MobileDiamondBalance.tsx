import { Gem, Sparkles } from "lucide-react";
import { formatBalance } from "@/components/CurrencyBalances";

/**
 * Compact diamond pill — Store shortcut (or display-only).
 */
export function MobileDiamondBalance({
  balance,
  onOpenStore,
  className = "",
  standalone = false,
}: {
  balance: number | null;
  /** Omit when already on Store (display only). */
  onOpenStore?: () => void;
  className?: string;
  /** Full pill chrome when shown alone (e.g. Store header). */
  standalone?: boolean;
}) {
  const label = formatBalance(balance);
  const classes = [
    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-1.5 py-1 transition active:scale-95",
    standalone
      ? "border border-white/[0.1] bg-[#151515]/90 px-3 py-1.5 shadow-soft backdrop-blur-md"
      : "",
    onOpenStore ? "hover:bg-white/10" : "",
    className,
  ].join(" ");

  const inner = (
    <>
      <Gem className="size-3.5 shrink-0 text-sky-300" aria-hidden />
      <span className="min-w-[1.25ch] text-[13px] font-semibold tabular-nums text-white">
        {label}
      </span>
    </>
  );

  if (onOpenStore) {
    return (
      <button
        type="button"
        onClick={onOpenStore}
        aria-label={`Diamond balance: ${label}. Open Store.`}
        className={classes}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={classes} aria-label={`Diamond balance: ${label}`} aria-live="polite">
      {inner}
    </span>
  );
}

/** Absolute top-right shell — Diamonds (or coins+diamonds). lg:hidden. */
export function MobileDiamondUtility({
  coins,
  balance,
  onOpenStore,
  visible = true,
  mode = "diamonds",
}: {
  coins?: number | null;
  balance: number | null;
  onOpenStore?: () => void;
  visible?: boolean;
  /** Primary pages use diamonds-only; dual kept for rare chrome needs. */
  mode?: "diamonds" | "both";
}) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end px-4 pt-[max(12px,env(safe-area-inset-top))] lg:hidden"
      aria-hidden={false}
    >
      {mode === "diamonds" ? (
        <div className="pointer-events-auto">
          <MobileDiamondBalance
            balance={balance}
            onOpenStore={onOpenStore}
            standalone
          />
        </div>
      ) : (
        <div
          className="pointer-events-auto inline-flex min-h-9 items-center gap-2 rounded-full border border-white/[0.1] bg-[#151515]/90 px-2.5 py-1 shadow-soft backdrop-blur-md"
          aria-live="polite"
        >
          <span
            className="inline-flex items-center gap-1.5 px-1"
            aria-label={`${formatBalance(coins ?? null)} Sugar Coins`}
          >
            <Sparkles className="size-3.5 shrink-0 text-champagne" aria-hidden />
            <span className="text-[13px] font-semibold tabular-nums text-white">
              {formatBalance(coins ?? null)}
            </span>
          </span>
          <span className="h-3 w-px bg-white/20" aria-hidden />
          <MobileDiamondBalance balance={balance} onOpenStore={onOpenStore} />
        </div>
      )}
    </div>
  );
}
