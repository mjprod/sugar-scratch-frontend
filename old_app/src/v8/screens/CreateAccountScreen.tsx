import { Apple, Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../components/ui";
import {
  duplicateEmailMessage,
  isValidAuthPassword,
} from "../flow/auth";
import { isValidEmail } from "../flow/types";

export function CreateAccountScreen({
  onContinue,
  onLogin,
  onBrowse,
}: {
  onContinue: (data: { email: string; password: string }) => void;
  onBack?: () => void;
  onLogin: () => void;
  onBrowse?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const fieldsValid =
    isValidEmail(email) &&
    isValidAuthPassword(password) &&
    password === confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setFieldError("Please enter a valid email address.");
      return;
    }
    if (!isValidAuthPassword(password)) {
      setFieldError(
        "Password must be at least 12 characters, with a capital letter, number, and symbol.",
      );
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setFieldError("");
    await new Promise((r) => setTimeout(r, 650));
    if (email.trim().toLowerCase() === "taken@sugar.app") {
      setLoading(false);
      setFieldError(duplicateEmailMessage());
      return;
    }
    setLoading(false);
    onContinue({ email: email.trim(), password });
  }

  async function social(provider: "Google" | "Apple") {
    setSocialLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setSocialLoading(false);
    onContinue({
      email: `${provider.toLowerCase()}@sugar.app`,
      password: "SocialPass12!",
    });
  }

  return (
    <form className="auth2-form" onSubmit={submit} noValidate>
      <div className="auth2-form-head">
        <h2 className="auth2-form-title">Create Account</h2>
        <p className="auth2-form-subtitle">Start collecting in minutes</p>
      </div>

      <div className="auth2-social">
        <button
          type="button"
          className="auth2-social-btn"
          disabled={loading || socialLoading}
          onClick={() => void social("Google")}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <button
          type="button"
          className="auth2-social-btn"
          disabled={loading || socialLoading}
          onClick={() => void social("Apple")}
        >
          <Apple className="size-4" aria-hidden="true" />
          Continue with Apple
        </button>
      </div>

      <div className="auth2-divider" role="separator">
        <span>or</span>
      </div>

      <label className="auth2-field">
        <span className="auth2-label">Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          placeholder="you@email.com"
          onChange={(e) => setEmail(e.target.value)}
          className="auth2-input"
          disabled={loading || socialLoading}
        />
      </label>

      <label className="auth2-field">
        <span className="auth2-label">Password</span>
        <span className="auth2-input-wrap">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            placeholder="Create a password"
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            className="auth2-input has-toggle"
            disabled={loading || socialLoading}
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
          Minimum 12 characters, with a capital letter, number, and symbol.
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
            disabled={loading || socialLoading}
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

      {fieldError ? (
        <p className="auth2-error" role="alert">
          {fieldError}
        </p>
      ) : null}

      <Button
        full
        variant="auth"
        type="submit"
        loading={loading}
        disabled={!fieldsValid || loading || socialLoading}
        className="auth2-primary"
      >
        Create Account
      </Button>

      <p className="auth2-switch">
        Already have an account?{" "}
        <button type="button" className="auth2-text-link is-strong" onClick={onLogin}>
          Log In
        </button>
      </p>

      {onBrowse ? (
        <p className="auth2-switch">
          <button type="button" className="auth2-text-link" onClick={onBrowse}>
            Continue browsing
          </button>
        </p>
      ) : null}
    </form>
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
