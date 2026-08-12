import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Apple, Loader2, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  authFailureMessage,
  createAccountFailureMessage,
  forgotPasswordSuccessMessage,
  isValidAuthPassword,
  supportingCopyForTrigger,
  type AuthenticationSheetMode,
  type AuthSuccessResult,
  type ProtectedActionType,
} from "@/services/auth";
import { isValidEmail } from "@/types/app";

/**
 * Spec-revised Authentication Sheet — Google, Apple, and email in one surface.
 * Opens immediately on protected actions (no intermediate gate).
 */
export function AuthenticationSheet({
  open,
  trigger,
  onDismiss,
  onSuccess,
}: {
  open: boolean;
  trigger?: ProtectedActionType;
  onDismiss: () => void;
  onSuccess: (result: AuthSuccessResult) => void;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<AuthenticationSheetMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<
    null | "google" | "apple" | "email"
  >(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [legalDoc, setLegalDoc] = useState<null | "terms" | "privacy">(null);
  const consentLabelId = useId();
  const consentErrorId = useId();

  const busy = submitting !== null;
  const passwordOk = isValidAuthPassword(password);
  const canCreateAccount =
    isValidEmail(email) && passwordOk && acceptedTerms;

  useEffect(() => {
    if (!open) return;
    setMode("login");
    setEmail("");
    setPassword("");
    setError("");
    setSubmitting(null);
    setShowPassword(false);
    setAcceptedTerms(false);
    setConsentError(false);
    setLegalDoc(null);
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          "button:not([disabled]), input:not([disabled])",
        )
        ?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onDismiss]);

  const title =
    mode === "create-account"
      ? "Create Your Sugar Account"
      : mode === "forgot-password" || mode === "reset-sent"
        ? "Reset Your Password"
        : "Continue Your Journey";

  const subtitle =
    mode === "create-account"
      ? "Save your collection and continue your journey."
      : mode === "forgot-password"
        ? "Enter your email and we’ll send password-reset instructions."
        : mode === "reset-sent"
          ? forgotPasswordSuccessMessage()
          : supportingCopyForTrigger(trigger);

  async function finishSocial(provider: "Google" | "Apple") {
    setSubmitting(provider === "Google" ? "google" : "apple");
    setError("");
    await wait(650);
    onSuccess({
      email: `${provider.toLowerCase()}@sugar.app`,
      provider: provider === "Google" ? "google" : "apple",
    });
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError(authFailureMessage());
      return;
    }
    setSubmitting("email");
    setError("");
    await wait(700);
    if (email.trim().toLowerCase() === "fail@sugar.app") {
      setSubmitting(null);
      setError(authFailureMessage());
      return;
    }
    onSuccess({ email: email.trim(), provider: "email" });
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!isValidAuthPassword(password)) {
      setError(`Use at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (!acceptedTerms) {
      setConsentError(true);
      setError("");
      return;
    }
    setSubmitting("email");
    setError("");
    setConsentError(false);
    await wait(700);
    if (email.trim().toLowerCase() === "taken@sugar.app") {
      setSubmitting(null);
      setError(createAccountFailureMessage());
      return;
    }
    onSuccess({ email: email.trim(), provider: "email" });
  }

  async function submitForgot(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting("email");
    setError("");
    await wait(700);
    setSubmitting(null);
    setMode("reset-sent");
  }

  function switchMode(next: AuthenticationSheetMode) {
    if (busy) return;
    setMode(next);
    setError("");
    setPassword("");
    setShowPassword(false);
    setAcceptedTerms(false);
    setConsentError(false);
    setLegalDoc(null);
  }

  function openLegalDoc(doc: "terms" | "privacy") {
    if (busy) return;
    setLegalDoc(doc);
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="auth7-sheet-root" role="presentation">
          <motion.button
            type="button"
            className="auth7-sheet-backdrop"
            aria-label="Dismiss authentication"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            disabled={busy}
            onClick={() => {
              if (!busy) onDismiss();
            }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="auth7-sheet-panel"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 20 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="auth7-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="auth7-sheet-close"
              aria-label="Close"
              disabled={busy}
              onClick={onDismiss}
            >
              <X className="size-5" aria-hidden="true" />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={legalDoc ? `legal-${legalDoc}` : mode}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="auth7-sheet-body"
              >
                {legalDoc ? (
                  <LegalDocPanel
                    kind={legalDoc}
                    titleId={titleId}
                    onBack={() => setLegalDoc(null)}
                  />
                ) : (
                  <>
                    <header className="auth7-sheet-head">
                      {mode === "forgot-password" || mode === "reset-sent" ? (
                        <button
                          type="button"
                          className="auth7-sheet-back"
                          disabled={busy}
                          onClick={() => switchMode("login")}
                        >
                          Back
                        </button>
                      ) : null}
                      <h2 id={titleId} className="auth7-sheet-title">
                        {title}
                      </h2>
                      <p className="auth7-sheet-copy">{subtitle}</p>
                    </header>

                    {mode === "reset-sent" ? (
                      <button
                        type="button"
                        className="auth7-sheet-primary"
                        onClick={() => switchMode("login")}
                      >
                        Back to Log In
                      </button>
                    ) : mode === "forgot-password" ? (
                      <form
                        className="auth7-sheet-form"
                        onSubmit={(e) => void submitForgot(e)}
                        noValidate
                      >
                        <label className="auth7-field">
                          <span className="auth7-label">Email</span>
                          <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            className="auth7-input"
                            value={email}
                            placeholder="you@email.com"
                            disabled={busy}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </label>
                        {error ? (
                          <p className="auth7-error" role="alert">
                            {error}
                          </p>
                        ) : null}
                        <button
                          type="submit"
                          className="auth7-sheet-primary"
                          disabled={busy || !email}
                        >
                          {submitting === "email" ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            "Send Reset Link"
                          )}
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="auth7-sheet-social">
                          <button
                            type="button"
                            className="auth7-social-btn is-google"
                            disabled={busy}
                            onClick={() => void finishSocial("Google")}
                          >
                            {submitting === "google" ? (
                              <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <GoogleMark />
                            )}
                            Continue with Google
                          </button>
                          <button
                            type="button"
                            className="auth7-social-btn"
                            disabled={busy}
                            onClick={() => void finishSocial("Apple")}
                          >
                            {submitting === "apple" ? (
                              <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Apple className="size-4" aria-hidden="true" />
                            )}
                            Continue with Apple
                          </button>
                        </div>

                        <div className="auth7-sheet-divider" role="separator">
                          <span>or</span>
                        </div>

                        <form
                          className="auth7-sheet-form"
                          onSubmit={(e) =>
                            void (mode === "create-account"
                              ? submitCreate(e)
                              : submitLogin(e))
                          }
                          noValidate
                        >
                          <label className="auth7-field">
                            <span className="auth7-label">Email</span>
                            <input
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              className="auth7-input"
                              value={email}
                              placeholder="you@email.com"
                              disabled={busy}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                          </label>

                          <div className="auth7-field">
                            <label
                              className="auth7-label"
                              htmlFor="auth7-password"
                            >
                              Password
                            </label>
                            <span className="auth7-input-wrap">
                              <input
                                id="auth7-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete={
                                  mode === "create-account"
                                    ? "new-password"
                                    : "current-password"
                                }
                                className="auth7-input has-toggle"
                                value={password}
                                placeholder="Password"
                                disabled={busy}
                                onChange={(e) => setPassword(e.target.value)}
                              />
                              <button
                                type="button"
                                className="auth7-show-toggle"
                                aria-pressed={showPassword}
                                aria-label={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                                disabled={busy}
                                onClick={() => setShowPassword((v) => !v)}
                              >
                                {showPassword ? "Hide" : "Show"}
                              </button>
                            </span>
                          </div>

                          {mode === "create-account" ? (
                            <p
                              className={[
                                "auth7-pw-req",
                                passwordOk ? "is-met" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-live="polite"
                            >
                              <span aria-hidden="true">
                                {passwordOk ? "✓" : "○"}
                              </span>
                              At least {AUTH_PASSWORD_MIN_LENGTH} characters
                            </p>
                          ) : (
                            <div className="auth7-row-end">
                              <button
                                type="button"
                                className="auth7-text-link"
                                disabled={busy}
                                onClick={() => switchMode("forgot-password")}
                              >
                                Forgot Password?
                              </button>
                            </div>
                          )}

                          {mode === "create-account" ? (
                            <div className="auth7-consent">
                              <div
                                className={[
                                  "auth7-consent-row",
                                  consentError ? "is-error" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={(e) => {
                                  if (
                                    (e.target as HTMLElement).closest(
                                      "[data-legal-link]",
                                    )
                                  ) {
                                    return;
                                  }
                                  setAcceptedTerms((v) => !v);
                                  setConsentError(false);
                                }}
                              >
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={acceptedTerms}
                                  aria-labelledby={consentLabelId}
                                  aria-invalid={consentError || undefined}
                                  aria-describedby={
                                    consentError ? consentErrorId : undefined
                                  }
                                  disabled={busy}
                                  className="auth7-consent-box"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAcceptedTerms((v) => !v);
                                    setConsentError(false);
                                  }}
                                >
                                  {acceptedTerms ? (
                                    <span
                                      className="auth7-consent-tick"
                                      aria-hidden
                                    >
                                      ✓
                                    </span>
                                  ) : null}
                                </button>
                                <p
                                  id={consentLabelId}
                                  className="auth7-consent-copy"
                                >
                                  I agree to the{" "}
                                  <button
                                    type="button"
                                    data-legal-link
                                    className="auth7-consent-link"
                                    disabled={busy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openLegalDoc("terms");
                                    }}
                                  >
                                    Terms of Service
                                  </button>{" "}
                                  and{" "}
                                  <button
                                    type="button"
                                    data-legal-link
                                    className="auth7-consent-link"
                                    disabled={busy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openLegalDoc("privacy");
                                    }}
                                  >
                                    Privacy Policy
                                  </button>
                                  .
                                </p>
                              </div>
                              {consentError ? (
                                <p
                                  id={consentErrorId}
                                  className="auth7-error auth7-consent-error"
                                  role="alert"
                                >
                                  Please agree to the Terms of Service and
                                  Privacy Policy to continue.
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {error ? (
                            <p className="auth7-error" role="alert">
                              {error}
                            </p>
                          ) : null}

                          <button
                            type="submit"
                            className="auth7-sheet-primary"
                            disabled={
                              busy ||
                              (mode === "create-account" && !canCreateAccount)
                            }
                          >
                            {submitting === "email" ? (
                              <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                              />
                            ) : mode === "create-account" ? (
                              "Create Account"
                            ) : (
                              "Continue"
                            )}
                          </button>
                        </form>

                        <p className="auth7-switch">
                          {mode === "create-account" ? (
                            <>
                              Already have an account?{" "}
                              <button
                                type="button"
                                className="auth7-text-link is-strong"
                                disabled={busy}
                                onClick={() => switchMode("login")}
                              >
                                Log In
                              </button>
                            </>
                          ) : (
                            <>
                              New to Sugar?{" "}
                              <button
                                type="button"
                                className="auth7-text-link is-strong"
                                disabled={busy}
                                onClick={() => switchMode("create-account")}
                              >
                                Create Account
                              </button>
                            </>
                          )}
                        </p>
                      </>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function LegalDocPanel({
  kind,
  titleId,
  onBack,
}: {
  kind: "terms" | "privacy";
  titleId: string;
  onBack: () => void;
}) {
  const title = kind === "terms" ? "Terms of Service" : "Privacy Policy";

  return (
    <div className="auth7-legal-doc">
      <button type="button" className="auth7-sheet-back" onClick={onBack}>
        Back
      </button>
      <h2 id={titleId} className="auth7-sheet-title">
        {title}
      </h2>
      <p className="auth7-sheet-copy">
        {kind === "terms"
          ? "Review Sugar’s Terms of Service. Your account details stay saved when you return."
          : "Review Sugar’s Privacy Policy. Your account details stay saved when you return."}
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M9 7.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3 2.3c1.8-1.6 2.8-4 2.8-6.8 0-.7-.1-1.3-.2-1.9H9z"
      />
      <path
        fill="#34A853"
        d="M4 10.7l-.7.5-2.3 1.8C2.5 15.7 5.5 18 9 18c2.4 0 4.4-.8 5.9-2.1l-3-2.3c-.8.6-1.9.9-2.9.9-2.3 0-4.2-1.5-4.9-3.6z"
      />
      <path
        fill="#4A90E2"
        d="M1 5c-.6 1.2-1 2.5-1 4s.4 2.8 1 4l3.1-2.4C3.8 9.8 3.7 9.4 3.7 9c0-.4.1-.8.2-1.2z"
      />
      <path
        fill="#FBBC05"
        d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6C13.4.9 11.4 0 9 0 5.5 0 2.5 2.3 1 5.6L4.1 8C4.8 5.9 6.7 3.6 9 3.6z"
      />
    </svg>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
