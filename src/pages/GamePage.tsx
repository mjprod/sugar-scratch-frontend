import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ScratchPrototype } from "@/features/game/scratch/ScratchPrototype";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { FirstPlayTutorial } from "@/components/game/FirstPlayTutorial";
import { collectionReturnHref } from "@/shared/navigation/collectionReturn";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
import { Paths } from "@/routes/Paths";
import {
  persistGameProgress,
} from "@/features/game/modules/gameSession";
import { RouteChunkFallback } from "@/routes/RouteChunkFallback";
import "@/features/game/game.css";

/** Pack-fan hub — keep off the scratch embed graph (reveal/CardFan/Lottie fan). */
const GameHub = lazy(() =>
  import("@/features/game/GameHub").then((m) => ({ default: m.GameHub })),
);

function ScratchGameEmbed() {
  const [searchParams] = useSearchParams();

  // Mark embed before ScratchPrototype mounts so zoom stays off on first paint.
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    if (document.documentElement.dataset.scratchGame !== "1") {
      document.documentElement.dataset.scratchGame = "1";
    }
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-scratch-game", "1");
    style.textContent = scratchCss;
    document.head.appendChild(style);
    document.documentElement.dataset.scratchGame = "1";
    return () => {
      style.remove();
      delete document.documentElement.dataset.scratchGame;
    };
  }, [scratchCss]);

  const gameMode = searchParams.get("game") === "1";
  const playlistMode = searchParams.get("playlist") === "1";
  const model = searchParams.get("model")?.trim() || "";
  const card = searchParams.get("card")?.trim() || "";
  const creator = searchParams.get("creator")?.trim() || "";

  // Leave from the pause overlay — progress is saved, so no second confirm.
  function leaveGame() {
    if (gameMode) {
      persistGameProgress();
      memoryNavigate(
        collectionReturnHref({
          creatorId: creator,
          modelId: model,
          cardId: card,
        }),
      );
      return;
    }
    if (playlistMode) {
      memoryNavigate(Paths.home);
      return;
    }
    memoryNavigate(
      collectionReturnHref({
        creatorId: creator,
        modelId: model,
        cardId: card,
      }),
    );
  }

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <ScratchPrototype onLeave={leaveGame} />
        <FirstPlayTutorial scene="foil" />
      </div>
    </div>
  );
}

export function GamePage() {
  const [searchParams] = useSearchParams();
  const model = searchParams.get("model")?.trim();
  const card = searchParams.get("card")?.trim();

  // Bare /game → pack-fan hub. model+card → scratch (collection or ?game=1 hand).
  if (model && card) {
    return (
      <ScratchGameEmbed
        key={`${model}-${card}-${searchParams.get("game") ?? ""}`}
      />
    );
  }

  return (
    <Suspense fallback={<RouteChunkFallback />}>
      <div className="app-shell app-shell--game-hub">
        <GameHub />
      </div>
    </Suspense>
  );
}

export default GamePage;
