import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { SiteLegalLinks } from "@/components/site/SiteLegalLinks";
import { SiteSocialLinks } from "@/components/site/SiteSocialLinks";

type LegalKind = "terms" | "privacy";

/** Homepage footer when bottom dock is hidden; mobile uses Profile instead. */
export function HomeSiteFooter() {
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

  useEffect(() => {
    if (!open) return;
    const scroller = document.querySelector<HTMLElement>("[data-page-scroll]");
    const previousOverflow = scroller?.style.overflow ?? "";
    const previousBodyOverflow = document.body.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroller) scroller.style.overflow = previousOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  return (
    <>
      <footer className="home-site-footer" aria-label="Site">
        <img
          src="/svg/logoSugarScratch.svg"
          alt="Sugar Scratch"
          className="home-site-footer-logo"
          draggable={false}
        />
        <p className="home-site-footer-tagline">
          <span className="is-pink">Real Creators.</span> Real Moments.
        </p>
        <SiteLegalLinks
          onPrivacy={() => setLegal("privacy")}
          onTerms={() => setLegal("terms")}
        />

        <SiteSocialLinks />

        <p className="home-site-footer-copy">© 2026 Sugar Scratch</p>
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
                  legal === "terms" ? "Terms of Service" : "Privacy Policy"
                }
                className="app-page-shell--profile"
              >
                <div className="settings-legal-panel">
                  <LegalDocPanel
                    variant="page"
                    kind={legal}
                    titleId={legalTitleId}
                    backLabel="Back to Home"
                    onBack={() => setLegal(null)}
                  />
                </div>
              </AppPageShell>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
