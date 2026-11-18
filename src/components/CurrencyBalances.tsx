import { CoinLottie } from "@/components/ui/CoinLottie";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { formatBalance } from "@/lib/formatBalance";

export { formatBalance, formatCompactBalance } from "@/lib/formatBalance";

/** Inline coin + diamond HUD counters (TopNav, mobile HUD, and subpage headers). */
export function CurrencyBalances({
  coins,
  diamonds,
  onOpenStore,
  storeActive = false,
  interactive = true,
  compact = false,
  diamondsOnly = false,
}: {
  coins: number | null;
  diamonds: number | null;
  /** Opens Get Diamonds when the diamond chip is tapped. */
  onOpenStore?: () => void;
  /** Subtle contextual highlight while Store is open. */
  storeActive?: boolean;
  /** When false, balances stay display-only (e.g. game HUD). */
  interactive?: boolean;
  /** Icon only — used by the game HUD. */
  compact?: boolean;
  /** Hide the coin chip (game HUD diamond-only). */
  diamondsOnly?: boolean;
}) {
  const coinLabel = formatBalance(coins);
  const diamondLabel = formatBalance(diamonds);
  const showCoins = !diamondsOnly;
  const diamondOpensStore = Boolean(interactive && onOpenStore);

  const coinInner = (
    <>
      <CoinLottie
        className="top-nav-resource-icon top-nav-resource-icon--coin shrink-0"
        size={16}
        animated
        loop
        autoplay
        aria-hidden
      />
      {compact ? null : (
        <span className="top-nav-resource-value text-title font-semibold tabular-nums">
          {coinLabel}
        </span>
      )}
    </>
  );

  const diamondInner = (
    <>
      <DiamondLottie
        className="top-nav-resource-icon top-nav-resource-icon--diamond shrink-0"
        size={14}
        animated
        loop
        autoplay
        aria-hidden
      />
      {compact ? null : (
        <span className="top-nav-resource-value text-title font-semibold tabular-nums">
          {diamondLabel}
        </span>
      )}
    </>
  );

  const coinClass = [
    "top-nav-resource top-nav-resource--coin inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-1.5",
    compact ? "is-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const diamondClass = [
    "top-nav-resource top-nav-resource--diamond inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-1.5",
    compact ? "is-compact" : "",
    storeActive ? "top-nav-resource--store-active" : "",
    diamondOpensStore
      ? "top-nav-resource--action cursor-pointer border-0 bg-transparent font-inherit text-inherit"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="top-nav-resources flex min-w-0 shrink-0 items-center gap-2"
      aria-live="polite"
    >
      {showCoins ? (
        <span className={coinClass} aria-label={`${coinLabel} Coins`}>
          {coinInner}
        </span>
      ) : null}

      {diamondOpensStore ? (
        <button
          type="button"
          className={diamondClass}
          onClick={onOpenStore}
          aria-label={`${diamondLabel} Diamonds. Get Diamonds.`}
        >
          {diamondInner}
        </button>
      ) : (
        <span className={diamondClass} aria-label={`${diamondLabel} Diamonds`}>
          {diamondInner}
        </span>
      )}
    </div>
  );
}
