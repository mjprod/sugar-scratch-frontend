import { useEffect, useRef, useState } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";
import { lottieRenderConfig } from "@/utils/lottieRender";

/** Assets live in public/lottie (singular) — /lotties/* falls through to SPA HTML. */
const CARD_COUNTDOWN_LOTTIE_SRC = "/lottie/lottieCardCountdown.lottie";
const CARD_LOTTIE_SIZE = 28;
/** Keep in sync with `.pack-progress` `--pp-lottie-scale` in scratch/styles.css.
 *  CSS transform enlarges the canvas after paint — boost DPR so the vector stays crisp. */
const CARD_LOTTIE_CSS_SCALE = 1.75;

type PackProgressProps = {
  current: number;
  total: number;
};

/** Compact pack-progress pill — status-row HUD. Card lottie plays on new card. */
export function PackProgress({ current, total }: PackProgressProps) {
  // Remount DotLottie only when the card index advances so idle mounts stay still.
  const [playKey, setPlayKey] = useState(0);
  const prevCurrentRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevCurrentRef.current;
    prevCurrentRef.current = current;
    // First paint: show static first frame. Later card bumps: remount + play.
    if (prev != null && current !== prev) {
      setPlayKey((n) => n + 1);
    }
  }, [current]);

  if (total <= 0 || current < 1 || current > total) return null;
  const remaining = total - current;
  const isFinal = remaining === 0;
  // playKey > 0 means a card transition already happened this mount.
  const shouldPlay = playKey > 0;

  return (
    <div
      className={["pack-progress", isFinal ? "is-final" : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label={
        isFinal
          ? `Final card, card ${current} of ${total}`
          : `${remaining} left, card ${current} of ${total}`
      }
    >
      <span className="pack-progress__icon" aria-hidden="true">
        <DotLottieReact
          key={`card-countdown-${playKey}`}
          // Absolute URL — relative paths can fail inside the lottie worker.
          src={
            typeof window !== "undefined"
              ? new URL(CARD_COUNTDOWN_LOTTIE_SRC, window.location.href).href
              : CARD_COUNTDOWN_LOTTIE_SRC
          }
          autoplay={shouldPlay}
          loop={false}
          width={CARD_LOTTIE_SIZE}
          height={CARD_LOTTIE_SIZE}
          className="pack-progress__lottie"
          renderConfig={lottieRenderConfig({
            extraScale: CARD_LOTTIE_CSS_SCALE,
            autoResize: false,
          })}
          dotLottieRefCallback={(instance: DotLottie | null) => {
            if (!instance) return;
            const paintFirstFrame = () => {
              try {
                // stop() renders frame 0 — needed so idle icons aren't blank.
                void instance.stop();
                if (!shouldPlay) instance.pause();
              } catch {
                /* player may not be ready yet */
              }
            };
            instance.addEventListener("load", paintFirstFrame);
            paintFirstFrame();
          }}
        />
      </span>
      <div className="pack-progress__copy">
        <p className="pack-progress__remain">
          {isFinal ? "FINAL CARD" : `${remaining} Left`}
        </p>
        <p className="pack-progress__pos">
          Card {current} of {total}
        </p>
      </div>
    </div>
  );
}
