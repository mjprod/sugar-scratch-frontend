import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  confirmVerificationCode,
  requestVerificationEmail,
  resendCooldownLabel,
  verificationCodeFailureMessage,
  verificationSendFailureMessage,
} from "@/services/auth";

/**
 * Permission System — Email verification sheet.
 * Shown after email registration, and when an unverified user hits a purchase-gated action.
 * Layout matches AuthenticationSheet (create account / log in).
 */
export function VerifyEmailModal({
  open,
  email,
  fromRegister = false,
  onBack,
  onVerified,
}: {
  open: boolean;
  email: string;
  /** After Create Account: back returns to create. After login: back dismisses. */
  fromRegister?: boolean;
  onBack: () => void;
  onVerified: () => void;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const initialSendStartedRef = useRef(false);
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
      initialSendStartedRef.current = false;
    }
  }, [open]);

  // AC-VE-002: on first open, send once. Do not lock Resend or start cooldown.
  useEffect(() => {
    if (!open) return;
    if (initialSendStartedRef.current) return;
    initialSendStartedRef.current = true;
    void requestVerificationEmail().then(({ ok }) => {
      if (!ok) setError(verificationSendFailureMessage());
    });
  }, [open]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  // Initial focus once when the sheet opens — never on cooldown ticks.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("input:not([disabled])")
        ?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // ONB-006: keep keyboard focus inside the verify sheet while open.
  // Query focusables on each Tab so disabled/resend state stays live without
  // re-running (and re-focusing) every cooldown second.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panel) return;
      const focusables = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function resendCode() {
    if (resendLocked) return;
    setSending(true);
    setError("");
    try {
      const { ok } = await requestVerificationEmail();
      if (!ok) {
        setError(verificationSendFailureMessage());
        return;
      }
      setResendCooldown(45);
    } finally {
      setSending(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setSubmitting(true);
    setError("");
    const { ok } = await confirmVerificationCode(trimmed);
    if (!ok) {
      setError(verificationCodeFailureMessage());
      setSubmitting(false);
      return;
    }
    onVerified();
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="auth7-sheet-root" role="presentation">
          <button
            type="button"
            className="auth7-sheet-backdrop"
            aria-label="Verification required"
            disabled
          />
          <motion.div
            ref={panelRef}
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
              <button
                type="button"
                className="auth7-sheet-back"
                aria-label={
                  fromRegister ? "Back to create account" : "Close verification"
                }
                disabled={busy}
                onClick={onBack}
              >
                <ChevronLeft
                  className="size-5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="auth7-sheet-body">
              <header className="auth7-sheet-head">
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
                    {sending
                      ? "Sending…"
                      : resendCooldownLabel(resendCooldown)}
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
