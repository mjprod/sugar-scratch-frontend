import { useEffect, useRef, useState } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";
import { lottieRenderConfig } from "@/utils/lottieRender";

const CARD_COUNTDOWN_LOTTIE_SRC = "/lotties/lottieCardCountdown.lottie";
const CARD_LOTTIE_SIZE = 28;

type PackProgressProps = {
  current: number;
  total: number;
};

/** Compact pack-progress pill — status-row HUD. Card lottie plays on new card. */
export function PackProgress({ current, total }: PackProgressProps) {
  // Remount DotLottie only when the card index advances so intro mounts stay still.
  const [playKey, setPlayKey] = useState(0);
  const prevCurrentRef = useRef<number | null>(null);
  const playerRef = useRef<DotLottie | null>(null);

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
          src={CARD_COUNTDOWN_LOTTIE_SRC}
          autoplay={shouldPlay}
          loop={false}
          width={CARD_LOTTIE_SIZE}
          height={CARD_LOTTIE_SIZE}
          className="pack-progress__lottie"
          renderConfig={lottieRenderConfig({ extraScale: 1.25 })}
          dotLottieRefCallback={(instance) => {
            playerRef.current = instance;
            if (!instance) return;
            // Idle mount: force frame 0 so the icon isn't blank before play.
            if (!shouldPlay) {
              try {
                instance.setFrame(0);
                instance.pause();
              } catch {
                /* player may not be ready yet */
              }
              const onLoad = () => {
                try {
                  instance.setFrame(0);
                  instance.pause();
                } catch {
                  /* ignore */
                }
              };
              instance.addEventListener("load", onLoad);
              // If already loaded, paint immediately.
              onLoad();
            }
          }}
        />
      </span>
      <div className="pack-progress__copy">
        <p className="pack-progress__remain">
          {isFinal ? "FINAL CARD" : `${remaining} LEFT`}
        </p>
        <p className="pack-progress__pos">
          Card {current} of {total}
        </p>
      </div>
    </div>
  );
}
