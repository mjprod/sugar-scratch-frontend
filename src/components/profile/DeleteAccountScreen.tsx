import { useId, useState, type FormEvent } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  DELETE_ACCOUNT_CONFIRM,
  DELETE_ACCOUNT_POINTS,
  matchesDeleteConfirm,
} from "@/content/helpCenter";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";
import { useAuth } from "@/contexts/useAuth";
import { deleteAccount } from "@/services/support";

export function DeleteAccountScreen() {
  const goBack = useGoBack(Paths.profile);
  const { logout } = useAuth();
  const confirmId = useId();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ready = matchesDeleteConfirm(confirm) && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!matchesDeleteConfirm(confirm)) {
      setError(`Type ${DELETE_ACCOUNT_CONFIRM} to confirm.`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      logout();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Delete account"
      className="app-page-shell--profile help-centre-page"
    >
      <SubpageHeader
        title="Delete account"
        onBack={goBack}
        backLabel="Back to Settings"
      />
      <form className="help-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="help-card help-pad">
          <p className="help-copy">
            This deletes the account. It does not refund Diamonds you already
            spent. Sugar Scratch does not sell subscriptions, so there is no
            separate subscription to cancel.
          </p>
          <ul className="help-list">
            {DELETE_ACCOUNT_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <div className="auth7-field">
          <label className="auth7-label" htmlFor={confirmId}>
            Type {DELETE_ACCOUNT_CONFIRM} to confirm
          </label>
          <input
            id={confirmId}
            className="auth7-input"
            value={confirm}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={submitting}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>
        {error ? (
          <p className="auth7-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="help-danger" type="submit" disabled={!ready}>
          {submitting ? "Deleting…" : "Delete account"}
        </button>
      </form>
    </AppPageShell>
  );
}
