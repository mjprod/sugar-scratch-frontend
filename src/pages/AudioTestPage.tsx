import { useEffect, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScratchPrototype } from "@/features/game/scratch/ScratchPrototype";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { Paths } from "@/routes/Paths";
import "@/features/game/game.css";

/** Same card the game-ui lab uses, so the route works with no query. */
const LAB_MODEL = "julianaval";
const LAB_CARD = "juliana_1";

/**
 * /audio-test — real scratch card that restarts from the theme intro after
 * each finish, so the sound mix can be tuned without leaving the page.
 */
export function AudioTestPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const model = searchParams.get("model")?.trim() || "";
  const card = searchParams.get("card")?.trim() || "";

  useEffect(() => {
    if (model && card) return;
    const next = new URLSearchParams(searchParams);
    if (!model) next.set("model", LAB_MODEL);
    if (!card) next.set("card", LAB_CARD);
    setSearchParams(next, { replace: true });
  }, [model, card, searchParams, setSearchParams]);

  useLayoutEffect(() => {
    document.documentElement.dataset.scratchGame = "1";
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
  }, []);

  if (!model || !card) return null;

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <ScratchPrototype
          key={`${model}-${card}`}
          loopFromIntro
          onLeave={() => navigate(Paths.home)}
        />
      </div>
    </div>
  );
}

export default AudioTestPage;
