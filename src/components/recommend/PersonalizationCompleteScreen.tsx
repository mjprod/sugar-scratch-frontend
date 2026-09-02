import { Check } from "lucide-react";
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
    <div className="auth7-onboard-panel auth7-onboard-panel--complete">
      <div className="auth7-complete-stack">
        <div className="auth7-complete-mark" aria-hidden="true">
          <Check size={26} strokeWidth={2.6} />
        </div>
        <h1 className="auth7-onboard-title">You&apos;re all set</h1>
        <p className="auth7-onboard-copy">
          We&apos;ll use what you liked to recommend packs and creators that
          match your taste.
        </p>
        <div className="auth2-primary-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Continue to Home"
            costAmount={null}
            fontSize={15}
            strokeWidth={1}
            onClick={onStart}
          />
        </div>
      </div>
    </div>
  );
}
