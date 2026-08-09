/**
 * Recommendation Initialization entry — discovery framing, not setup wizard.
 * Only shown after EvaluateRecommendationEligibility() returns launch.
 */
export function RecommendationIntroScreen({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="auth7-onboard-panel">
      <h1 className="auth7-onboard-title">Find More Creators You&apos;ll Love</h1>
      <p className="auth7-onboard-copy">
        Swipe through a few Creator collections. We&apos;ll use your choices to
        recommend better Packs.
      </p>
      <div className="auth7-onboard-spacer" />
      <button
        type="button"
        className="auth2-primary auth7-persona-prompt-start"
        style={{ width: "100%", minHeight: 48, borderRadius: 14 }}
        onClick={onStart}
      >
        Start
      </button>
      <button
        type="button"
        className="auth7-persona-prompt-later"
        style={{
          width: "100%",
          marginTop: 12,
          minHeight: 44,
          background: "transparent",
          border: "none",
        }}
        onClick={onSkip}
      >
        Skip
      </button>
    </div>
  );
}
