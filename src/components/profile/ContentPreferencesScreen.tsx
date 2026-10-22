import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { RotateCcw, TriangleAlert, Users } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { SubpageHeader } from "@/components/SubpageHeader";
import { Paths } from "@/routes/Paths";
import { resetFollowing } from "@/services/following";
import { clearRecommendationState } from "@/services/recommendation";
import "./game-settings.css";
import "./content-preferences.css";

type Dialog = "swipes" | "follows" | "follows-done" | null;

export function ContentPreferencesScreen({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);

  function confirmSwipes() {
    clearRecommendationState();
    setDialog(null);
    navigate(Paths.recommendSwipe);
  }

  function confirmFollows() {
    resetFollowing();
    setDialog("follows-done");
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Content Preferences"
      className="game-settings-page"
    >
      <SubpageHeader
        title="Content Preferences"
        onBack={onBack}
        backLabel="Back to profile"
      />

      <section className="game-settings-section" aria-labelledby="content-resets">
        <h2 id="content-resets" className="game-settings-section-label">
          Resets
        </h2>
        <div className="game-settings-card">
          <button
            type="button"
            className="game-settings-row content-pref-row"
            onClick={() => setDialog("swipes")}
          >
            <span className="game-settings-row-icon" aria-hidden="true">
              <RotateCcw className="size-4" />
            </span>
            <span className="game-settings-row-text">
              <span className="game-settings-row-label">Reset Swipes</span>
            </span>
          </button>
          <button
            type="button"
            className="game-settings-row content-pref-row"
            onClick={() => setDialog("follows")}
          >
            <span className="game-settings-row-icon" aria-hidden="true">
              <Users className="size-4" />
            </span>
            <span className="game-settings-row-text">
              <span className="game-settings-row-label">Reset Follows</span>
            </span>
          </button>
        </div>
      </section>

      {dialog === "swipes" ? (
        <ResetDialog
          title="Reset your Swipes"
          lead="You will reset your preferences for content."
          onContinue={confirmSwipes}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
      {dialog === "follows" ? (
        <ResetDialog
          title="Reset your Follows"
          lead="You will unfollow every creator on this account."
          onContinue={confirmFollows}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
      {dialog === "follows-done" ? (
        <ResetDialog
          title="Follows reset"
          lead="Your following list is empty."
          onDismiss={() => setDialog(null)}
        />
      ) : null}
    </AppPageShell>
  );
}

function ResetDialog({
  title,
  lead,
  onContinue,
  onDismiss,
}: {
  title: string;
  lead: string;
  onContinue?: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onDismiss]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/70 px-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-[28px] border border-white/[0.1] bg-[oklch(0.191_0.01_303.57)] p-6 text-center shadow-[0_24px_60px_oklch(0_0_0_/_0.55)]"
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[oklch(0.767_0.139_91.06)]/15 text-[oklch(0.84_0.14_85)]">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <p className="mt-4 text-body leading-relaxed text-white/70">
          <span className="block text-title text-white/85">{title}</span>
          {lead}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {onContinue ? (
            <div className="h-12 w-full">
              <CtaButton
                {...ctaButtonPropsFromTemplate("squircleCTA")}
                fillParent
                label="Continue"
                costAmount={null}
                onClick={onContinue}
              />
            </div>
          ) : null}
          <button
            type="button"
            className="content-pref-dialog-dismiss"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
