import { useEffect, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhotoScratch } from "@/features/game/scratch/PhotoScratch";
import { GamePauseButton } from "@/features/game/GamePauseButton";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { FirstPlayTutorial } from "@/components/game/FirstPlayTutorial";
import { motionCardIdFromPhotoScratchId } from "@/features/collection/lib/photoSlots";
import { collectionReturnHref } from "@/shared/navigation/collectionReturn";
import { Paths } from "@/routes/Paths";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  loadGameSession,
  persistGameProgress,
  settleDonePhotoHand,
} from "@/features/game/modules/gameSession";
import "@/features/game/game.css";

export function PhotoScratchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addDiamonds } = useWallet();
  const { bumpInventoryRevision } = useAuth();

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

  // Leave from the pause overlay — progress is saved, so no second confirm.
  function leaveGame() {
    if (!gameMode) {
      const motionCardId = card ? motionCardIdFromPhotoScratchId(card) : "";
      navigate(collectionReturnHref(model, motionCardId));
      return;
    }
    const session = loadGameSession();
    // TOTAL WIN / last-card overlay: settle credit + collection before leaving.
    if (
      session?.phase === "done" ||
      (session?.phase === "photo" &&
        session.wonPhotoIds.length > 0 &&
        session.wonPhotoIds.every((id) =>
          session.completedPhotoIds.includes(id),
        ))
    ) {
      settleDonePhotoHand(addDiamonds);
      bumpInventoryRevision();
    } else {
      persistGameProgress();
    }
    navigate(Paths.collection);
  }

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <GamePauseButton onLeave={leaveGame} />
        <PhotoScratch key={card || "default"} />
        <FirstPlayTutorial scene="foil" />
      </div>
    </div>
  );
}

export default PhotoScratchPage;
