import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CREATOR_TUTORIAL_STEP,
  FOIL_TUTORIAL_STEPS,
  isScratchTutorialCompleted,
  markScratchTutorialCompleted,
  TEAR_TUTORIAL_STEP,
  type TutorialScene,
} from "@/services/scratchTutorial";
import "./first-play-tutorial.css";

type Hole = { top: number; left: number; width: number; height: number };
type FoilPhase = "explain" | "foil" | "wait" | "creator";

const PAD = 8;

function findFoil() {
  return document.querySelector(
    '.top-symbol-bar.is-phase-center, [data-tutorial-target="foil"]',
  );
}

function findCreator() {
  return document.querySelector(
    '[data-tutorial-target="scratch-card"], .game-stage-canvas, .photo-scratch-fg-layer, .stage',
  );
}

function creatorAreaReady() {
  const docked = document.querySelector(
    ".top-symbol-bar.is-phase-docked, .top-symbol-bar.is-phase-showcase",
  );
  if (!docked) return false;
  return !document.querySelector(
    ".stage.is-countdown-phase, .stage.is-bar-phase, .stage.is-intro-video-phase",
  );
}

function measure(el: Element | null): Hole | null {
  const rect = el?.getBoundingClientRect();
  if (!rect || rect.width < 24 || rect.height < 16) return null;
  return {
    top: Math.max(4, rect.top - PAD),
    left: Math.max(4, rect.left - PAD),
    width: Math.min(window.innerWidth - 8, rect.width + PAD * 2),
    height: Math.min(window.innerHeight - 8, rect.height + PAD * 2),
  };
}

/** Central torso band — avoid face, nav, and the docked symbol bar. */
function measureCreator(el: Element | null): Hole | null {
  const rect = el?.getBoundingClientRect();
  if (!rect || rect.width < 40 || rect.height < 40) return null;
  return {
    top: rect.top + rect.height * 0.3,
    left: rect.left + rect.width * 0.16,
    width: rect.width * 0.68,
    height: rect.height * 0.36,
  };
}

function tipStyle(hole: Hole, compact = false) {
  const width = Math.min(compact ? 260 : 280, window.innerWidth - 32);
  const left = Math.min(
    window.innerWidth - width - 16,
    Math.max(16, hole.left + hole.width / 2 - width / 2),
  );
  const tipH = compact ? 96 : 150;
  const below = hole.top + hole.height + 14;
  const above = hole.top - tipH - 14;
  const preferBelow = hole.top < window.innerHeight * 0.45;
  let top = preferBelow ? below : Math.max(12, above);
  if (top + tipH > window.innerHeight - 12) {
    top = Math.max(12, hole.top - tipH - 14);
  }
  if (top < 12) top = Math.min(below, window.innerHeight - tipH - 16);
  return { top, left, width };
}

export function FirstPlayTutorial({
  scene,
  fading = false,
}: {
  scene: TutorialScene;
  fading?: boolean;
}) {
  const titleId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const [done] = useState(() => isScratchTutorialCompleted());
  const [foilPhase, setFoilPhase] = useState<FoilPhase>("explain");
  const [hole, setHole] = useState<Hole | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [lockedTip, setLockedTip] = useState<ReturnType<typeof tipStyle> | null>(
    null,
  );

  const creator = scene === "foil" && foilPhase === "creator";
  const foilScratch = scene === "foil" && foilPhase === "foil";
  const waiting = scene === "foil" && foilPhase === "wait";
  const copy =
    scene === "tear"
      ? TEAR_TUTORIAL_STEP
      : creator
        ? CREATOR_TUTORIAL_STEP
        : FOIL_TUTORIAL_STEPS[foilPhase === "explain" ? 0 : 1];
  const active = !done && !dismissed;

  useLayoutEffect(() => {
    if (!active || scene === "tear") return;
    if (foilPhase !== "wait") return;
    const tick = () => {
      if (creatorAreaReady()) setFoilPhase("creator");
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [active, scene, foilPhase]);

  useLayoutEffect(() => {
    if (!active || waiting || fading) return;
    const apply = () => {
      if (scene === "tear") {
        const next = measure(
          document.querySelector('[data-tutorial-target="tear"]'),
        );
        setHole((prev) => {
          if (
            prev &&
            next &&
            prev.top === next.top &&
            prev.left === next.left &&
            prev.width === next.width &&
            prev.height === next.height
          ) {
            return prev;
          }
          return next;
        });
        return;
      }
      if (creator) {
        setHole(measureCreator(findCreator()));
        return;
      }
      setHole(measure(findFoil()));
    };
    apply();
    if (scene === "tear") {
      let raf = 0;
      const loop = () => {
        apply();
        raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
      return () => window.cancelAnimationFrame(raf);
    }
    const id = window.setInterval(apply, 250);
    window.addEventListener("resize", apply);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", apply);
    };
  }, [active, scene, foilPhase, creator, waiting, fading]);

  useLayoutEffect(() => {
    if (scene !== "tear" || !hole || lockedTip) return;
    setLockedTip(tipStyle(hole));
  }, [scene, hole, lockedTip]);

  const overlayOn =
    active && !waiting && (Boolean(hole) || (fading && Boolean(lockedTip)));

  useLayoutEffect(() => {
    if (!overlayOn) {
      delete document.documentElement.dataset.scratchTutorial;
      return;
    }
    document.documentElement.dataset.scratchTutorial = "1";
    return () => {
      delete document.documentElement.dataset.scratchTutorial;
    };
  }, [overlayOn]);

  useEffect(() => {
    if (scene === "foil" && foilPhase === "explain") nextRef.current?.focus();
  }, [scene, foilPhase]);

  useEffect(() => {
    if (!active || !foilScratch) return;
    const el = findFoil();
    if (!el) return;
    const onStart = () => setFoilPhase("wait");
    el.addEventListener("pointerdown", onStart);
    return () => el.removeEventListener("pointerdown", onStart);
  }, [active, foilScratch]);

  useEffect(() => {
    if (!active || !creator) return;
    const el = findCreator();
    if (!el) return;
    const onStart = () => {
      markScratchTutorialCompleted();
      delete document.documentElement.dataset.scratchTutorial;
      setDismissed(true);
    };
    el.addEventListener("pointerdown", onStart);
    return () => el.removeEventListener("pointerdown", onStart);
  }, [active, creator]);

  if (!overlayOn) return null;

  const tip =
    scene === "tear" && lockedTip
      ? lockedTip
      : hole
        ? tipStyle(hole, foilScratch || creator)
        : lockedTip;
  if (!tip) return null;

  const showHole = hole && !fading;
  const right = hole ? hole.left + hole.width : 0;
  const bottom = hole ? hole.top + hole.height : 0;
  const allowThrough = scene === "tear" || foilScratch || creator;
  const demo = foilScratch || creator;

  return createPortal(
    <div
      className={`fp-tutorial${fading ? " is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {showHole && hole ? (
        <>
          <div
            className={`fp-tutorial-dim${creator ? " is-soft" : ""}`}
            style={{ top: 0, left: 0, right: 0, height: hole.top }}
          />
          <div
            className={`fp-tutorial-dim${creator ? " is-soft" : ""}`}
            style={{ top: bottom, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={`fp-tutorial-dim${creator ? " is-soft" : ""}`}
            style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
          />
          <div
            className={`fp-tutorial-dim${creator ? " is-soft" : ""}`}
            style={{ top: hole.top, left: right, right: 0, height: hole.height }}
          />
          <div
            className={`fp-tutorial-hole ${
              scene === "tear" ? "is-strip" : creator ? "is-creator" : "is-pill"
            }${allowThrough ? "" : " is-blocked"}${demo ? " is-demo" : ""}`}
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          >
            {foilScratch ? (
              <>
                <div className="fp-scratch-demo">
                  <div className="fp-scratch-demo-foil" />
                  <div className="fp-scratch-reveal" />
                  <div className="fp-scratch-nib" />
                </div>
                <span className="fp-scratch-ripple" />
                <span className="fp-scratch-finger">
                  <span className="fp-scratch-lines" aria-hidden="true" />
                </span>
                <span className="fp-scratch-hint">← Drag to scratch →</span>
              </>
            ) : null}
            {creator ? (
              <>
                <span className="fp-creator-guide" aria-hidden="true" />
                <span className="fp-creator-trail" />
                <span className="fp-creator-label">Scratch</span>
                <span className="fp-scratch-finger is-creator">
                  <span className="fp-scratch-lines" aria-hidden="true" />
                </span>
              </>
            ) : null}
            {scene === "tear" ? (
              <span className="fp-tutorial-finger is-tear" />
            ) : null}
          </div>
        </>
      ) : null}
      <div className={`fp-tutorial-tip${demo ? " is-demo" : ""}`} style={tip}>
        <h2 id={titleId} className="fp-tutorial-title">
          {copy.title}
        </h2>
        <p className="fp-tutorial-copy">{copy.description}</p>
        {scene === "foil" && foilPhase === "explain" ? (
          <div className="fp-tutorial-nav">
            <span className="fp-tutorial-step">2 / 4</span>
            <button
              ref={nextRef}
              type="button"
              onClick={() => setFoilPhase("foil")}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
