import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "../components/ui";
import { isValidAuthPassword } from "../flow/auth";

/**
 * Reset Password — Spec 7.
 * Demo: `?reset=expired` shows the expired-link state.
 */
export function ResetPasswordScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const expired = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("reset") === "expired";
    } catch {
      return false;
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
    if (!isValidAuthPassword(password)) {
      setError("Use at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 650));
    setLoading(false);
    onDone();
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
        <Button full variant="auth" type="button" className="auth2-primary" onClick={onBack}>
          Request a new reset link
        </Button>
      </div>
    );
  }

  return (
    <form className="auth2-form" onSubmit={submit} noValidate>
      <div className="auth2-form-head">
        <h2 className="auth2-form-title">Reset Password</h2>
        <p className="auth2-form-subtitle">
          Choose a new password. Links expire after 30 minutes and are single-use.
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
        <p className="auth2-hint">Use at least 12 characters.</p>
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

      <Button
        full
        variant="auth"
        type="submit"
        loading={loading}
        disabled={!password || !confirm || loading}
        className="auth2-primary"
      >
        Save password
      </Button>

      <p className="auth2-switch">
        <button type="button" className="auth2-text-link is-strong" onClick={onBack}>
          Back
        </button>
      </p>
    </form>
  );
}
