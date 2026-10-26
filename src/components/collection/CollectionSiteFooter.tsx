import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { SiteLegalLinks } from "@/components/site/SiteLegalLinks";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useWallet } from "@/contexts/WalletContext";
import { Paths } from "@/routes/Paths";
import "@/components/creator/creator-influencer.css";

type LegalKind = "terms" | "privacy";

/** Figma MyCollection footer — diamonds CTA + legal links. */
export function CollectionSiteFooter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { diamonds } = useWallet();
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
      {diamonds < 10 ? (
        <button
          type="button"
          className="cpv2-diamonds-cta mc-diamonds-cta"
          onClick={() => navigate(Paths.store)}
        >
          <span className="cpv2-diamonds-cta-title">Running low on Diamonds?</span>
          <span className="cpv2-diamonds-cta-btn">
            <DiamondLottie size={14} aria-hidden />
            Get Diamonds
          </span>
          <span className="cpv2-diamonds-orb is-a" aria-hidden="true">
            <DiamondLottie size={34} aria-hidden />
          </span>
          <span className="cpv2-diamonds-orb is-b" aria-hidden="true">
            <DiamondLottie size={24} aria-hidden />
          </span>
        </button>
      ) : null}

      <footer className="cpv2-site-footer mc-site-footer">
        <SiteLegalLinks
          onPrivacy={() => setLegal("privacy")}
          onTerms={() => setLegal("terms")}
        />
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
