import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  confirmVerificationCode,
  requestVerificationEmail,
  verificationCodeFailureMessage,
} from "@/services/auth";

/**
 * Permission System — Email verification sheet.
 * Shown after email registration, and when an unverified user hits a purchase-gated action.
 * Layout matches AuthenticationSheet (create account / log in).
 */
export function VerifyEmailModal({
  open,
  email,
  onBack,
  onVerified,
}: {
  open: boolean;
  email: string;
  onBack: () => void;
  onVerified: () => void;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const [sending, setSending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const busy = sending || submitting;
  const resendLocked = busy || resendCooldown > 0;

  useEffect(() => {
    if (!open) {
      setSending(false);
      setResendCooldown(0);
      setSubmitting(false);
      setCode("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  async function resendCode() {
    if (resendLocked) return;
    setSending(true);
    setError("");
    await requestVerificationEmail();
    setSending(false);
    setResendCooldown(45);
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setSubmitting(true);
    setError("");
    try {
      await confirmVerificationCode(trimmed);
      onVerified();
    } catch {
      setError(verificationCodeFailureMessage());
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="auth7-sheet-root" role="presentation">
          <div className="auth7-sheet-backdrop" aria-hidden="true" />
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
            <div className="auth7-sheet-chrome">
              <div className="auth7-sheet-handle" aria-hidden="true" />
            </div>

            <div className="auth7-sheet-body">
              <header className="auth7-sheet-head">
                <button
                  type="button"
                  className="auth7-sheet-back"
                  aria-label="Back to create account"
                  disabled={busy}
                  onClick={onBack}
                >
                  <ChevronLeft
                    className="size-5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
                <h2 id={titleId} className="auth7-sheet-title">
                  Verify Your Email
                </h2>
                <p className="auth7-sheet-copy">
                  Enter the verification code we sent to:
                  <br />
                  <strong className="auth7-verify-email">
                    {email || "your email"}
                  </strong>
                </p>
              </header>

              <form
                className="auth7-sheet-form"
                onSubmit={(e) => void submitCode(e)}
                noValidate
              >
                <label className="auth7-field">
                  <span className="auth7-label">Verification code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="auth7-input"
                    value={code}
                    disabled={busy}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter code"
                  />
                </label>
                {error ? (
                  <p className="auth7-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="auth7-sheet-primary">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    type="submit"
                    label={submitting ? "Verifying…" : "Verify"}
                    costAmount={null}
                    fontSize={15}
                    strokeWidth={1}
                    disabled={busy || !code.trim()}
                  />
                </div>
                <p className="auth7-switch">
                  Didn&apos;t receive verification code?{" "}
                  <button
                    type="button"
                    className="auth7-text-link is-strong"
                    disabled={resendLocked}
                    onClick={() => void resendCode()}
                  >
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend"}
                  </button>
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
