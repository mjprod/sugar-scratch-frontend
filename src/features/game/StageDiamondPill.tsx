import { useEffect, useState } from "react";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { useWallet } from "@/contexts/WalletContext";
import { loadGameSession } from "@/features/game/modules/gameSession";
import { formatBalance } from "@/lib/formatBalance";

/**
 * Right-side top chrome pill: home-nav coin mark over collected amount.
 * Prefer session photoPrizeTotal / diamondTotal when a hand is active; else wallet coins.
 */
export function StageDiamondPill() {
  const { coins } = useWallet();
  const [sessionAmount, setSessionAmount] = useState(0);

  useEffect(() => {
    function sync() {
      try {
        const session = loadGameSession();
        if (!session) {
          setSessionAmount(0);
          return;
        }
        // Collected from the active hand/swipe flow when present.
        const fromSession = Math.max(
          0,
          Number(session.photoPrizeTotal || 0) + Number(session.diamondTotal || 0),
        );
        setSessionAmount(fromSession);
      } catch {
        setSessionAmount(0);
      }
    }
    sync();
    const id = window.setInterval(sync, 800);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const amount = sessionAmount > 0 ? sessionAmount : coins;
  const label = formatBalance(amount);

  return (
    <div
      className="stage-game__coin-pill"
      aria-label={`${label} Diamond Dust collected`}
      aria-live="polite"
    >
      <CoinLottie
        className="stage-game__coin-pill-icon"
        size={22}
        loop
        autoplay
        aria-hidden
      />
      <span className="stage-game__coin-pill-value tabular-nums">{label}</span>
    </div>
  );
}
