import type { ReactNode } from "react";
import { CurrencyBalances, formatBalance } from "@/components/CurrencyBalances";
import { Gem } from "lucide-react";

/**
 * Compact diamond control — used on secondary subpage trailings (Store/Settings).
 * Mobile TopNav uses CurrencyBalances instead.
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

/** Compact mobile utility HUD — brand + inline resources + inbox. lg:hidden. */
export function MobileDiamondUtility({
  coins,
  balance,
  onOpenStore,
  onOpenHome,
  visible = true,
  trailing,
  showBrand = true,
}: {
  coins?: number | null;
  balance: number | null;
  onOpenStore?: () => void;
  onOpenHome?: () => void;
  visible?: boolean;
  /** e.g. InboxButton (ghost) — sits beside balances. */
  trailing?: ReactNode;
  showBrand?: boolean;
}) {
  if (!visible) return null;

  return (
    <header
      className={[
        "top-nav-mobile fixed inset-x-0 top-0 z-[var(--app-top-nav-z-index,30)] lg:hidden",
      ].join(" ")}
      aria-label="Utilities"
    >
      <div className="top-nav-mobile-inner flex min-h-[44px] items-center gap-3 px-4 pb-2 pt-[max(8px,env(safe-area-inset-top,0px))]">
        {showBrand ? (
          onOpenHome ? (
            <button
              type="button"
              onClick={onOpenHome}
              className="top-nav-brand shrink-0 text-[17px] font-bold tracking-[-0.03em] text-white/90"
            >
              Sugar
            </button>
          ) : (
            <span className="top-nav-brand shrink-0 text-[17px] font-bold tracking-[-0.03em] text-white/90">
              Sugar
            </span>
          )
        ) : (
          <span className="flex-1" aria-hidden />
        )}
        <div className="ml-auto flex items-center gap-2.5">
          <CurrencyBalances
            coins={coins ?? null}
            diamonds={balance}
            onOpenStore={onOpenStore}
          />
          {trailing}
        </div>
      </div>
    </header>
  );
}
