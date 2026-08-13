import { useEffect, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhotoScratch } from "@/features/game/scratch/PhotoScratch";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { usePageReady } from "@/shared/ui/PageTransition";
import { Paths } from "@/routes/Paths";
import "@/features/game/game.css";

export function PhotoScratchPage() {
  const { markReady } = usePageReady();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => markReady());
    });
    return () => window.cancelAnimationFrame(raf);
  }, [markReady]);

  const card = searchParams.get("card")?.trim();
  const gameMode = searchParams.get("game") === "1";

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <button
          type="button"
          className="stage-game__exit"
          aria-label={gameMode ? "Back to game" : "Back to collection"}
          onClick={() => navigate(gameMode ? Paths.game : Paths.collection)}
        >
          ‹
        </button>
        <PhotoScratch key={card || "default"} />
      </div>
    </div>
  );
}

export default PhotoScratchPage;
