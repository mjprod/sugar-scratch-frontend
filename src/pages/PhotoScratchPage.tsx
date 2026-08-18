import { useEffect, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhotoScratch } from "@/features/game/scratch/PhotoScratch";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { motionCardIdFromPhotoScratchId } from "@/features/collection/lib/photoSlots";
import { collectionReturnHref } from "@/shared/navigation/collectionReturn";
import { Paths } from "@/routes/Paths";
import "@/features/game/game.css";

export function PhotoScratchPage() {
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

  const card = searchParams.get("card")?.trim();
  const model = searchParams.get("model")?.trim() || "";
  const gameMode = searchParams.get("game") === "1";

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <button
          type="button"
          className="stage-game__exit"
          aria-label={gameMode ? "Back to game" : "Back to collection"}
          onClick={() => {
            if (gameMode) {
              navigate(Paths.game);
              return;
            }
            const motionCardId = card
              ? motionCardIdFromPhotoScratchId(card)
              : "";
            navigate(collectionReturnHref(model, motionCardId));
          }}
        >
          ‹
        </button>
        <PhotoScratch key={card || "default"} />
      </div>
    </div>
  );
}

export default PhotoScratchPage;
