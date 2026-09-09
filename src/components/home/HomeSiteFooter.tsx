import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalDocPanel } from "@/components/auth/LegalDocPanel";
import { SiteSocialLinks } from "@/components/site/SiteSocialLinks";

type LegalKind = "terms" | "privacy";

/** Desktop-only homepage footer. Mobile uses Profile instead. */
export function HomeSiteFooter() {
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const legalTitleId = useId();
  const open = legal !== null;

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
        <nav className="home-site-footer-nav" aria-label="Legal">
          <button
            type="button"
            className="home-site-footer-link"
            onClick={() => setLegal("terms")}
          >
            Terms of Service
          </button>
          <span className="home-site-footer-dot" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            className="home-site-footer-link"
            onClick={() => setLegal("privacy")}
          >
            Privacy Policy
          </button>
        </nav>

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
              {/* Same shell + panel as Profile legal view */}
              <AppPageShell
                aria-label={
                  legal === "terms" ? "Terms of Service" : "Privacy Policy"
                }
                className="app-page-shell--profile"
              >
                <div className="settings-legal-panel">
                  <LegalDocPanel
                    kind={legal}
                    titleId={legalTitleId}
                    variant="page"
                    backLabel="Back"
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
