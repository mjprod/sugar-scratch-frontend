import { useCallback, useEffect, useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ScratchPrototype } from "@/features/game/scratch/ScratchPrototype";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { purgeRouteMemory } from "@/lib/memory/purgeRouteMemory";
import "@/features/game/game.css";
import "@/features/packs/packs.css";

const MODEL = "julianaval";
const CARD = "juliana_1";

export function LpBuildScratch({ onFinish }: { onFinish: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const model = searchParams.get("model")?.trim() || "";
  const card = searchParams.get("card")?.trim() || "";

  useEffect(() => {
    if (model && card && searchParams.get("freeplay") === "1") return;
    const next = new URLSearchParams(searchParams);
    if (!model) next.set("model", MODEL);
    if (!card) next.set("card", CARD);
    next.set("freeplay", "1");
    setSearchParams(next, { replace: true });
  }, [model, card, searchParams, setSearchParams]);

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

  const handleFinish = useCallback(() => {
    // In-page swap to the landing hero — no route change, so MemoryTransition
    // never purges. Unload Safari decoder buffers and arm loseContext before
    // the second page mounts its own pack videos.
    purgeRouteMemory({ from: "game", to: "light" });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onFinish();
      });
    });
  }, [onFinish]);

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
          requireEntryTap
          onLeave={() => {
            window.location.replace(
              `${window.location.pathname}${window.location.search}`,
            );
          }}
          onFinish={handleFinish}
        />
      </div>
    </div>
  );
}
