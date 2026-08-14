import { Sparkles } from "lucide-react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";

/** Inline coin + diamond HUD counters (TopNav, mobile HUD, and subpage headers). */
export function CurrencyBalances({
  coins,
  diamonds,
  onOpenStore,
  storeActive = false,
}: {
  coins: number | null;
  diamonds: number | null;
  /** Diamond tap → Store. Omit when already on Store. */
  onOpenStore?: () => void;
  /** Subtle contextual highlight while Store is open. */
  storeActive?: boolean;
}) {
  const coinLabel = formatBalance(coins);
  const diamondLabel = formatBalance(diamonds);

  const diamondInner = (
    <>
      <DiamondLottie
        className="top-nav-resource-icon top-nav-resource-icon--diamond shrink-0"
        size={14}
        aria-hidden
      />
      <span className="top-nav-resource-value text-[13px] font-semibold tabular-nums">
        {diamondLabel}
      </span>
    </>
  );

  const diamondClass = [
    "top-nav-resource inline-flex min-h-9 items-center gap-1.5 rounded-md px-1.5",
    storeActive ? "top-nav-resource--store-active" : "",
    onOpenStore ? "top-nav-resource--action transition active:scale-95" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
          className={diamondClass}
        >
          {diamondInner}
        </button>
      ) : (
        <span
          className={diamondClass}
          aria-label={`${diamondLabel} Diamonds`}
          aria-current={storeActive ? "page" : undefined}
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
