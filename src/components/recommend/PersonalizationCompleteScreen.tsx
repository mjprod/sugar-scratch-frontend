import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

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
      <div className="auth2-primary-cta">
        <CtaButton
          {...ctaButtonPropsFromTemplate("squircleCTA")}
          fillParent
          label="Explore"
          costAmount={null}
          fontSize={15}
          strokeWidth={1}
          onClick={onStart}
        />
      </div>
    </div>
  );
}
