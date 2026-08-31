import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  memo,
  type AnimationEvent,
  type CSSProperties,
} from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useWallet } from "@/contexts/WalletContext";
import { loadGameSession, markWalletCredited } from "./gameSession";

export const COLLECT_COUNTDOWN_MS = 8000;
const RING_RADIUS = 100;

type PhotoHandSummaryProps = {
  diamondTotal: number;
  onCollect: () => void;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CountdownRing = memo(function CountdownRing({
  gradientId,
  counting,
  credited,
  onDrainComplete,
}: {
  gradientId: string;
  counting: boolean;
  credited: boolean;
  onDrainComplete: () => void;
}) {
  function onProgressAnimationEnd(event: AnimationEvent<SVGCircleElement>) {
    if (event.animationName !== "photo-hand-summary-ring-drain") return;
    onDrainComplete();
  }

  return (
    <svg
      className="photo-hand-summary__ring"
      viewBox="0 0 220 220"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${gradientId}-collect-ring`}
          gradientUnits="userSpaceOnUse"
          x1="110"
          y1="10"
          x2="110"
          y2="210"
        >
          <stop offset="0%" stopColor="#aa085f" />
          <stop offset="52%" stopColor="#e00083" />
          <stop offset="100%" stopColor="#eb6a00" />
        </linearGradient>
      </defs>
      <circle
        className="photo-hand-summary__ring-track"
        cx="110"
        cy="110"
        r={RING_RADIUS}
      />
      <circle
        className={[
          "photo-hand-summary__ring-progress",
          counting ? "is-animating" : "",
          credited ? "is-complete" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        cx="110"
        cy="110"
        r={RING_RADIUS}
        stroke={`url(#${gradientId}-collect-ring)`}
        onAnimationEnd={onProgressAnimationEnd}
      />
    </svg>
  );
});

/** End-of-hand overlay on the photo scratch stage — not a separate hub page. */
export function PhotoHandSummary({
  diamondTotal,
  onCollect,
}: PhotoHandSummaryProps) {
  const { addDiamonds } = useWallet();
  const reducedMotion = prefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const alreadyCredited = loadGameSession()?.walletCredited === true;
  const [credited, setCredited] = useState(alreadyCredited);
  const [counting, setCounting] = useState(!alreadyCredited && !reducedMotion);
  const finishedRef = useRef(false);

  const finishHand = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setCounting(false);
    const session = loadGameSession();
    if (!session?.walletCredited && diamondTotal > 0) {
      addDiamonds(diamondTotal);
    }
    if (!session?.walletCredited) {
      markWalletCredited();
    }
    setCredited(true);
    onCollect();
  }, [addDiamonds, diamondTotal, onCollect]);

  useEffect(() => {
    if (alreadyCredited || finishedRef.current) return;
    if (reducedMotion) {
      const timer = window.setTimeout(finishHand, 1200);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(finishHand, COLLECT_COUNTDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [alreadyCredited, finishHand, reducedMotion]);

  function handleCollect() {
    finishHand();
  }

  return (
    <div
      className="photo-hand-summary"
      role="dialog"
      aria-modal="true"
      aria-label={`Total win. ${diamondTotal} diamonds won.`}
    >
      <div className="photo-hand-summary__backdrop" aria-hidden="true" />
      <div className="photo-hand-summary__content">
        <div className="photo-hand-summary__stack">
          <p className="photo-hand-summary__title">TOTAL WIN</p>
          <div
            className={[
              "photo-hand-summary__reward-wrap",
              counting ? "is-counting" : "",
              credited ? "is-credited" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              {
                "--photo-collect-countdown": `${COLLECT_COUNTDOWN_MS}ms`,
              } as CSSProperties
            }
          >
            <CountdownRing
              gradientId={gradientId}
              counting={counting}
              credited={credited}
              onDrainComplete={finishHand}
            />
            <div className="photo-hand-summary__reward" role="status">
              <div className="photo-hand-summary__icon" aria-hidden="true">
                <DiamondLottie size={72} />
              </div>
              <p className="photo-hand-summary__amount">{diamondTotal}</p>
            </div>
            <p className="sr-only" aria-live="polite">
              {credited
                ? "Diamonds added to your balance."
                : "Tap Collect to claim now. Diamonds are added and you leave automatically when the ring completes."}
            </p>
          </div>
        </div>
      </div>
      <div className="photo-hand-summary__actions">
        <div className="photo-hand-summary__cta-primary">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            type="button"
            label="Collect"
            costAmount={null}
            fontSize={15}
            strokeWidth={1}
            onClick={handleCollect}
          />
        </div>
      </div>
    </div>
  );
}
