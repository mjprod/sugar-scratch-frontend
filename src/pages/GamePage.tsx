import { useEffect, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GameHub } from "@/features/game/GameHub";
import { ScratchPrototype } from "@/features/game/scratch/ScratchPrototype";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { FirstPlayTutorial } from "@/components/game/FirstPlayTutorial";
import { collectionReturnHref } from "@/shared/navigation/collectionReturn";
import { Paths } from "@/routes/Paths";
import "@/features/game/game.css";
import "@/features/packs/packs.css";

function ScratchGameEmbed() {
  const navigate = useNavigate();
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

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <button
          type="button"
          className="stage-game__exit"
          data-tutorial-target="collection"
          aria-label={
            gameMode
              ? "Back to game"
              : playlistMode
                ? "Back to home"
                : "Back to collection"
          }
          onClick={() => {
            if (gameMode) {
              navigate(Paths.game);
              return;
            }
            if (playlistMode) {
              navigate(Paths.home);
              return;
            }
            navigate(collectionReturnHref(model, card));
          }}
        >
          ‹
        </button>
        <ScratchPrototype />
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
    return <ScratchGameEmbed />;
  }

  return (
    <div className="app-shell app-shell--game-hub">
      <GameHub />
    </div>
  );
}

export default GamePage;
