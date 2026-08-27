import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { CREATOR_CARD_PHOTOS } from "@/lib/photos";
import { useAuth } from "@/contexts/AuthContext";
import {
  claimWelcomeRewards,
  clearWelcomeGiftState,
  hideWelcomeOverlayForSession,
  shouldShowWelcomeOverlay,
} from "@/services/welcome";
import "./welcome-gift.css";

type Phase = "offer" | "claiming" | "confirm";

export function WelcomeGiftOverlay() {
  const {
    authed,
    profile,
    bumpInventoryRevision,
    setProfile,
    setPurchasedPacks,
  } = useAuth();
  const location = useLocation();
  const skip =
    Boolean((location.state as { skipWelcomeGift?: boolean } | null)?.skipWelcomeGift);
  const titleId = useId();
  const claimSlotRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("offer");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!skip && authed && shouldShowWelcomeOverlay(profile.welcomeClaimed)) {
      setOpen(true);
      return;
    }
    if (profile.welcomeClaimed) setOpen(false);
  }, [authed, skip, profile.welcomeClaimed]);

  useEffect(() => {
    if (open) claimSlotRef.current?.querySelector("button")?.focus();
  }, [open]);

  useEffect(() => {
    if (phase !== "confirm") return;
    const id = window.setTimeout(() => setOpen(false), 900);
    return () => window.clearTimeout(id);
  }, [phase]);

  function closeWithoutClaim() {
    hideWelcomeOverlayForSession();
    setOpen(false);
  }

  function onClaim() {
    if (phase !== "offer") return;
    setError(false);
    setPhase("claiming");
    const result = claimWelcomeRewards(profile.welcomeClaimed);
    if (!result.granted) {
      if (result.error) {
        setError(true);
        setPhase("offer");
        return;
      }
      setOpen(false);
      return;
    }
    bumpInventoryRevision();
    setPurchasedPacks((n) => n + 1);
    setProfile((d) => ({ ...d, welcomeClaimed: true }));
    setPhase("confirm");
  }

  function onDebugReset() {
    clearWelcomeGiftState();
    setProfile((d) => ({ ...d, welcomeClaimed: false }));
    setPhase("offer");
    setError(false);
    setOpen(true);
  }

  const busy = phase === "claiming" || phase === "confirm";
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
      <div className="welcome-gift-overlay" role="presentation">
        <div className="welcome-gift-scrim" />
        <div
          className="welcome-gift-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
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
            <div className="welcome-gift-glow" />
            <span className="welcome-gift-shard" style={{ top: "8%", left: "-6%", width: 18, height: 14 }} />
            <span className="welcome-gift-shard" style={{ top: "18%", right: "-8%", width: 14, height: 12, animationDelay: "0.4s" }} />
            <span className="welcome-gift-shard" style={{ bottom: "16%", left: "-4%", width: 12, height: 10, animationDelay: "0.9s" }} />
            <span className="welcome-gift-spark" style={{ top: "12%", left: "18%" }} />
            <span className="welcome-gift-spark" style={{ top: "28%", right: "10%", animationDelay: "0.5s" }} />
            <span className="welcome-gift-spark" style={{ bottom: "22%", left: "22%", animationDelay: "1s" }} />
            <div className="welcome-gift-card">
              <img
                className="welcome-gift-portrait"
                src={CREATOR_CARD_PHOTOS.juliana}
                alt=""
                draggable={false}
              />
              <div className="welcome-gift-foil" />
              <div className="welcome-gift-shimmer" />
              <span className="welcome-gift-seal">S</span>
            </div>
          </div>

          <div className="welcome-gift-pill">
            <span className="welcome-gift-pill-icon" aria-hidden="true" />
            Free Scratch × 1
          </div>
          <p className="welcome-gift-copy">
            A free scratch to get you started.
          </p>

          {phase === "confirm" ? (
            <div className="welcome-gift-confirm" role="status">
              <strong>Gift Claimed</strong>
              <span>Added to your Bag</span>
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
      {debugReset}
    </>,
    document.body,
  );
}
