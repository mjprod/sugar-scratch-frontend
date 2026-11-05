import { useCallback, useEffect, useState } from "react";
import {
  MotionCurrencyReveal,
  NOWIN_HERO_LOTTIE_SRC,
} from "@/features/game/modules/MotionCurrencyReveal";
import { openDeferredLotties } from "@/lib/lottie/DeferredLottie";
import { useMarkPageReady } from "@/shared/ui/usePageReady";
import "@/features/game/game.css";

/**
 * Design sandbox for the card no-win / lose result.
 * Production path is `/game/nowin` (wired from motion no-match).
 * Open at `/nowin` — remounts on Next Card so you can keep iterating.
 */
export function NowinPage() {
  const [resultId, setResultId] = useState(() => `nowin-${Date.now()}`);
  useMarkPageReady(true);

  useEffect(() => {
    openDeferredLotties();
  }, []);

  const replay = useCallback(() => {
    setResultId(`nowin-${Date.now()}`);
  }, []);

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <MotionCurrencyReveal
          key={resultId}
          coins={50}
          diamonds={0}
          resultId={resultId}
          heroLottieSrc={NOWIN_HERO_LOTTIE_SRC}
          onComplete={replay}
        />
      </div>
    </div>
  );
}

export default NowinPage;
