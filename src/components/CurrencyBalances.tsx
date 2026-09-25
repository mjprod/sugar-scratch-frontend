import { useEffect, useRef, useState, type RefObject } from "react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { WalletBalancesPopover } from "@/components/WalletBalancesPopover";
import { useWallet } from "@/contexts/WalletContext";
import { formatBalance } from "@/lib/formatBalance";
import {
  exchangeCoinsForDiamonds,
  type CoinExchangeOption,
} from "@/services/store";

export { formatBalance, formatCompactBalance } from "@/lib/formatBalance";

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
  const { coins: walletCoins, diamonds: walletDiamonds, applyWallet } =
    useWallet();
  const diamondLabel = formatBalance(diamonds);
  const diamondAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletLeaving, setWalletLeaving] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);
  /** Bumped on open / reopen so a stale leave timer or animationend cannot close. */
  const leaveEpochRef = useRef(0);
  const activeLeaveEpochRef = useRef<number | null>(null);

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

  function completeLeave(epoch: number) {
    if (activeLeaveEpochRef.current !== epoch) return;
    activeLeaveEpochRef.current = null;
    clearLeaveTimer();
    setWalletOpen(false);
    setWalletLeaving(false);
  }

  function closeWallet() {
    if (!walletOpen || walletLeaving) return;
    const epoch = ++leaveEpochRef.current;
    activeLeaveEpochRef.current = epoch;
    setWalletLeaving(true);
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      completeLeave(epoch);
    }, 420);
  }

  function openWallet() {
    // Invalidate any in-flight leave so its timer/animationend cannot re-close.
    leaveEpochRef.current += 1;
    activeLeaveEpochRef.current = null;
    clearLeaveTimer();
    setWalletLeaving(false);
    setWalletOpen(true);
  }

  function toggleWallet() {
    if (walletOpen && !walletLeaving) closeWallet();
    else openWallet();
  }

  async function handleConvertDust(
    option: CoinExchangeOption,
  ): Promise<boolean> {
    const result = await exchangeCoinsForDiamonds(option, {
      diamonds: walletDiamonds,
      coins: walletCoins,
    });
    if (result.status !== "success") return false;
    applyWallet({ diamonds: result.diamonds, coins: result.coins });
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
          const epoch = activeLeaveEpochRef.current;
          if (epoch == null) return;
          completeLeave(epoch);
        }}
        onConvertDust={handleConvertDust}
      />
    </div>
  );
}

