import { useEffect, useRef, useState, type RefObject } from "react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { WalletBalancesPopover } from "@/components/WalletBalancesPopover";
import { useWallet } from "@/contexts/WalletContext";
import type { CoinExchangeOption } from "@/services/store";

/** Inline diamond HUD counter (TopNav, mobile HUD, and subpage headers).
 * Dust lives in the Diamonds wallet popover. */
export function CurrencyBalances({
  coins,
  diamonds,
  onOpenStore: _onOpenStore,
  storeActive = false,
}: {
  coins: number | null;
  diamonds: number | null;
  /** Kept for call-site compatibility; Dust tap moved into the wallet popover. */
  onOpenStore?: () => void;
  /** Subtle contextual highlight while Store is open. */
  storeActive?: boolean;
}) {
  const { addDiamonds, spendCoins } = useWallet();
  const diamondLabel = formatBalance(diamonds);
  const diamondAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletLeaving, setWalletLeaving] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current != null) {
        window.clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  function clearLeaveTimer() {
    if (leaveTimerRef.current != null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }

  function closeWallet() {
    if (!walletOpen || walletLeaving) return;
    setWalletLeaving(true);
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      setWalletOpen(false);
      setWalletLeaving(false);
      leaveTimerRef.current = null;
    }, 420);
  }

  function openWallet() {
    clearLeaveTimer();
    setWalletLeaving(false);
    setWalletOpen(true);
  }

  function toggleWallet() {
    if (walletOpen && !walletLeaving) closeWallet();
    else openWallet();
  }

  function handleConvertDust(option: CoinExchangeOption): boolean {
    if (!spendCoins(option.coins)) return false;
    addDiamonds(option.diamonds);
    return true;
  }

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
      <span className="top-nav-resource-value text-[13px] font-semibold tabular-nums">
        {diamondLabel}
      </span>
    </>
  );

  const diamondActionClass = [
    "top-nav-resource top-nav-resource--action top-nav-resource--diamond inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-1.5 transition active:scale-95",
    storeActive ? "top-nav-resource--store-active" : "",
    walletOpen && !walletLeaving ? "is-wallet-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="top-nav-resources flex min-w-0 shrink-0 items-center gap-2"
      aria-live="polite"
    >
      <button
        type="button"
        ref={diamondAnchorRef as RefObject<HTMLButtonElement>}
        onClick={toggleWallet}
        aria-label={`${diamondLabel} Diamonds, wallet details`}
        aria-haspopup="dialog"
        aria-expanded={walletOpen && !walletLeaving}
        aria-controls="top-nav-wallet-balances"
        className={diamondActionClass}
      >
        {diamondInner}
      </button>

      <WalletBalancesPopover
        open={walletOpen}
        leaving={walletLeaving}
        diamonds={diamonds}
        coins={coins}
        anchorRef={diamondAnchorRef}
        onClose={closeWallet}
        onLeaveEnd={() => {
          clearLeaveTimer();
          setWalletOpen(false);
          setWalletLeaving(false);
        }}
        onConvertDust={handleConvertDust}
      />
    </div>
  );
}

/** AC12/AC13 — HUD balance text: "0", "--", or en-US thousands (e.g. "5,133"). */
export function formatBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US");
}

/**
 * Compact balance for tight UI (wallet popover Dust, etc.).
 * 17,907 → "17.9K"; 17,907,907 → "17.9M"; 1_790_000_000 → "1.8B".
 */
export function formatCompactBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  const n = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (n < 1000) return `${sign}${Math.round(n).toLocaleString("en-US")}`;

  const tiers = [
    { div: 1_000_000_000, suffix: "B" },
    { div: 1_000_000, suffix: "M" },
    { div: 1_000, suffix: "K" },
  ] as const;

  for (const tier of tiers) {
    if (n >= tier.div) {
      const scaled = n / tier.div;
      const rounded =
        scaled >= 100 ? Math.round(scaled).toString() : scaled.toFixed(1).replace(/\.0$/, "");
      return `${sign}${rounded}${tier.suffix}`;
    }
  }

  return `${sign}${Math.round(n).toLocaleString("en-US")}`;
}
