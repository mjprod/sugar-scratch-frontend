import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BonusDiamondSpawner } from "@/features/game/modules/BonusDiamondSpawner";
import { ScratchPrototype } from "@/features/game/scratch/ScratchPrototype";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { Paths } from "@/routes/Paths";
import { markScratchTutorialCompleted } from "@/services/scratchTutorial";
import "@/features/game/game.css";
import "@/features/packs/packs.css";

/** Lab defaults — Juliana motion scratch for iterative UI work. */
const LAB_MODEL = "julianaval";
const LAB_CARD = "juliana_1";

/**
 * Immersive game-UI sandbox at `/game-ui`.
 * Loads the real motion scratch game with Juliana preselected.
 * Production `/game` is unchanged — iterate here step by step.
 * Skips tutorial / intro / center foil bar — opens in docked play UI.
 */
export function GameUiPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /** Bonus diamond stays off until first crossedProgressMilestone. */
  const [bonusDiamondUnlocked, setBonusDiamondUnlocked] = useState(false);
  /** Icons found — lock bonus diamond at 11/12. */
  const [revealedSymbols, setRevealedSymbols] = useState(0);

  const model = searchParams.get("model")?.trim() || "";
  const card = searchParams.get("card")?.trim() || "";

  const unlockBonusDiamond = useCallback(() => {
    setBonusDiamondUnlocked(true);
  }, []);

  const onRevealedSymbolsChange = useCallback((count: number) => {
    setRevealedSymbols(count);
  }, []);

  // Ensure Juliana is selected when the lab is opened bare.
  useEffect(() => {
    if (model && card) return;
    const next = new URLSearchParams(searchParams);
    if (!model) next.set("model", LAB_MODEL);
    if (!card) next.set("card", LAB_CARD);
    setSearchParams(next, { replace: true });
  }, [model, card, searchParams, setSearchParams]);

  // Lab skips first-play tutorial overlays (avoid persisting this outside the lab).
  useEffect(() => {
    let prev: string | null = null;
    try {
      prev = localStorage.getItem("sugar.v8.scratchTutorialCompleted");
    } catch {
      /* ignore */
    }
    markScratchTutorialCompleted();
    return () => {
      try {
        if (prev === null) {
          localStorage.removeItem("sugar.v8.scratchTutorialCompleted");
        } else {
          localStorage.setItem("sugar.v8.scratchTutorialCompleted", prev);
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

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

  function leaveGame() {
    navigate(Paths.home);
  }

  // Wait until query defaults land so ScratchPrototype mounts with model+card.
  if (!model || !card) {
    return (
      <div className="app-shell app-shell--game">
        <div className="stage-game" />
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game">
        <ScratchPrototype
          key={`${model}-${card}`}
          skipToPlay
          onLeave={leaveGame}
          onFirstProgressMilestone={unlockBonusDiamond}
          onRevealedSymbolsChange={onRevealedSymbolsChange}
        />
        {/* Lab-only: after first 10% milestone, until 11/12 icons found. */}
        <BonusDiamondSpawner
          unlocked={bonusDiamondUnlocked}
          revealedSymbols={revealedSymbols}
        />
      </div>
    </div>
  );
}

export default GameUiPage;
