import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CurrencyBalances, formatBalance } from "@/components/CurrencyBalances";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useAuth } from "@/contexts/AuthContext";

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
      ? "border border-white/[0.1] bg-[oklch(0.196_0_0)]/90 px-3 py-1.5 shadow-soft backdrop-blur-md"
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
  /** e.g. PacksButton (ghost) — sits beside balances. */
  trailing?: ReactNode;
  showBrand?: boolean;
}) {
  const { guest } = useAuth();
  const { pathname } = useLocation();
  const [loginReveal, setLoginReveal] = useState(false);
  const [logoutReveal, setLogoutReveal] = useState(false);
  const wasAuthedRef = useRef(!guest);
  const pendingLogoutRef = useRef(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasAuthed = wasAuthedRef.current;
    wasAuthedRef.current = !guest;

    if (!guest) {
      pendingLogoutRef.current = false;
      setLogoutReveal(false);
      if (reduce) {
        setLoginReveal(false);
        return;
      }
      setLoginReveal(true);
      const timer = window.setTimeout(() => setLoginReveal(false), 1550);
      return () => window.clearTimeout(timer);
    }

    setLoginReveal(false);
    if (!wasAuthed || reduce) {
      pendingLogoutRef.current = false;
      setLogoutReveal(false);
      return;
    }

    pendingLogoutRef.current = true;
  }, [guest]);

  useEffect(() => {
    if (!pendingLogoutRef.current || !guest) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      pendingLogoutRef.current = false;
      setLogoutReveal(false);
      return;
    }

    let startTimer = 0;
    let endTimer = 0;
    startTimer = window.setTimeout(() => {
      pendingLogoutRef.current = false;
      setLogoutReveal(true);
      endTimer = window.setTimeout(() => setLogoutReveal(false), 1100);
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [guest, pathname]);

  if (!visible) return null;

  return (
    <header
      className={[
        "top-nav-mobile glass glass-strength-40 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface fixed top-0 z-[var(--app-top-nav-z-index,30)] lg:hidden",
        loginReveal ? "is-login-reveal" : "",
        logoutReveal ? "is-logout-reveal" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
