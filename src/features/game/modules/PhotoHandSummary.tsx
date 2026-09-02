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
import { loadGameSession, settleDonePhotoHand } from "./gameSession";
import { PackNoMatchResult } from "./PackNoMatchResult";

export const COLLECT_COUNTDOWN_MS = 8000;
const RING_RADIUS = 100;
/** No ring to watch when nothing was won — just long enough to read the result. */
const NO_MATCH_HOLD_MS = 4500;

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
  const noDiamonds = diamondTotal <= 0;
  const reducedMotion = prefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const walletAlreadyCreditedRef = useRef(
    loadGameSession()?.walletCredited === true,
  );
  const [credited, setCredited] = useState(walletAlreadyCreditedRef.current);
  const [counting, setCounting] = useState(
    !walletAlreadyCreditedRef.current && !reducedMotion,
  );
  const finishedRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const onCollectRef = useRef(onCollect);
  onCollectRef.current = onCollect;
  const addDiamondsRef = useRef(addDiamonds);
  addDiamondsRef.current = addDiamonds;

  const finishHand = useCallback(
    (opts?: { navigate?: boolean }) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setCounting(false);
      settleDonePhotoHand(addDiamondsRef.current);
      setCredited(true);
      if (opts?.navigate !== false) {
        onCollectRef.current();
      }
    },
    // Stable: callbacks live on refs so the 8s timer does not restart on parent re-render.
    [],
  );

  // Always auto-leave when the ring finishes — even if wallet was credited on reload.
  useEffect(() => {
    if (finishedRef.current) return;
    // The no-match beat ignores the credited shortcut: a 600ms exit would cut
    // off its own entry animation.
    const delayMs = noDiamonds
      ? reducedMotion
        ? 2500
        : NO_MATCH_HOLD_MS
      : walletAlreadyCreditedRef.current
        ? 600
        : reducedMotion
          ? 1200
          : COLLECT_COUNTDOWN_MS;
    const timer = window.setTimeout(() => finishHand(), delayMs);
    return () => window.clearTimeout(timer);
  }, [finishHand, noDiamonds, reducedMotion]);

  // Shell ‹ exit / route change unmounts this overlay — still settle rewards.
  useEffect(() => {
    return () => {
      if (finishedRef.current) return;
      // ponytail: ignore Strict Mode's instant remount — settle only on real unmount.
      if (Date.now() - mountedAtRef.current < 250) return;
      finishedRef.current = true;
      settleDonePhotoHand(addDiamondsRef.current);
    };
  }, []);

  return (
    <div
      className="photo-hand-summary"
      role="dialog"
      aria-modal="true"
      aria-label={
        noDiamonds
          ? "Pack complete. No diamonds were won this pack."
          : `Total win. ${diamondTotal} diamonds won.`
      }
    >
      <div className="photo-hand-summary__backdrop" aria-hidden="true" />
      <div className="photo-hand-summary__content">
        {noDiamonds ? (
          <PackNoMatchResult subtitle="No diamonds this pack." />
        ) : (
        <div className="photo-hand-summary__stack">
          <p className="photo-hand-summary__title">PACK COMPLETE</p>
          <p className="photo-hand-summary__subtitle">
            {diamondTotal} Diamond{diamondTotal === 1 ? "" : "s"} Earned
          </p>
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
              onDrainComplete={() => finishHand()}
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
                : "Tap Continue to claim now. Diamonds are added and you leave automatically when the ring completes."}
            </p>
          </div>
        </div>
        )}
      </div>
      <div className="photo-hand-summary__actions">
        <div className="photo-hand-summary__cta-primary">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            type="button"
            label={noDiamonds ? "Done" : "Continue"}
            costAmount={null}
            fontSize={15}
            strokeWidth={1}
            onClick={() => finishHand()}
          />
        </div>
      </div>
    </div>
  );
}
