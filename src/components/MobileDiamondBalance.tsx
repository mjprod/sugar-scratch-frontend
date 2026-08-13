import type { ReactNode } from "react";
import { CurrencyBalances, formatBalance } from "@/components/CurrencyBalances";
import { DiamondLottie } from "@/components/ui/DiamondLottie";

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
      <DiamondLottie className="shrink-0" size={14} aria-hidden />
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
      className="top-nav-mobile glass glass-strength-40 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface fixed top-0 z-[var(--app-top-nav-z-index,30)] lg:hidden"
      aria-label="Utilities"
    >
      <div className="top-nav-mobile-inner">
        {showBrand ? (
          onOpenHome ? (
            <button
              type="button"
              onClick={onOpenHome}
              aria-label="Sugar Scratch Home"
              className="top-nav-brand shrink-0 transition hover:opacity-90"
            >
              <img
                src="/svg/logoSugarScratch.svg"
                alt="Sugar Scratch"
                className="top-nav-brand-logo h-9 w-auto"
                draggable={false}
              />
            </button>
          ) : (
            <span className="top-nav-brand shrink-0">
              <img
                src="/svg/logoSugarScratch.svg"
                alt="Sugar Scratch"
                className="top-nav-brand-logo h-9 w-auto"
                draggable={false}
              />
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
