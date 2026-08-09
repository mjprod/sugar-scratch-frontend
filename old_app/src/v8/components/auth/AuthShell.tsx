import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { SPLASH_PHOTOS } from "../../flow/photos";

export type AuthShellMode = "login" | "signup" | "recover" | "onboarding";

/**
 * Authentication Spec 2.0 — standalone minimal shell.
 * Outside the application: no TopNav, FooterNav, balances, or product chrome.
 */
export function AuthShell({
  mode,
  onHeaderAction,
  children,
}: {
  mode: AuthShellMode;
  /** Header right action: Log In ↔ Sign Up */
  onHeaderAction?: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const headerAction =
    mode === "login"
      ? { label: "Sign Up", onClick: onHeaderAction }
      : mode === "signup"
        ? { label: "Log In", onClick: onHeaderAction }
        : mode === "recover"
          ? { label: "Log In", onClick: onHeaderAction }
          : null;

  return (
    <div className="auth2-shell" aria-label="Authentication">
      <header className="auth2-header">
        <span className="auth2-logo">Sugar</span>
        {headerAction?.onClick ? (
          <button
            type="button"
            className="auth2-header-link"
            onClick={headerAction.onClick}
          >
            {headerAction.label}
          </button>
        ) : (
          <span className="auth2-header-spacer" aria-hidden="true" />
        )}
      </header>

      <div className="auth2-body">
        <section className="auth2-hero" aria-label="Sugar introduction">
          <img
            src={SPLASH_PHOTOS[1] ?? SPLASH_PHOTOS[0]}
            alt=""
            className={[
              "auth2-hero-media",
              reduce ? "" : "is-animated",
            ]
              .filter(Boolean)
              .join(" ")}
          />
          <div className="auth2-hero-shade" aria-hidden="true" />
          <div className="auth2-hero-copy">
            <p className="auth2-hero-eyebrow">Sugar Scratch</p>
                <h1 className="auth2-hero-title">
                  Collect Moments.
                  <span className="auth2-hero-title-line">Not Just Cards.</span>
                </h1>
                <p className="auth2-hero-body">
                  Discover creators.
                  <br />
                  Collect exclusive cards.
                  <br />
                  Build your collection.
                </p>
          </div>
        </section>

        <section className="auth2-stage">
          <motion.div
            className="auth2-card"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </section>
      </div>

      <footer className="auth2-footer">
        <button type="button" className="auth2-footer-link">
          Terms of Service
        </button>
        <span className="auth2-footer-dot" aria-hidden="true">
          ·
        </span>
        <button type="button" className="auth2-footer-link">
          Privacy Policy
        </button>
      </footer>
    </div>
  );
}
