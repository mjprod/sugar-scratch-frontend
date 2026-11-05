import { useEffect, useLayoutEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  MotionCurrencyReveal,
  NOWIN_HERO_LOTTIE_SRC,
} from "@/features/game/modules/MotionCurrencyReveal";
import { loadGameSession } from "@/features/game/modules/gameSession";
import {
  motionNowinPayloadFromPending,
  nextMotionCardId,
  resolveMotionWinExitHref,
  type MotionNowinPayload,
} from "@/features/game/modules/motionWinPage";
import { warmNextMotionCard } from "@/features/game/modules/nextMotionWarm";
import {
  fetchCatalogMotionCards,
  withPreferredVideoQuality,
} from "@/features/game/shared/catalog";
import { releaseClaimedDecoder } from "@/lib/memory/exclusiveMedia";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
import { detachOrphanMedia } from "@/lib/memory/purgeRouteMemory";
import { Paths } from "@/routes/Paths";
import { useMarkPageReady } from "@/shared/ui/usePageReady";
import "@/features/game/game.css";

function isNowinPayload(value: unknown): value is MotionNowinPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as MotionNowinPayload;
  return (
    typeof v.resultId === "string" &&
    typeof v.coins === "number" &&
    typeof v.diamonds === "number" &&
    typeof v.current === "number" &&
    typeof v.total === "number"
  );
}

/**
 * Full-page card no-match — scratch canvas / videos are unmounted so iOS
 * can drop decoders while the next motion card warms off-DOM.
 */
export function GameNowinPage() {
  const location = useLocation();
  const payload = useMemo(() => {
    if (isNowinPayload(location.state)) return location.state;
    return motionNowinPayloadFromPending(loadGameSession()?.pendingMotionResult);
  }, [location.state]);

  useMarkPageReady(Boolean(payload));

  useLayoutEffect(() => {
    detachOrphanMedia();
    releaseClaimedDecoder();
  }, []);

  useEffect(() => {
    if (!payload) return;
    const session = loadGameSession();
    const nextId = session ? nextMotionCardId(session) : null;
    if (!nextId) return;
    void fetchCatalogMotionCards().then((cards) => {
      const raw = cards.find((entry) => entry.id === nextId);
      if (!raw) return;
      return warmNextMotionCard(withPreferredVideoQuality(raw));
    });
  }, [payload]);

  if (!payload) {
    return <Navigate to={Paths.game} replace />;
  }

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <MotionCurrencyReveal
          coins={payload.coins}
          diamonds={0}
          resultId={payload.resultId}
          heroLottieSrc={NOWIN_HERO_LOTTIE_SRC}
          onComplete={() => {
            void resolveMotionWinExitHref(location.search).then((href) => {
              memoryNavigate(href, { replace: true });
            });
          }}
        />
      </div>
    </div>
  );
}

export default GameNowinPage;
