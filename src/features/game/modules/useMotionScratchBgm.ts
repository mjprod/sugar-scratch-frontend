import { useEffect } from "react";
import { TOP_BAR_DOCK_MS } from "./InitialCountdown";
import {
  preloadMotionScratchBgm,
  setMotionScratchBgmBed,
  setMotionScratchBgmFull,
  stopMotionScratchBgm,
} from "./motionScratchBgm";
import { resolveMotionScratchBgmPlan } from "./motionScratchBgmPolicy";
import type { TopBarPhase } from "./TopSymbolBar";

/**
 * Drives the motion-scratch BGM from stage state (see
 * `resolveMotionScratchBgmPlan`). Stops without a fade on unmount.
 *
 * Only a warm → cold change fades the loop out; center → docked must not stop
 * it, so the stop lives in the plan, not in the effect cleanup.
 */
export function useMotionScratchBgm({
  warm,
  topBarPhase,
  skipToPlay = false,
}: {
  warm: boolean;
  topBarPhase: TopBarPhase;
  skipToPlay?: boolean;
}) {
  useEffect(() => {
    const plan = resolveMotionScratchBgmPlan({
      warm,
      topBarPhase,
      skipToPlay,
      dockMs: TOP_BAR_DOCK_MS,
    });
    if (plan.level === "off") {
      stopMotionScratchBgm();
      return;
    }
    preloadMotionScratchBgm();
    if (plan.level === "full") {
      setMotionScratchBgmFull();
      return;
    }
    if (plan.level !== "bed") return;
    setMotionScratchBgmBed();
    if (plan.fullAfterMs == null) return;
    const id = window.setTimeout(setMotionScratchBgmFull, plan.fullAfterMs);
    return () => window.clearTimeout(id);
  }, [warm, topBarPhase, skipToPlay]);

  useEffect(() => () => stopMotionScratchBgm({ fadeOutMs: 0 }), []);
}
