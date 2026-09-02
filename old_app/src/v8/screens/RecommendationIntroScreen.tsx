import { ArrowLeft, ArrowRight, Heart, X } from "lucide-react";
import { PREFERENCE_PHOTOS } from "../flow/photos";

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
      <h1 className="auth7-intro-title">
        Find More Creators
        <br />
        You&apos;ll Love
      </h1>
      <p className="auth7-intro-copy">
        Swipe through a few Creator collections. We&apos;ll use your choices to
        recommend better Packs.
      </p>

      <div
        className="auth7-intro-demo"
        aria-label="Swipe left means Not for me. Swipe right means I like this."
      >
        {/* Mobile / narrow: one card + directional labels */}
        <div className="auth7-intro-demo-mobile" aria-hidden="true">
          <img
            src={sample}
            alt=""
            className="auth7-intro-demo-card auth7-intro-demo-card--center"
          />
          <div className="auth7-intro-demo-row">
            <SwipeDirection
              side="left"
              title="Swipe Left"
              subtitle="Not for me"
            />
            <SwipeDirection
              side="right"
              title="Swipe Right"
              subtitle="I like this"
            />
          </div>
        </div>

        {/* Desktop: two tilted card states */}
        <div className="auth7-intro-demo-desktop" aria-hidden="true">
          <figure className="auth7-intro-demo-col is-pass">
            <span className="auth7-intro-demo-arrow" aria-hidden="true">
              <ArrowLeft className="size-5" strokeWidth={2.4} />
            </span>
            <img
              src={sample}
              alt=""
              className="auth7-intro-demo-card auth7-intro-demo-card--left"
            />
            <span className="auth7-intro-demo-badge is-pass">
              <X className="size-5" strokeWidth={2.6} />
            </span>
            <figcaption className="auth7-intro-dir-text">
              <strong>Swipe Left</strong>
              <span>Not for me</span>
            </figcaption>
          </figure>

          <figure className="auth7-intro-demo-col is-like">
            <span className="auth7-intro-demo-arrow" aria-hidden="true">
              <ArrowRight className="size-5" strokeWidth={2.4} />
            </span>
            <img
              src={sample}
              alt=""
              className="auth7-intro-demo-card auth7-intro-demo-card--right"
            />
            <span className="auth7-intro-demo-badge is-like">
              <Heart className="size-5" fill="currentColor" strokeWidth={0} />
            </span>
            <figcaption className="auth7-intro-dir-text">
              <strong>Swipe Right</strong>
              <span>I like this</span>
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="auth7-intro-actions">
        <button
          type="button"
          className="auth2-primary auth7-intro-start"
          onClick={onStart}
        >
          Start
        </button>
        <button type="button" className="auth7-intro-skip" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

function SwipeDirection({
  side,
  title,
  subtitle,
}: {
  side: "left" | "right";
  title: string;
  subtitle: string;
}) {
  const isLike = side === "right";
  return (
    <div className={`auth7-intro-dir ${isLike ? "is-like" : "is-pass"}`}>
      <span className="auth7-intro-demo-arrow" aria-hidden="true">
        {isLike ? (
          <ArrowRight className="size-4" strokeWidth={2.4} />
        ) : (
          <ArrowLeft className="size-4" strokeWidth={2.4} />
        )}
      </span>
      <span className={`auth7-intro-demo-badge ${isLike ? "is-like" : "is-pass"}`}>
        {isLike ? (
          <Heart className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <X className="size-4" strokeWidth={2.6} />
        )}
      </span>
      <p className="auth7-intro-dir-text">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </p>
    </div>
  );
}
