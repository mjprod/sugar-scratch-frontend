import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhotoScratch } from "@/features/game/scratch/PhotoScratch";
import { GameExitConfirmModal } from "@/features/game/GameExitConfirmModal";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { FirstPlayTutorial } from "@/components/game/FirstPlayTutorial";
import { motionCardIdFromPhotoScratchId } from "@/features/collection/lib/photoSlots";
import { collectionReturnHref } from "@/shared/navigation/collectionReturn";
import { Paths } from "@/routes/Paths";
import {
  persistGameProgress,
} from "@/features/game/modules/gameSession";
import "@/features/game/game.css";

export function PhotoScratchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

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

  function leaveGameForCollection() {
    persistGameProgress();
    setExitConfirmOpen(false);
    navigate(Paths.collection);
  }

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <button
          type="button"
          className="stage-game__exit"
          data-tutorial-target="collection"
          aria-label={gameMode ? "Leave game" : "Back to collection"}
          onClick={() => {
            if (gameMode) {
              setExitConfirmOpen(true);
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
        <FirstPlayTutorial scene="foil" />
        <GameExitConfirmModal
          open={exitConfirmOpen}
          copy="Your progress is saved. Continue scratching whenever you're ready."
          onStay={() => setExitConfirmOpen(false)}
          onExit={leaveGameForCollection}
        />
      </div>
    </div>
  );
}

export default PhotoScratchPage;
