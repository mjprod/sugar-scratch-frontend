import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useMemo, useState } from "react";
import { Button } from "../components/ui";
import {
  MIN_PERSONALIZATION_CARDS,
  orderedRecommendationCards,
} from "../flow/recommendation";
import { PREFERENCE_PHOTOS } from "../flow/photos";

/**
 * Tinder-style Creator × Theme Recommendation Initialization.
 * Skip is always available; Continue after a short configurable sequence.
 */
export function PersonalizationSwipeScreen({
  onContinue,
  onSkip,
}: {
  onContinue: (result: { liked: string[]; passed: string[] }) => void;
  onSkip: (result: { liked: string[]; passed: string[] }) => void;
}) {
  const deck = useMemo(() => orderedRecommendationCards(), []);
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const decisions = liked.length + passed.length;
  const canContinue = decisions >= MIN_PERSONALIZATION_CARDS;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-160, 160], [-12, 12]);
  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -40], [1, 0]);

  const card = deck[index];
  const exhausted = index >= deck.length;

  function decide(kind: "like" | "pass") {
    const current = deck[index];
    if (!current) return;
    const nextLiked = kind === "like" ? [...liked, current.id] : liked;
    const nextPassed = kind === "pass" ? [...passed, current.id] : passed;
    setLiked(nextLiked);
    setPassed(nextPassed);
    setIndex((i) => i + 1);
    x.set(0);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 100) decide("like");
    else if (info.offset.x < -100) decide("pass");
  }

  return (
    <div className="auth7-swipe">
      <div className="auth7-swipe-top">
        <button
          type="button"
          className="auth7-swipe-back"
          onClick={() => onSkip({ liked, passed })}
        >
          Skip
        </button>
        <p className="auth7-swipe-progress" aria-live="polite">
          {Math.min(decisions, MIN_PERSONALIZATION_CARDS)} /{" "}
          {MIN_PERSONALIZATION_CARDS}
        </p>
      </div>

      <div className="auth7-swipe-bar" aria-hidden="true">
        <div
          className="auth7-swipe-bar-fill"
          style={{
            transform: `scaleX(${Math.min(1, decisions / MIN_PERSONALIZATION_CARDS)})`,
          }}
        />
      </div>

      <div className="auth7-swipe-stage">
        <AnimatePresence mode="wait">
          {card && !exhausted ? (
            <motion.div
              key={card.id}
              style={{ x, rotate }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={onDragEnd}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="auth7-swipe-card"
            >
              <img
                src={PREFERENCE_PHOTOS[index % PREFERENCE_PHOTOS.length]}
                alt=""
                className="auth7-swipe-media"
                draggable={false}
              />
              <div className="auth7-swipe-shade" aria-hidden="true" />
              <motion.span
                style={{ opacity: likeOpacity }}
                className="auth7-swipe-stamp is-like"
              >
                Interested
              </motion.span>
              <motion.span
                style={{ opacity: passOpacity }}
                className="auth7-swipe-stamp is-pass"
              >
                Not For Me
              </motion.span>
              <div className="auth7-swipe-meta">
                <p className="auth7-swipe-theme">{card.theme}</p>
                <h2 className="auth7-swipe-name">{card.name}</h2>
                <p className="auth7-swipe-tagline">{card.tagline}</p>
              </div>
            </motion.div>
          ) : (
            <p className="auth7-swipe-empty">
              Nice picks. Continue when you&apos;re ready.
            </p>
          )}
        </AnimatePresence>
      </div>

      <div className="auth7-swipe-controls">
        <div className="auth7-swipe-control">
          <button
            type="button"
            className="auth7-swipe-btn is-pass"
            aria-label="Not for me"
            disabled={!card}
            onClick={() => decide("pass")}
          >
            ✕
          </button>
          <span className="auth7-swipe-control-label">Not For Me</span>
        </div>
        <div className="auth7-swipe-control">
          <button
            type="button"
            className="auth7-swipe-btn is-like"
            aria-label="Interested"
            disabled={!card}
            onClick={() => decide("like")}
          >
            ♥
          </button>
          <span className="auth7-swipe-control-label">Interested</span>
        </div>
      </div>

      {canContinue || exhausted ? (
        <Button
          full
          variant="auth"
          type="button"
          className="auth2-primary"
          onClick={() => onContinue({ liked, passed })}
        >
          Continue
        </Button>
      ) : (
        <p className="auth7-swipe-hint">
          Keep swiping — or Skip anytime
        </p>
      )}
    </div>
  );
}
