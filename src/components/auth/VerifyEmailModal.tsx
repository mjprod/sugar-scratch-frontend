import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

/**
 * Permission System — Email verification modal.
 * Shown only when an unverified email user hits a purchase-gated action.
 */
export function VerifyEmailModal({
  open,
  email,
  onLater,
  onVerified,
  onEmailChanged,
}: {
  open: boolean;
  email: string;
  onLater: () => void;
  onVerified: () => void;
  onEmailChanged?: (email: string) => void;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setSending(false);
      setSent(false);
      setChanging(false);
      setNewEmail("");
      setPassword("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onLater();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onLater]);

  async function sendVerify() {
    setSending(true);
    await new Promise((r) => setTimeout(r, 600));
    setSending(false);
    setSent(true);
    // Prototype: simulate successful verification after send.
    await new Promise((r) => setTimeout(r, 500));
    onVerified();
  }

  async function changeEmail() {
    if (!newEmail.trim() || !password) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 650));
    setSending(false);
    onEmailChanged?.(newEmail.trim());
    setChanging(false);
    setSent(true);
    await new Promise((r) => setTimeout(r, 400));
    onVerified();
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="auth7-sheet-root" role="presentation">
          <motion.button
            type="button"
            className="auth7-sheet-backdrop"
            aria-label="Dismiss verification"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={onLater}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="auth7-sheet-panel"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
          >
            <div className="auth7-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="auth7-sheet-close"
              aria-label="Close"
              onClick={onLater}
            >
              <X className="size-5" aria-hidden />
            </button>

            <h2 id={titleId} className="auth7-sheet-title">
              Verify Your Email
            </h2>
            <p className="auth7-sheet-copy">
              We&apos;ve sent a verification link to:
              <br />
              <strong className="auth7-verify-email">{email || "your email"}</strong>
            </p>

            {changing ? (
              <div className="auth7-sheet-form" style={{ marginTop: 16 }}>
                <label className="auth7-field">
                  <span className="auth7-label">Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className="auth7-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </label>
                <label className="auth7-field">
                  <span className="auth7-label">New Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    className="auth7-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </label>
                <div className="auth7-sheet-primary">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    type="button"
                    label={sending ? "Sending…" : "Send New Verification"}
                    costAmount={null}
                    fontSize={15}
                    strokeWidth={1}
                    disabled={sending || !newEmail || !password}
                    onClick={() => void changeEmail()}
                  />
                </div>
                <button
                  type="button"
                  className="auth7-modal-cancel"
                  onClick={() => setChanging(false)}
                >
                  Back
                </button>
              </div>
            ) : (
              <div className="auth7-modal-actions">
                <div className="auth7-sheet-primary">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    type="button"
                    label={
                      sending
                        ? "Sending…"
                        : sent
                          ? "Verified"
                          : "Resend Email"
                    }
                    costAmount={null}
                    fontSize={15}
                    strokeWidth={1}
                    disabled={sending}
                    onClick={() => void sendVerify()}
                  />
                </div>
                <button
                  type="button"
                  className="auth7-text-link is-strong"
                  disabled={sending}
                  onClick={() => setChanging(true)}
                  style={{ alignSelf: "center" }}
                >
                  Wrong email? Change Email
                </button>
                <button
                  type="button"
                  className="auth7-modal-cancel"
                  onClick={onLater}
                >
                  Later
                </button>
              </div>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
