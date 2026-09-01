import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { ApiError } from "@/lib/api";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  isValidAuthPassword,
  resetPasswordFailureMessage,
  resetPasswordWithToken,
} from "@/services/auth";

/**
 * Reset Password — Spec 7.
 * Expects `?token=` from the forgot-password email (printed to API logs in local).
 * Demo: `?reset=expired` shows the expired-link state.
 */
export function ResetPasswordScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const { expired, token } = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const resetFlag = params.get("reset");
      const rawToken = (params.get("token") ?? "").trim();
      return {
        expired: resetFlag === "expired" || !rawToken,
        token: rawToken,
      };
    } catch {
      return { expired: true, token: "" };
    }
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError(resetPasswordFailureMessage());
      return;
    }
    if (!isValidAuthPassword(password)) {
      setError(`Use at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPasswordWithToken(token, password);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
        setError(resetPasswordFailureMessage());
      } else {
        setError("We couldn't update your password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (expired) {
    return (
      <div className="auth2-form">
        <div className="auth2-form-head">
          <h2 className="auth2-form-title">Reset Password</h2>
          <p className="auth2-form-subtitle">This link is no longer valid.</p>
        </div>
        <p className="auth2-error" role="alert">
          This reset link has expired. Request a new reset link.
        </p>
        <div className="auth2-primary-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Request a new reset link"
            costAmount={null}
            fontSize={15}
            strokeWidth={1}
            onClick={onBack}
          />
        </div>
      </div>
    );
  }

  return (
    <form className="auth2-form" onSubmit={submit} noValidate>
      <div className="auth2-form-head">
        <h2 className="auth2-form-title">Reset Password</h2>
        <p className="auth2-form-subtitle">
          Choose a new password. Links expire after 2 hours and are single-use.
        </p>
      </div>

      <label className="auth2-field">
        <span className="auth2-label">New Password</span>
        <span className="auth2-input-wrap">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            placeholder="New password"
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            className="auth2-input has-toggle"
            disabled={loading}
          />
          <button
            type="button"
            className="auth2-eye"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </span>
      </label>

      {passwordFocused || password.length > 0 ? (
        <p className="auth2-hint">
          Use at least {AUTH_PASSWORD_MIN_LENGTH} characters.
        </p>
      ) : null}

      <label className="auth2-field">
        <span className="auth2-label">Confirm Password</span>
        <span className="auth2-input-wrap">
          <input
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            placeholder="Confirm password"
            onChange={(e) => setConfirm(e.target.value)}
            className="auth2-input has-toggle"
            disabled={loading}
          />
          <button
            type="button"
            className="auth2-eye"
            aria-label={showConfirm ? "Hide password" : "Show password"}
            onClick={() => setShowConfirm((v) => !v)}
          >
            {showConfirm ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </span>
      </label>

      {error ? (
        <p className="auth2-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="auth2-primary-cta">
        <CtaButton
          {...ctaButtonPropsFromTemplate("squircleCTA")}
          fillParent
          type="submit"
          label={loading ? "Saving…" : "Save password"}
          costAmount={null}
          fontSize={15}
          strokeWidth={1}
          disabled={!password || !confirm || loading}
          auroraPaused={loading}
          costIconAnimated={false}
        />
      </div>

      <p className="auth2-switch">
        <button type="button" className="auth2-text-link is-strong" onClick={onBack}>
          Back
        </button>
      </p>
    </form>
  );
}
