import { Camera, Check } from "lucide-react";
import {
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameValidationMessage,
  normalizeDisplayName,
  normalizeUsername,
  updateProfile,
  updateProfileErrorMessage,
  usernameValidationMessage,
  USERNAME_MAX_LENGTH,
} from "@/services/auth";
import { AVATAR_OPTIONS } from "@/types/app";

export type EditProfileValues = {
  displayName: string;
  username: string;
  avatar: string | null;
};

export function EditProfileScreen({
  initial,
  onBack,
  onSaved,
}: {
  initial: EditProfileValues;
  onBack: () => void;
  onSaved: (next: EditProfileValues) => void;
}) {
  const nameId = useId();
  const usernameId = useId();
  const discardTitleId = useId();

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(
    normalizeUsername(initial.username.replace(/^@/, "")),
  );
  const [avatar, setAvatar] = useState<string | null>(
    initial.avatar || AVATAR_OPTIONS[0],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameError, setNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);

  const baselineName = normalizeDisplayName(initial.displayName);
  const baselineUsername = normalizeUsername(
    initial.username.replace(/^@/, ""),
  );
  const baselineAvatar = initial.avatar || AVATAR_OPTIONS[0];

  const nextName = normalizeDisplayName(displayName);
  const nextUsername = normalizeUsername(username);
  const usernameChanged = nextUsername !== baselineUsername;
  const dirty =
    nextName !== baselineName ||
    usernameChanged ||
    (avatar || AVATAR_OPTIONS[0]) !== baselineAvatar;

  const nameMsg = displayNameValidationMessage(displayName);
  const userMsg = usernameValidationMessage(username, {
    currentUsername: baselineUsername,
  });
  const canSave = dirty && !nameMsg && !userMsg && !submitting;

  function requestBack() {
    if (submitting) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onBack();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const nameIssue = displayNameValidationMessage(displayName);
    const userIssue = usernameValidationMessage(username, {
      currentUsername: baselineUsername,
    });
    setNameError(nameIssue ?? "");
    setUsernameError(userIssue ?? "");
    if (nameIssue || userIssue || !dirty) return;

    setSubmitting(true);
    try {
      const result = await updateProfile({
        displayName: nextName,
        username: nextUsername,
        avatarUrl: avatar,
        currentUsername: baselineUsername,
      });
      if (!result.ok) {
        setFormError(updateProfileErrorMessage());
        return;
      }
      const saved: EditProfileValues = {
        displayName: result.user?.displayName ?? nextName,
        username: result.user?.username ?? nextUsername,
        avatar: result.user?.avatarUrl ?? avatar,
      };
      onSaved(saved);
      setToast("Profile updated");
      window.setTimeout(() => {
        setToast("");
        onBack();
      }, 700);
    } catch {
      setFormError(updateProfileErrorMessage());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppPageShell aria-label="Edit Profile" className="app-page-shell--profile">
      <SubpageHeader
        title="Edit Profile"
        onBack={requestBack}
        backLabel="Back to profile"
      />

      <EditProfileShell>
        <form
          className="edit-profile-form"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          <div className="edit-profile-avatar-block">
            <button
              type="button"
              className="edit-profile-avatar-btn"
              aria-label="Change avatar"
              disabled={submitting}
              onClick={() => setPickerOpen((v) => !v)}
            >
              <span className="edit-profile-avatar" aria-hidden="true">
                {avatar || "✨"}
              </span>
              <span className="edit-profile-avatar-badge" aria-hidden="true">
                <Camera className="size-3.5" />
              </span>
            </button>
            <button
              type="button"
              className="edit-profile-change-avatar"
              disabled={submitting}
              onClick={() => setPickerOpen((v) => !v)}
            >
              Change Avatar
            </button>
            {pickerOpen ? (
              <div
                className="edit-profile-avatar-picker"
                role="listbox"
                aria-label="Choose avatar"
              >
                {AVATAR_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={avatar === option}
                    className={[
                      "edit-profile-avatar-option",
                      avatar === option ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={submitting}
                    onClick={() => {
                      setAvatar(option);
                      setPickerOpen(false);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="auth7-field">
            <label className="auth7-label" htmlFor={nameId}>
              Display Name
            </label>
            <span className="auth7-input-wrap">
              <input
                id={nameId}
                type="text"
                autoComplete="nickname"
                className="auth7-input"
                value={displayName}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                placeholder="Display name"
                disabled={submitting}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={`${nameId}-hint${nameError ? ` ${nameId}-error` : ""}`}
                onChange={(e) => {
                  setDisplayName(e.target.value.slice(0, DISPLAY_NAME_MAX_LENGTH));
                  if (nameError) setNameError("");
                  if (formError) setFormError("");
                }}
              />
            </span>
            <p id={`${nameId}-hint`} className="edit-profile-hint">
              This is how your name appears on Sugar.
            </p>
            {nameError ? (
              <p id={`${nameId}-error`} className="auth7-error" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="auth7-field">
            <label className="auth7-label" htmlFor={usernameId}>
              Username
            </label>
            <span className="auth7-input-wrap edit-profile-username-wrap">
              <span className="edit-profile-at" aria-hidden="true">
                @
              </span>
              <input
                id={usernameId}
                type="text"
                autoComplete="username"
                className="auth7-input edit-profile-username-input"
                value={username}
                maxLength={USERNAME_MAX_LENGTH}
                placeholder="username"
                disabled={submitting}
                aria-invalid={usernameError ? true : undefined}
                aria-describedby={`${usernameId}-hint${usernameError ? ` ${usernameId}-error` : ""}`}
                onChange={(e) => {
                  setUsername(normalizeUsername(e.target.value));
                  if (usernameError) setUsernameError("");
                  if (formError) setFormError("");
                }}
              />
            </span>
            <p id={`${usernameId}-hint`} className="edit-profile-hint">
              Your unique Sugar username.
            </p>
            {usernameError ? (
              <p
                id={`${usernameId}-error`}
                className="auth7-error"
                role="alert"
              >
                {usernameError}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p className="auth7-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="edit-profile-cta">
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              fillParent
              type="submit"
              label={submitting ? "Saving…" : "Save Changes"}
              costAmount={null}
              fontSize={15}
              strokeWidth={1}
              disabled={!canSave}
            />
          </div>
        </form>
      </EditProfileShell>

      {discardOpen ? (
        <div className="edit-profile-discard" role="presentation">
          <div
            className="edit-profile-discard-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={discardTitleId}
          >
            <h2 id={discardTitleId} className="edit-profile-discard-title">
              Discard changes?
            </h2>
            <p className="edit-profile-discard-body">
              Your profile changes haven&apos;t been saved.
            </p>
            <div className="edit-profile-discard-actions">
              <button
                type="button"
                className="edit-profile-discard-keep"
                onClick={() => setDiscardOpen(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="edit-profile-discard-confirm"
                onClick={() => {
                  setDiscardOpen(false);
                  onBack();
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="edit-profile-toast" role="status" aria-live="polite">
          <Check className="size-3.5" aria-hidden="true" />
          {toast}
        </div>
      ) : null}
    </AppPageShell>
  );
}

function EditProfileShell({ children }: { children: ReactNode }) {
  return (
    <div className="settings-stack edit-profile-stack">
      <section
        className="settings-section"
        aria-labelledby="edit-profile-section"
      >
        <h2 id="edit-profile-section" className="settings-section-label">
          Identity
        </h2>
        <div className="settings-utility-card">{children}</div>
      </section>
    </div>
  );
}
