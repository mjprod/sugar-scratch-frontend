import { useState, type FormEvent } from "react";
import { Button } from "../components/ui";
import { forgotPasswordSuccessMessage } from "../flow/auth";
import { isValidEmail } from "../flow/types";

export function ForgotPasswordScreen({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSent(true);
    // Demo continues to reset after acknowledging the neutral success copy.
    window.setTimeout(() => onSent(), 900);
  }

  return (
    <form className="auth2-form" onSubmit={submit} noValidate>
      <div className="auth2-form-head">
        <h2 className="auth2-form-title">Forgot Password</h2>
        <p className="auth2-form-subtitle">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      {sent ? (
        <p className="auth2-hint" role="status">
          {forgotPasswordSuccessMessage()}
        </p>
      ) : (
        <>
          <label className="auth2-field">
            <span className="auth2-label">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@email.com"
              onChange={(e) => setEmail(e.target.value)}
              className="auth2-input"
              disabled={loading}
            />
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
            disabled={!email || loading}
            className="auth2-primary"
          >
            Send Reset Link
          </Button>
        </>
      )}

      <p className="auth2-switch">
        <button type="button" className="auth2-text-link is-strong" onClick={onBack}>
          Back to Log In
        </button>
      </p>
    </form>
  );
}
