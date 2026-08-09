import { Apple, Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../components/ui";
import { authFailureMessage } from "../flow/auth";
import { isValidEmail } from "../flow/types";

export function SignInScreen({
  onSuccess,
  onSignUp,
  onForgot,
  onBrowse,
}: {
  onSuccess: (email: string) => void;
  onSignUp: () => void;
  onForgot: () => void;
  onBack?: () => void;
  /** Abandon auth and return to guest browsing. */
  onBrowse?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!email.trim() || !password) {
      setStatus("error");
      setError(authFailureMessage());
      return;
    }
    if (!isValidEmail(email)) {
      setStatus("error");
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    setError("");
    await wait(700);
    if (email.trim().toLowerCase() === "fail@sugar.app") {
      setStatus("error");
      setError(authFailureMessage());
      return;
    }
    setStatus("idle");
    onSuccess(email.trim());
  }

  async function social(provider: "Google" | "Apple") {
    setStatus("loading");
    await wait(600);
    setStatus("idle");
    onSuccess(`${provider.toLowerCase()}@sugar.app`);
  }

  return (
    <form className="auth2-form" onSubmit={submit} noValidate>
      <div className="auth2-form-head">
        <h2 className="auth2-form-title">Welcome Back</h2>
        <p className="auth2-form-subtitle">Log in to continue collecting</p>
      </div>

      <div className="auth2-social">
        <button
          type="button"
          className="auth2-social-btn"
          disabled={status === "loading"}
          onClick={() => void social("Google")}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <button
          type="button"
          className="auth2-social-btn"
          disabled={status === "loading"}
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
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          onBlur={() => setTouched(true)}
          className="auth2-input"
          disabled={status === "loading"}
        />
      </label>

      <label className="auth2-field">
        <span className="auth2-label">Password</span>
        <span className="auth2-input-wrap">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            placeholder="Password"
            onChange={(e) => {
              setPassword(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            className="auth2-input has-toggle"
            disabled={status === "loading"}
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

      <div className="auth2-row-end">
        <button type="button" className="auth2-text-link" onClick={onForgot}>
          Forgot Password?
        </button>
      </div>

      {status === "error" || (touched && email && !isValidEmail(email)) ? (
        <p className="auth2-error" role="alert">
          {status === "error"
            ? error
            : "Please enter a valid email address."}
        </p>
      ) : null}

      <Button
        full
        variant="auth"
        type="submit"
        loading={status === "loading"}
        disabled={!email || !password || status === "loading"}
        className="auth2-primary"
      >
        Log In
      </Button>

      <p className="auth2-switch">
        Don&apos;t have an account?{" "}
        <button type="button" className="auth2-text-link is-strong" onClick={onSignUp}>
          Create Account
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

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
