import { useEffect, useState } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";
import "@/lib/lottie/setupWasm";
import { openDeferredLotties } from "@/lib/lottie/DeferredLottie";
import { lottieRenderConfig } from "@/utils/lottieRender";

/** Cache-bust: restore rotation anim + patched precomp w/h. */
const AUTO_SCRATCH_LOTTIE_SRC = "/lottie/autoScratchButton.lottie?v=6";
/** Near-edge fill inside the 48×48 HUD chip (1px stroke still clears). */
const ICON_SIZE = 44;

/** Lottie mark for the top-right AutoScratch HUD button. */
export function AutoScratchHudIcon() {
  const [player, setPlayer] = useState<DotLottie | null>(null);

  useEffect(() => {
    openDeferredLotties();
  }, []);

  useEffect(() => {
    if (!player) return;

    const kick = () => {
      try {
        player.setLoop(true);
        if (!player.isPlaying) player.play();
      } catch {
        /* player torn down */
      }
    };

    player.addEventListener("load", kick);
    player.addEventListener("stop", kick);
    player.addEventListener("complete", kick);
    if (player.isLoaded) kick();

    return () => {
      player.removeEventListener("load", kick);
      player.removeEventListener("stop", kick);
      player.removeEventListener("complete", kick);
    };
  }, [player]);

  return (
    <span className="stage-game__auto-scratch-a-lottie" aria-hidden="true">
      <DotLottieReact
        src={
          typeof window !== "undefined"
            ? new URL(AUTO_SCRATCH_LOTTIE_SRC, window.location.href).href
            : AUTO_SCRATCH_LOTTIE_SRC
        }
        autoplay
        loop
        width={ICON_SIZE}
        height={ICON_SIZE}
        renderConfig={lottieRenderConfig({
          extraScale: 1,
          autoResize: false,
          freezeOnOffscreen: false,
        })}
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          pointerEvents: "none",
        }}
        dotLottieRefCallback={(instance) => {
          setPlayer(instance);
        }}
      />
    </span>
  );
}
