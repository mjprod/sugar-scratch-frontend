import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScratchPrototype } from "@/features/game/scratch/ScratchPrototype";
import scratchCss from "@/features/game/scratch/styles.css?inline";
import { fetchCatalogMotionCards } from "@/features/game/shared/catalog";
import { purgeRouteMemory } from "@/lib/memory/purgeRouteMemory";
import { LP_MODEL_PARAM, pickLandingPlayCard } from "@/pages/lp-build/lpModel";
import "@/features/game/game.css";
import "@/features/packs/packs.css";

const MODEL = "julianaval";
const CARD = "juliana_1";

export function LpBuildScratch({ onFinish }: { onFinish: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const owner =
    searchParams.get(LP_MODEL_PARAM)?.trim() ||
    searchParams.get("model")?.trim() ||
    "";
  const card = searchParams.get("card")?.trim() || "";
  const [playCard, setPlayCard] = useState("");

  useEffect(() => {
    if (owner) return;
    if (card && searchParams.get("freeplay") === "1" && searchParams.get("model")) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (!next.get("model")) next.set("model", MODEL);
    if (!card) next.set("card", CARD);
    next.set("freeplay", "1");
    setSearchParams(next, { replace: true });
  }, [card, owner, searchParams, setSearchParams]);

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    void fetchCatalogMotionCards()
      .then((cards) => {
        if (cancelled) return;
        const pick = pickLandingPlayCard(cards, owner, card);
        const next = new URLSearchParams(window.location.search);
        next.set(LP_MODEL_PARAM, owner);
        next.set("freeplay", "1");
        next.set("card", pick);
        if (!next.get("model")) next.set("model", owner);
        setSearchParams(next, { replace: true });
        setPlayCard(pick);
      })
      .catch(() => {
        if (cancelled) return;
        const next = new URLSearchParams(window.location.search);
        next.set(LP_MODEL_PARAM, owner);
        next.set("freeplay", "1");
        next.set("card", CARD);
        if (!next.get("model")) next.set("model", owner);
        setSearchParams(next, { replace: true });
        setPlayCard(CARD);
      });
    return () => {
      cancelled = true;
    };
    // Roll once per influencer. A later card param is the pick we just wrote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

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

  // ScratchPrototype reads freeplay on its first render, and its effects run
  // before the ones above. Mount only once freeplay, model, and the settled
  // card are already in the URL, or a signed-in visitor starts a paid hand.
  const scratchModel = searchParams.get("model")?.trim() || "";
  const freePlayReady = searchParams.get("freeplay") === "1";
  const scratchCard = playCard || (owner ? "" : card);
  if (
    !freePlayReady ||
    !scratchModel ||
    !scratchCard ||
    (owner && playCard !== card)
  ) {
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
          key={`${scratchModel}-${scratchCard}`}
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
