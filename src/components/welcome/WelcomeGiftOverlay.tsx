import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  claimWelcomeRewards,
  clearWelcomeGiftState,
  finalizeWelcomeClaimRemote,
  hideWelcomeOverlayForSession,
  shouldShowWelcomeOverlay,
} from "@/services/welcome";
import "./welcome-gift.css";

type Phase = "offer" | "claiming" | "confirm";

/** Coverflow discard total: 95ms anticipation + 280ms drop. */
const EXIT_TOTAL_MS = 375;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function WelcomeGiftOverlay() {
  const {
    authed,
    profile,
    bumpInventoryRevision,
    invalidatePackSync,
    setProfile,
    setPurchasedPacks,
  } = useAuth();
  const { setCoins, setDiamonds } = useWallet();
  const location = useLocation();
  const skip =
    Boolean((location.state as { skipWelcomeGift?: boolean } | null)?.skipWelcomeGift);
  const titleId = useId();
  const claimSlotRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("offer");
  const [error, setError] = useState(false);
  const [heldForAccount, setHeldForAccount] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!skip && shouldShowWelcomeOverlay(profile.welcomeClaimed)) {
      setExiting(false);
      setOpen(true);
      return;
    }
    if (profile.welcomeClaimed) {
      setExiting(false);
      setOpen(false);
    }
    // Re-check on auth so a failed signup fulfill (pending cleared) can reopen.
  }, [authed, skip, profile.welcomeClaimed]);

  useEffect(() => {
    if (open && !exiting) {
      claimSlotRef.current?.querySelector("button")?.focus();
    }
  }, [open, exiting]);

  useEffect(() => {
    if (phase !== "confirm" || exiting) return;
    const id = window.setTimeout(() => setOpen(false), 900);
    return () => window.clearTimeout(id);
  }, [phase, exiting]);

  // Single continuous exit animation — no mid-flight class swap (avoids stutter).
  useEffect(() => {
    if (!exiting) return;
    const panel = panelRef.current;
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      setOpen(false);
      setExiting(false);
    }

    function onEnd(event: AnimationEvent) {
      if (event.target !== panel) return;
      if (!String(event.animationName).includes("welcome-gift-exit")) return;
      finish();
    }

    panel?.addEventListener("animationend", onEnd);
    // Fallback if animationend is missed (tab background, etc.).
    const fallback = window.setTimeout(finish, EXIT_TOTAL_MS + 40);
    return () => {
      panel?.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [exiting]);

  function closeWithoutClaim() {
    if (exiting) return;
    hideWelcomeOverlayForSession();
    if (prefersReducedMotion()) {
      setOpen(false);
      return;
    }
    setExiting(true);
  }

  async function onClaim() {
    if (phase !== "offer") return;
    setError(false);
    setHeldForAccount(false);
    setPhase("claiming");
    const result = await claimWelcomeRewards(profile.welcomeClaimed, {
      deferGrant: !authed,
    });
    if (!result.granted) {
      if (result.error) {
        setError(true);
        setPhase("offer");
        return;
      }
      setOpen(false);
      return;
    }
    if (result.deferred) {
      // Guest intent only — pack is granted on signup via fulfillPendingWelcomeGift.
      setHeldForAccount(true);
      setPhase("confirm");
      return;
    }
    if (result.demo) {
      bumpInventoryRevision();
      setPurchasedPacks((n) => n + 1);
    } else {
      invalidatePackSync();
      const committed = await finalizeWelcomeClaimRemote(result, (wallet) => {
        setDiamonds(wallet.diamonds);
        setCoins(wallet.coins);
      });
      if (!committed) {
        setError(true);
        setPhase("offer");
        return;
      }
      bumpInventoryRevision();
      setPurchasedPacks((n) => n + 1);
    }
    setProfile((d) => ({
      ...d,
      welcomeClaimed: result.welcomeClaimed ?? true,
    }));
    setPhase("confirm");
  }

  function onDebugReset() {
    clearWelcomeGiftState();
    setProfile((d) => ({ ...d, welcomeClaimed: false }));
    setPhase("offer");
    setError(false);
    setHeldForAccount(false);
    setExiting(false);
    setOpen(true);
  }

  const busy = phase === "claiming" || phase === "confirm" || exiting;
  const exitClass = exiting ? "is-exiting" : "";
  const debugReset = (
    <button
      type="button"
      className="welcome-gift-debug-reset"
      onClick={onDebugReset}
    >
      welcome kicker reset
    </button>
  );

  if (!open) {
    return createPortal(debugReset, document.body);
  }

  return createPortal(
    <>
      <div
        className={["welcome-gift-overlay", exitClass].filter(Boolean).join(" ")}
        role="presentation"
      >
        <div className="welcome-gift-scrim" />
        <div
          ref={panelRef}
          className={["welcome-gift-panel", exitClass].filter(Boolean).join(" ")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <span className="welcome-gift-panel-stroke" aria-hidden="true" />
          {phase !== "confirm" ? (
            <button
              type="button"
              className="welcome-gift-close"
              aria-label="Close welcome gift"
              onClick={closeWithoutClaim}
              disabled={busy}
            >
              ×
            </button>
          ) : null}

          <p className="welcome-gift-kicker">
            Welcome to
            <img
              src="/svg/logoSugarScratch.svg"
              alt="Sugar Scratch"
              className="welcome-gift-kicker-logo"
              draggable={false}
            />
          </p>
          <h2 id={titleId} className="welcome-gift-headline">
            Your welcome gift is here.
          </h2>

          <div className="welcome-gift-stage" aria-hidden="true">
            <span className="welcome-gift-shard" style={{ top: "28%", left: "18%", width: 18, height: 14 }} />
            <span className="welcome-gift-shard" style={{ top: "34%", right: "16%", width: 14, height: 12, animationDelay: "0.4s" }} />
            <span className="welcome-gift-shard" style={{ bottom: "28%", left: "24%", width: 12, height: 10, animationDelay: "0.9s" }} />
            <span className="welcome-gift-spark" style={{ top: "30%", left: "28%" }} />
            <span className="welcome-gift-spark" style={{ top: "38%", right: "24%", animationDelay: "0.5s" }} />
            <span className="welcome-gift-spark" style={{ bottom: "30%", left: "36%", animationDelay: "1s" }} />
            <img
              className="welcome-gift-card"
              src="/img/welcomeGirl.png"
              srcSet="/img/welcomeGirl.png 1x, /img/welcomeGirl@2x.png 2x, /img/welcomeGirl@3x.png 3x"
              alt=""
              draggable={false}
            />
          </div>

          <div className="welcome-gift-offer">
            <div className="welcome-gift-pill">
              <span className="welcome-gift-pill-icon" aria-hidden="true" />
              Free Scratch ×1
            </div>
            <p className="welcome-gift-copy">
              A free scratch to get you started.
            </p>

            {phase === "confirm" ? (
              <div className="welcome-gift-confirm" role="status">
                <strong>Gift Claimed</strong>
                <span>
                  {heldForAccount
                    ? "Waiting in your Bag after you create an account"
                    : "Added to your Bag"}
                </span>
              </div>
            ) : (
              <>
                {error ? (
                  <p className="welcome-gift-error" role="alert">
                    We couldn&apos;t claim your gift. Please try again.
                  </p>
                ) : null}
                <div ref={claimSlotRef} className="welcome-gift-cta">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("pillGoldCTA")}
                    fillParent
                    label={error ? "Try Again" : phase === "claiming" ? "Claiming…" : "Claim"}
                    costAmount={null}
                    fontSize={15}
                    strokeWidth={1}
                    disabled={busy}
                    aria-busy={busy}
                    onClick={onClaim}
                  />
                </div>
                <p className="welcome-gift-reassure">+ Your first one is on us +</p>
              </>
            )}
          </div>
        </div>
      </div>
      {debugReset}
    </>,
    document.body,
  );
}
