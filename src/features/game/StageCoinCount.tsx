import { useEffect, useRef, useState } from "react";
import { formatBalance } from "@/components/CurrencyBalances";
import { useWallet } from "@/contexts/WalletContext";

/** Static coin mark — still frame (no Lottie runtime / canvas). */
const COIN_WEBP_SRC = "/images/coin.webp";
const COUNT_BASE_MS = 720;
/** How long the +N chip / value pop stay when CSS animations are disabled. */
const REDUCED_MOTION_FLASH_MS = 900;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function countDurationMs(from: number, to: number) {
  const delta = Math.abs(to - from);
  return Math.min(1200, COUNT_BASE_MS + delta * 2);
}

export type StageCoinCountProps = {
  /** Optional display offset above wallet coins (legacy / tests). */
  sessionDelta?: number;
  /**
   * Bump on each 10% progress milestone so the coin mark CSS-pops in sync
   * with crossedProgressMilestone (not only when the count target changes).
   */
  popNonce?: number;
  /** Coins just awarded on this milestone — drives the floating +N chip. */
  awardAmount?: number;
};

/**
 * Bottom-left HUD: static coin mark + live total with count-up.
 * Floor = wallet coins; sessionDelta is an optional additive overlay.
 * Coin mark CSS-pops when popNonce advances — same DOM img (no remount flash).
 */
export function StageCoinCount({
  sessionDelta = 0,
  popNonce = 0,
  awardAmount = 0,
}: StageCoinCountProps) {
  const { coins } = useWallet();
  const target = Math.max(0, coins) + Math.max(0, sessionDelta);
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const animRef = useRef<number | null>(null);
  const coinImgRef = useRef<HTMLImageElement | null>(null);
  const prevPopNonceRef = useRef(popNonce);
  const [flashAward, setFlashAward] = useState(0);
  const [valuePopping, setValuePopping] = useState(false);

  // Restart scale-pop on the same img node (avoids key-remount blank frame).
  useEffect(() => {
    const prev = prevPopNonceRef.current;
    prevPopNonceRef.current = popNonce;
    if (popNonce === prev || popNonce <= 0) return;

    if (awardAmount > 0) {
      setFlashAward(awardAmount);
      setValuePopping(true);
    }

    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    // Reduced-motion CSS sets award/value animations to `none`, so
    // onAnimationEnd never fires — clear flash/pop on a timer instead.
    if (reduced) {
      if (awardAmount <= 0) return;
      const timer = window.setTimeout(() => {
        setFlashAward(0);
        setValuePopping(false);
      }, REDUCED_MOTION_FLASH_MS);
      return () => window.clearTimeout(timer);
    }

    const img = coinImgRef.current;
    if (!img) return;

    img.classList.remove("is-popping");
    // Force reflow so the next add restarts the CSS animation.
    void img.offsetWidth;
    img.classList.add("is-popping");
  }, [popNonce, awardAmount]);

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
    <div className="stage-game__coin-count">
      <span className="visually-hidden" aria-live="polite">
        {formatBalance(target)} coins
        {flashAward > 0 ? `, plus ${flashAward}` : ""}
      </span>
      <span className="stage-game__coin-count-icon" aria-hidden="true">
        <img
          ref={coinImgRef}
          className="stage-game__coin-count-img"
          src={COIN_WEBP_SRC}
          alt=""
          width={22}
          height={22}
          draggable={false}
          decoding="async"
          onAnimationEnd={(e) => {
            if (e.target !== coinImgRef.current) return;
            coinImgRef.current?.classList.remove("is-popping");
          }}
        />
      </span>
      <div className="stage-game__coin-count-copy">
        <p
          className={[
            "stage-game__coin-count-value",
            "tabular-nums",
            valuePopping ? "is-popping" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!e.animationName.includes("coin-count-value-pop")) return;
            setValuePopping(false);
          }}
        >
          {label}
        </p>
        <p className="stage-game__coin-count-label">Coins</p>
      </div>
      {flashAward > 0 ? (
        <span
          key={`${popNonce}-${flashAward}`}
          className="stage-game__coin-count-award"
          aria-hidden="true"
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            setFlashAward(0);
          }}
        >
          +{flashAward}
        </span>
      ) : null}
    </div>
  );
}
