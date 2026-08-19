import { ArrowLeft, ArrowRight, Heart, X } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { PREFERENCE_PHOTOS } from "@/lib/photos";

/**
 * Recommendation Initialization entry — teaches swipe mapping before the deck.
 * Instructional only: does not record preference signals.
 */
export function RecommendationIntroScreen({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const sample = PREFERENCE_PHOTOS[0];

  return (
    <div className="auth7-intro-panel">
      <div className="auth7-intro-body">
        <div className="auth7-intro-lead">
          <h1 className="auth7-intro-title">
            Find More Creators
            <br />
            You&apos;ll Love
          </h1>
          <p className="auth7-intro-copy">
            Swipe to personalise your Pack recommendations.
          </p>
        </div>

        <div
          className="auth7-intro-demo"
          aria-label="Swipe left means Not for me. Swipe right means I like this."
        >
          <figure className="auth7-intro-demo-col is-pass">
            <img
              src={sample}
              alt=""
              className="auth7-intro-demo-card auth7-intro-demo-card--left"
            />
            <figcaption className="auth7-intro-dir">
              <span className="auth7-intro-dir-marks" aria-hidden="true">
                <ArrowLeft strokeWidth={2.4} />
                <X strokeWidth={2.6} />
              </span>
              <span className="auth7-intro-dir-label">Not for me</span>
            </figcaption>
          </figure>

          <figure className="auth7-intro-demo-col is-like">
            <img
              src={sample}
              alt=""
              className="auth7-intro-demo-card auth7-intro-demo-card--right"
            />
            <figcaption className="auth7-intro-dir">
              <span className="auth7-intro-dir-marks" aria-hidden="true">
                <Heart fill="currentColor" strokeWidth={0} />
                <ArrowRight strokeWidth={2.4} />
              </span>
              <span className="auth7-intro-dir-label">I like this</span>
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="auth7-intro-actions">
        <div className="auth2-primary-cta auth7-intro-start">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Start"
            costAmount={null}
            fontSize={15}
            strokeWidth={1}
            onClick={onStart}
          />
        </div>
        <button type="button" className="auth7-intro-skip" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}
