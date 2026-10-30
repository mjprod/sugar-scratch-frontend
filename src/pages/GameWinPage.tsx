import { useEffect, useLayoutEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { MotionCurrencyReveal } from "@/features/game/modules/MotionCurrencyReveal";
import { loadGameSession } from "@/features/game/modules/gameSession";
import {
  motionWinPayloadFromPending,
  nextMotionCardId,
  resolveMotionWinExitHref,
  type MotionWinPayload,
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

function isWinPayload(value: unknown): value is MotionWinPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as MotionWinPayload;
  return (
    typeof v.resultId === "string" &&
    typeof v.coins === "number" &&
    typeof v.diamonds === "number" &&
    (v.coins > 0 || v.diamonds > 0)
  );
}

/**
 * Full-page currency win — scratch canvas / videos are unmounted.
 * Mount-time detach is a second pass after the memory-veil purge.
 */
export function GameWinPage() {
  const location = useLocation();
  const payload = useMemo(() => {
    if (isWinPayload(location.state)) return location.state;
    return motionWinPayloadFromPending(loadGameSession()?.pendingMotionResult);
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
          diamonds={payload.diamonds}
          resultId={payload.resultId}
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

export default GameWinPage;
