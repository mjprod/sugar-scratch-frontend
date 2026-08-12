import { Apple, Check, Loader2 } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { InboxButton } from "@/components/InboxButton";
import { MobileDiamondBalance } from "@/components/MobileDiamondBalance";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  changePassword,
  changePasswordErrorMessage,
  getAuthProvider,
  isValidAuthPassword,
  type AuthProvider,
} from "@/services/auth";

/**
 * Authenticated Change Password — Settings utility child page.
 * Shared shell across password / Google / Apple / success states.
 */
export function ChangePasswordScreen({
  onBack,
  onForgotPassword,
  diamonds,
  onOpenInbox,
  inboxUnreadCount = 0,
  authProvider = getAuthProvider(),
}: {
  onBack: () => void;
  onForgotPassword: () => void;
  diamonds?: number | null;
  onOpenInbox?: () => void;
  inboxUnreadCount?: number;
  authProvider?: AuthProvider;
}) {
  const currentId = useId();
  const nextId = useId();
  const isOAuth = authProvider === "google" || authProvider === "apple";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [currentError, setCurrentError] = useState("");
  const [newError, setNewError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const newOk = isValidAuthPassword(newPassword);
  const canSubmit = currentPassword.trim().length > 0 && newOk && !submitting;
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCurrentError("");
    setNewError("");
    setFormError("");

    if (!currentPassword) {
      setCurrentError("Enter your current password.");
      return;
    }
    if (!isValidAuthPassword(newPassword)) {
      setNewError(`Use at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.ok) {
        if (result.error === "incorrect_current") {
          setCurrentError(changePasswordErrorMessage(result.error));
        } else if (result.error === "invalid_new") {
          setNewError(changePasswordErrorMessage(result.error));
        } else {
          setFormError(changePasswordErrorMessage(result.error));
        }
        return;
      }
      setSuccess(true);
    } catch {
      setFormError(changePasswordErrorMessage("generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const trailing = (
    <div className="flex items-center gap-2">
      {diamonds !== undefined ? (
        <MobileDiamondBalance balance={diamonds} standalone />
      ) : null}
      {onOpenInbox ? (
        <InboxButton unreadCount={inboxUnreadCount} onOpen={onOpenInbox} />
      ) : null}
    </div>
  );

  if (isOAuth) {
    const isApple = authProvider === "apple";
    return (
      <ChangePasswordShell
        trailing={trailing}
        onBack={onBack}
        sectionId="change-password-signin"
        sectionLabel="Sign-in Method"
        carded
      >
        <div className="change-password-provider">
          <span
            className={[
              "settings-row-icon",
              isApple ? "is-security" : "is-pref",
            ].join(" ")}
            aria-hidden="true"
          >
            {isApple ? <Apple className="size-4" /> : <GoogleMark />}
          </span>
          <div className="change-password-provider-copy">
            <p className="change-password-provider-title">
              {isApple ? "Apple" : "Google"}
            </p>
            <p className="change-password-provider-body">
              Your Sugar account uses {isApple ? "Apple" : "Google"} to sign in.
            </p>
            <p className="change-password-provider-body">
              No separate Sugar password is set for this account.
            </p>
          </div>
        </div>
      </ChangePasswordShell>
    );
  }

  if (success) {
    return (
      <ChangePasswordShell
        trailing={trailing}
        onBack={onBack}
        sectionId="change-password-security"
        sectionLabel="Security"
        carded
      >
        <div className="change-password-success" aria-live="polite">
          <span className="change-password-success-icon" aria-hidden="true">
            <Check className="size-5" />
          </span>
          <p className="change-password-success-title">Password changed</p>
          <p className="change-password-success-body">
            Your password has been updated.
          </p>
          <button
            type="button"
            className="change-password-cta"
            onClick={onBack}
          >
            Back to Settings
          </button>
        </div>
      </ChangePasswordShell>
    );
  }

  return (
    <ChangePasswordShell
      trailing={trailing}
      onBack={onBack}
      sectionId="change-password-security"
      sectionLabel="Security"
    >
      <form
        className="change-password-form"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
      >
        <div className="auth7-field">
          <label className="auth7-label" htmlFor={currentId}>
            Current Password
          </label>
          <span className="auth7-input-wrap">
            <input
              id={currentId}
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              className="auth7-input has-toggle"
              value={currentPassword}
              placeholder="Current password"
              disabled={submitting}
              aria-invalid={currentError ? true : undefined}
              aria-describedby={
                currentError ? `${currentId}-error` : undefined
              }
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (currentError) setCurrentError("");
              }}
            />
            <button
              type="button"
              className="auth7-show-toggle"
              aria-pressed={showCurrent}
              aria-label={
                showCurrent ? "Hide current password" : "Show current password"
              }
              disabled={submitting}
              onClick={() => setShowCurrent((v) => !v)}
            >
              {showCurrent ? "Hide" : "Show"}
            </button>
          </span>
          {currentError ? (
            <p id={`${currentId}-error`} className="auth7-error" role="alert">
              {currentError}
            </p>
          ) : null}
        </div>

        <div className="auth7-field">
          <label className="auth7-label" htmlFor={nextId}>
            New Password
          </label>
          <span className="auth7-input-wrap">
            <input
              id={nextId}
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              className="auth7-input has-toggle"
              value={newPassword}
              placeholder="New password"
              disabled={submitting}
              aria-invalid={newError ? true : undefined}
              aria-describedby={`${nextId}-req${newError ? ` ${nextId}-error` : ""}`}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (newError) setNewError("");
              }}
            />
            <button
              type="button"
              className="auth7-show-toggle"
              aria-pressed={showNew}
              aria-label={showNew ? "Hide new password" : "Show new password"}
              disabled={submitting}
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? "Hide" : "Show"}
            </button>
          </span>
          <p
            id={`${nextId}-req`}
            className={["auth7-pw-req", newOk ? "is-met" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-live="polite"
          >
            <span aria-hidden="true">{newOk ? "✓" : "○"}</span>
            At least {AUTH_PASSWORD_MIN_LENGTH} characters
          </p>
          {newError ? (
            <p id={`${nextId}-error`} className="auth7-error" role="alert">
              {newError}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p className="auth7-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          className="change-password-cta"
          disabled={!canSubmit}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Changing…
            </>
          ) : (
            "Change Password"
          )}
        </button>

        <button
          type="button"
          className="change-password-forgot"
          disabled={submitting}
          onClick={onForgotPassword}
        >
          Forgot your current password?
        </button>
      </form>
    </ChangePasswordShell>
  );
}

function ChangePasswordShell({
  onBack,
  trailing,
  sectionId,
  sectionLabel,
  carded = false,
  children,
}: {
  onBack: () => void;
  trailing: ReactNode;
  sectionId: string;
  sectionLabel: string;
  /** Compact confirmation / provider cards only — not the password form. */
  carded?: boolean;
  children: ReactNode;
}) {
  return (
    <AppPageShell
      variant="secondary"
      aria-label="Change Password"
      className="settings-page"
    >
      <SubpageHeader
        title="Change Password"
        onBack={onBack}
        backLabel="Back to Settings"
        trailing={trailing}
      />
      <div className="settings-stack change-password-stack">
        <section className="settings-section" aria-labelledby={sectionId}>
          <h2 id={sectionId} className="settings-section-label">
            {sectionLabel}
          </h2>
          {carded ? (
            <div className="settings-utility-card">{children}</div>
          ) : (
            children
          )}
        </section>
      </div>
    </AppPageShell>
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
