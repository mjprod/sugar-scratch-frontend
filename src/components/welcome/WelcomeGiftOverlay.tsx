import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  claimWelcomeRewards,
  finalizeWelcomeClaimRemote,
  hideWelcomeOverlayForSession,
  shouldShowWelcomeOverlay,
} from "@/services/welcome";
import "./welcome-gift.css";

type Phase = "offer" | "claiming" | "confirm";
/** Close sequence: CTA drops first, then dialog discard. */
type ExitPhase = "idle" | "cta" | "panel";

/** Quick CTA fade/drop before dialog anticipation. */
const CTA_EXIT_MS = 150;
/** Coverflow discard total: 95ms anticipation + 280ms drop. */
const PANEL_EXIT_MS = 375;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function WelcomeGiftOverlay({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void;
}) {
  const {
    authed,
    authOpen,
    emailVerified,
    verifyOpen,
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
  const [exitPhase, setExitPhase] = useState<ExitPhase>("idle");

  useEffect(() => {
    // Never interrupt create-account / verify — gift only after email is verified.
    const waitingOnEmailVerify = authed && !emailVerified;
    if (authOpen || verifyOpen || waitingOnEmailVerify) {
      setOpen(false);
      return;
    }
    if (!skip && shouldShowWelcomeOverlay(profile.welcomeClaimed)) {
      setExitPhase("idle");
      setOpen(true);
      return;
    }
    if (profile.welcomeClaimed) {
      setExitPhase("idle");
      setOpen(false);
    }
  }, [
    authOpen,
    authed,
    emailVerified,
    verifyOpen,
    skip,
    profile.welcomeClaimed,
  ]);

  useEffect(() => {
    if (open && exitPhase === "idle") {
      claimSlotRef.current?.querySelector("button")?.focus();
    }
  }, [open, exitPhase]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (phase !== "confirm" || exitPhase !== "idle") return;
    const id = window.setTimeout(() => setOpen(false), 900);
    return () => window.clearTimeout(id);
  }, [phase, exitPhase]);

  // Beat 1 → beat 2: CTA out, then dialog discard.
  useEffect(() => {
    if (exitPhase !== "cta") return;
    const id = window.setTimeout(() => setExitPhase("panel"), CTA_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [exitPhase]);

  // Single continuous panel exit — no mid-flight class swap (avoids stutter).
  useEffect(() => {
    if (exitPhase !== "panel") return;
    const panel = panelRef.current;
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      setOpen(false);
      setExitPhase("idle");
    }

    function onEnd(event: AnimationEvent) {
      if (event.target !== panel) return;
      if (!String(event.animationName).includes("welcome-gift-exit")) return;
      finish();
    }

    panel?.addEventListener("animationend", onEnd);
    // Fallback if animationend is missed (tab background, etc.).
    const fallback = window.setTimeout(finish, PANEL_EXIT_MS + 40);
    return () => {
      panel?.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [exitPhase]);

  function closeWithoutClaim() {
    if (exitPhase !== "idle") return;
    hideWelcomeOverlayForSession();
    if (prefersReducedMotion()) {
      setOpen(false);
      return;
    }
    setExitPhase("cta");
  }

  async function onClaim() {
    if (phase !== "offer" || exitPhase !== "idle") return;
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

  // Don't mark CTA disabled during exit — disabled greys the gold button.
  const claimBusy = phase === "claiming" || phase === "confirm";
  const exitLocked = exitPhase !== "idle";
  const overlayExitClass =
    exitPhase === "cta"
      ? "is-exit-cta"
      : exitPhase === "panel"
        ? "is-exiting"
        : "";
  const panelExitClass = exitPhase === "panel" ? "is-exiting" : "";
  const ctaExitClass =
    exitPhase === "cta" || exitPhase === "panel" ? "is-exit-cta" : "";
  if (!open) return null;

  return createPortal(
    <div
        className={["welcome-gift-overlay", overlayExitClass].filter(Boolean).join(" ")}
        role="presentation"
      >
        <div className="welcome-gift-scrim" />
        <div
          ref={panelRef}
          className={["welcome-gift-panel", panelExitClass].filter(Boolean).join(" ")}
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
              disabled={claimBusy || exitLocked}
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
            A gift for you…
          </h2>

          <div className="welcome-gift-stage" aria-hidden="true">
            <span className="welcome-gift-shard" style={{ top: "28%", left: "18%", width: 18, height: 14 }} />
            <span className="welcome-gift-shard" style={{ top: "34%", right: "16%", width: 14, height: 12, animationDelay: "0.4s" }} />
            <span className="welcome-gift-shard" style={{ bottom: "28%", left: "24%", width: 12, height: 10, animationDelay: "0.9s" }} />
            <span className="welcome-gift-spark" style={{ top: "30%", left: "28%" }} />
            <span className="welcome-gift-spark" style={{ top: "36%", right: "26%", animationDelay: "0.6s" }} />
            <div className="welcome-gift-card">
              <img
                className="welcome-gift-card-img"
                src="/img/welcomeGirl.png"
                srcSet="/img/welcomeGirl.png 1x, /img/welcomeGirl@2x.png 2x, /img/welcomeGirl@3x.png 3x"
                alt=""
                draggable={false}
              />
            </div>
          </div>

          <div className="welcome-gift-offer">
            <div className="welcome-gift-pill">
              <span className="welcome-gift-pill-icon" aria-hidden="true" />
              Free Scratch ×1
            </div>

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
                <div
                  ref={claimSlotRef}
                  className={["welcome-gift-cta", ctaExitClass].filter(Boolean).join(" ")}
                >
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("pillGoldCTA")}
                    fillParent
                    label={error ? "Try Again" : phase === "claiming" ? "Claiming…" : "Claim Now!"}
                    costAmount={null}
                    fontSize={15}
                    strokeWidth={1}
                    disabled={claimBusy}
                    aria-busy={claimBusy}
                    onClick={onClaim}
                  />
                </div>
                <p
                  className={["welcome-gift-reassure", ctaExitClass]
                    .filter(Boolean)
                    .join(" ")}
                >
                  + Your first one is on us +
                </p>
              </>
            )}
          </div>
        </div>
      </div>,
    document.body,
  );
}
