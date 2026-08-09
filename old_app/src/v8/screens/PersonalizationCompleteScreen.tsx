import { Button } from "../components/ui";

/**
 * Recommendation Initialization complete — return to Home Feed.
 */
export function PersonalizationCompleteScreen({
  onStart,
}: {
  onStart: () => void;
}) {
  return (
    <div className="auth7-onboard-panel">
      <h1 className="auth7-onboard-title">You&apos;re All Set</h1>
      <p className="auth7-onboard-copy">
        We&apos;ll continue learning what you like.
      </p>
      <div className="auth7-onboard-spacer" />
      <Button
        full
        variant="auth"
        type="button"
        className="auth2-primary"
        onClick={onStart}
      >
        Explore
      </Button>
    </div>
  );
}
