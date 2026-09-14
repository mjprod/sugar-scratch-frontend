import { useEffect, useRef, useState } from "react";
import { formatBalance } from "@/components/CurrencyBalances";
import { useWallet } from "@/contexts/WalletContext";

/** Static coin mark — still frame (no Lottie runtime / canvas). */
const COIN_WEBP_SRC = "/images/coin.webp";
const COUNT_BASE_MS = 720;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function countDurationMs(from: number, to: number) {
  const delta = Math.abs(to - from);
  return Math.min(1200, COUNT_BASE_MS + delta * 2);
}

export type StageCoinCountProps = {
  /** Optional display offset above wallet coins (e.g. in-card awards). */
  sessionDelta?: number;
};

/**
 * Bottom-left HUD: static coin mark + live total with count-up.
 * Floor = wallet coins; sessionDelta is additive display only.
 * Coin mark CSS-pops once on increase (no multi-pop / award machinery).
 */
export function StageCoinCount({ sessionDelta = 0 }: StageCoinCountProps) {
  const { coins } = useWallet();
  const target = Math.max(0, coins) + Math.max(0, sessionDelta);
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const animRef = useRef<number | null>(null);
  /** Remount img to restart CSS scale pop on increase only. */
  const [coinPopKey, setCoinPopKey] = useState(0);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    const prev = prevTargetRef.current;
    prevTargetRef.current = target;
    if (target <= prev) return;

    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (!reduced) setCoinPopKey((n) => n + 1);
  }, [target]);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) {
      setDisplay(target);
      return;
    }

    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (reduced) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const delta = target - from;
    const duration = countDurationMs(from, target);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = Math.round(from + delta * easeOutCubic(t));
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = target;
        setDisplay(target);
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [target]);

  const label = formatBalance(display);

  return (
    <div
      className="stage-game__coin-count"
      role="status"
      aria-live="polite"
      aria-label={`${label} coins`}
    >
      <span className="stage-game__coin-count-icon" aria-hidden="true">
        <img
          key={coinPopKey}
          className="stage-game__coin-count-img"
          src={COIN_WEBP_SRC}
          alt=""
          width={22}
          height={22}
          draggable={false}
          decoding="async"
        />
      </span>
      <div className="stage-game__coin-count-copy">
        <p className="stage-game__coin-count-value tabular-nums">{label}</p>
        <p className="stage-game__coin-count-label">Coins</p>
      </div>
    </div>
  );
}
