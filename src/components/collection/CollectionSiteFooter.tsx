import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { Paths } from "@/routes/Paths";

type LegalKind = "terms" | "privacy";

/** Figma MyCollection footer — diamonds CTA + legal links. */
export function CollectionSiteFooter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const legalTitleId = useId();
  const open = legal !== null;

  useEffect(() => {
    setLegal(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLegal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="cpv2-diamonds-cta mc-diamonds-cta"
        onClick={() => navigate(Paths.store)}
      >
        <span className="cpv2-diamonds-cta-title">Running low on Diamonds?</span>
        <span className="cpv2-diamonds-cta-btn">
          <DiamondLottie size={11} aria-hidden />
          Get Diamonds
        </span>
        <span className="cpv2-diamonds-orb is-a" aria-hidden="true">
          <DiamondLottie size={34} aria-hidden />
        </span>
        <span className="cpv2-diamonds-orb is-b" aria-hidden="true">
          <DiamondLottie size={24} aria-hidden />
        </span>
      </button>

      <footer className="cpv2-site-footer mc-site-footer">
        <p className="cpv2-site-footer-tagline">
          <span className="is-pink">Real Creators.</span> Real Moments.
        </p>
        <nav className="cpv2-site-footer-links" aria-label="Legal">
          <button type="button" onClick={() => setLegal("privacy")}>
            Privacy Policy
          </button>
          <a href="mailto:support@sugarscratch.com">Support</a>
          <button type="button" onClick={() => setLegal("terms")}>
            Terms &amp; Conditions
          </button>
          <a href="mailto:creators@sugarscratch.com">Sign up as a influencer</a>
        </nav>
      </footer>

      {legal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="home-legal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby={legalTitleId}
            >
              <AppPageShell
                aria-label={
                  legal === "privacy" ? "Privacy Policy" : "Terms & Conditions"
                }
              >
                <LegalDocPanel
                  kind={legal === "privacy" ? "privacy" : "terms"}
                  titleId={legalTitleId}
                  onBack={() => setLegal(null)}
                  variant="page"
                />
              </AppPageShell>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
