import { Gem } from "lucide-react";
import { formatBalance } from "./CurrencyBalances";

/**
 * Minimal mobile Diamond utility — top-right pill, Store shortcut.
 * Desktop keeps CurrencyBalances in TopNav.
 */
export function MobileDiamondBalance({
  balance,
  onOpenStore,
  className = "",
}: {
  balance: number | null;
  /** Omit when already on Store (display only). */
  onOpenStore?: () => void;
  className?: string;
}) {
  const label = formatBalance(balance);
  const classes = [
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#151515]/90 px-3 py-1.5 shadow-soft backdrop-blur-md transition active:scale-95",
    onOpenStore ? "hover:bg-white/[0.08] hover:border-white/15" : "",
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

/** Absolute top-right shell for primary mobile pages (lg:hidden). */
export function MobileDiamondUtility({
  balance,
  onOpenStore,
  visible = true,
}: {
  balance: number | null;
  onOpenStore?: () => void;
  visible?: boolean;
}) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end px-4 pt-[max(12px,env(safe-area-inset-top))] lg:hidden"
      aria-hidden={false}
    >
      <div className="pointer-events-auto">
        <MobileDiamondBalance balance={balance} onOpenStore={onOpenStore} />
      </div>
    </div>
  );
}
