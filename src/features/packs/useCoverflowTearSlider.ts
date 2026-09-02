import { useEffect, useRef, useState } from "react";
import {
  getCardTopDebug,
  setCardTopDebug,
  setCardTopTearT,
  setPackOpenRequested,
  setSelectedTearKeyId,
  subscribeCardTopDebug,
  type CardTopDebugState,
} from "@/features/packs/cardTopDebug";
import {
  CARD_TOP_TEAR_FINISH_MS,
  cardTopTearSliderEndT,
  cardTopTearSpinStartT,
  loadCardTopTearTimeline,
  sampleCardTopTear,
  saveCardTopTearTimeline,
  sliderPercentFromTearT,
  tearTFromSliderPercent,
  type CardTopTearPose,
  type CardTopTearTimeline,
} from "@/features/packs/cardTopTearTimeline";

export function useCoverflowTearSlider() {
  const [debug, setDebug] = useState<CardTopDebugState>(getCardTopDebug);
  const [timeline, setTimeline] = useState<CardTopTearTimeline>(
    loadCardTopTearTimeline,
  );
  const [finishing, setFinishing] = useState(false);
  const [closing, setClosing] = useState(false);
  const finishStartedRef = useRef(false);
  const sliderEndT = cardTopTearSliderEndT(timeline);
  const sliderPercent = sliderPercentFromTearT(debug.tearT, timeline);

  useEffect(() => subscribeCardTopDebug(setDebug), []);

  function applyPoseToPack(pose: CardTopTearPose, extra?: Partial<CardTopDebugState>) {
    setCardTopDebug({
      ...extra,
      position: { x: pose.x, y: pose.y, z: pose.z },
      rotation: { x: pose.rotX, y: pose.rotY, z: pose.rotZ },
      scale: { x: pose.scaleX, y: pose.scaleY, z: pose.scaleZ },
      opacity: pose.opacity,
    });
  }

  function persistTimeline(next: CardTopTearTimeline, pose?: CardTopTearPose) {
    saveCardTopTearTimeline(next);
    setTimeline(next);
    if (pose) applyPoseToPack(pose);
  }

  function applyTearT(tearT: number, playing = false) {
    const pose = sampleCardTopTear(timeline, tearT);
    setSelectedTearKeyId(null);
    setCardTopTearT(tearT, playing);
    applyPoseToPack(pose);
    setPackOpenRequested(tearT >= cardTopTearSpinStartT(timeline) - 0.001);
  }

  function startFinish() {
    finishStartedRef.current = true;
    setClosing(false);
    setFinishing(true);
    applyTearT(sliderEndT, true);
  }

  function startClose() {
    if (closing || finishing || debug.tearT <= 0.001) return;
    finishStartedRef.current = false;
    setFinishing(false);
    setClosing(true);
    applyTearT(debug.tearT, true);
  }

  function replayTear() {
    finishStartedRef.current = false;
    setFinishing(false);
    setClosing(false);
    applyTearT(0, false);
  }

  function scrubSlider(percent: number, options?: { snapClosed?: boolean }) {
    finishStartedRef.current = false;
    setFinishing(false);
    setClosing(false);
    const nextPercent = Math.min(100, Math.max(0, percent));
    applyTearT(tearTFromSliderPercent(nextPercent, timeline), false);
    if (nextPercent >= 100) startFinish();
    else if (options?.snapClosed) startClose();
  }

  useEffect(() => {
    if (!debug.tearPlaying && !finishing && !closing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const state = getCardTopDebug();
      if (!state.tearPlaying && !finishing && !closing) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (closing) {
        const next = state.tearT - dt / 0.28;
        if (next <= 0) {
          applyTearT(0, false);
          setClosing(false);
          return;
        }
        applyTearT(next, true);
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const duration = finishing
        ? CARD_TOP_TEAR_FINISH_MS
        : CARD_TOP_TEAR_FINISH_MS + sliderEndT * 1000;
      const span = finishing ? 1 - sliderEndT : sliderEndT;
      const next = state.tearT + (dt / (duration / 1000)) * span;
      const cap = finishing ? 1 : sliderEndT;
      if (next >= cap) {
        applyTearT(cap, false);
        if (finishing) setFinishing(false);
        return;
      }
      applyTearT(next, true);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [closing, debug.tearPlaying, finishing, sliderEndT, timeline]);

  return {
    debug,
    timeline,
    finishing,
    finishStartedRef,
    sliderEndT,
    sliderPercent,
    applyPoseToPack,
    persistTimeline,
    applyTearT,
    startFinish,
    scrubSlider,
    replayTear,
    setFinishing,
  };
}
