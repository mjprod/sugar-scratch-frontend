import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { lottieRenderConfig } from "@/utils/lottieRender";

export const BONUS_DIAMOND_LOTTIE_SRC = "/lottie/bonusDiamond.lottie";

/** Total time on stage (enter → exit). */
const VISIBLE_MS = 1000;
const SCALE_IN_MS = 320;
const SCALE_OUT_MS = 220;
/** Gap after a miss / dismiss before the next spawn. */
const RESPAWN_MS = 2500;
/** Short beat after the first 10% milestone before the diamond pops in. */
const FIRST_SPAWN_MS = 400;
const DIAMOND_SIZE_PX = 144;
/**
 * Entrance overshoots past 1; keep headroom so the wasm canvas stays sharp
 * through pop-in / wander / press transforms.
 */
const DIAMOND_LOTTIE_EXTRA_SCALE = 1.5;
/** Keep away from edges + chrome so the hit target stays tappable. */
const MARGIN_PCT = 12;
/** How often the wander picks a new target (ms). */
const WANDER_RETARGET_MS = 280;
/** Max pct-point step per second toward the current target. */
const WANDER_SPEED_PCT_PER_S = 55;

type Phase = "in" | "live" | "out";

type Spawn = {
  id: number;
  leftPct: number;
  topPct: number;
  phase: Phase;
};

function randomPct() {
  return MARGIN_PCT + Math.random() * (100 - MARGIN_PCT * 2);
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Stop offering bonus diamonds once this many body icons are found. */
export const BONUS_DIAMOND_LOCK_AT_FOUND = 11;

type BonusDiamondSpawnerProps = {
  /**
   * Armed only after ScratchPrototype's first crossedProgressMilestone.
   * While false, nothing spawns.
   */
  unlocked: boolean;
  /**
   * Body/foil icons found so far. At ≥ BONUS_DIAMOND_LOCK_AT_FOUND the
   * spawner clears any live diamond and never respawns.
   */
  revealedSymbols?: number;
};

/**
 * /game-ui lab only — pops a tappable bonus diamond at a random stage position.
 * Stays dormant until `unlocked` (first 10% scratch milestone), then:
 * anticipates in, wanders for ~1s, scales out (or claim → modal).
 * Locked once the player has found 11 of 12 icons.
 */
export function BonusDiamondSpawner({
  unlocked,
  revealedSymbols = 0,
}: BonusDiamondSpawnerProps) {
  const [spawn, setSpawn] = useState<Spawn | null>(null);
  const [claimedOpen, setClaimedOpen] = useState(false);
  const spawnIdRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const respawnTimerRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const lockedRef = useRef(false);
  const reducedRef = useRef(prefersReducedMotion());

  // Live position for rAF wander (avoids setState every frame).
  const posRef = useRef({ left: 50, top: 50 });
  const targetRef = useRef({ left: 50, top: 50 });
  const nodeRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const nextRetargetAtRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (respawnTimerRef.current != null) {
      window.clearTimeout(respawnTimerRef.current);
      respawnTimerRef.current = null;
    }
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const scheduleSpawn = useCallback((delayMs: number) => {
    if (lockedRef.current) return;
    if (respawnTimerRef.current != null) {
      window.clearTimeout(respawnTimerRef.current);
    }
    respawnTimerRef.current = window.setTimeout(() => {
      respawnTimerRef.current = null;
      if (lockedRef.current) return;
      const left = randomPct();
      const top = randomPct();
      posRef.current = { left, top };
      targetRef.current = { left: randomPct(), top: randomPct() };
      spawnIdRef.current += 1;
      setSpawn({
        id: spawnIdRef.current,
        leftPct: left,
        topPct: top,
        phase: "in",
      });
    }, delayMs);
  }, []);

  // Hard lock at 11/12 icons — drop any live diamond and cancel respawns.
  // Lab same-card loops reset the count to 0; unlock again for the next round.
  useEffect(() => {
    if (revealedSymbols >= BONUS_DIAMOND_LOCK_AT_FOUND) {
      if (lockedRef.current) return;
      lockedRef.current = true;
      clearTimers();
      setSpawn(null);
      return;
    }
    if (!lockedRef.current) return;
    lockedRef.current = false;
    // Round reset after lock: allow a fresh first spawn once still unlocked.
    if (unlocked) {
      hasStartedRef.current = true;
      reducedRef.current = prefersReducedMotion();
      scheduleSpawn(FIRST_SPAWN_MS);
    }
  }, [revealedSymbols, unlocked, clearTimers, scheduleSpawn]);

  // Arm only after the first progress milestone; never auto-start on mount.
  useEffect(() => {
    if (!unlocked || lockedRef.current || hasStartedRef.current) return;
    if (revealedSymbols >= BONUS_DIAMOND_LOCK_AT_FOUND) return;
    hasStartedRef.current = true;
    reducedRef.current = prefersReducedMotion();
    scheduleSpawn(FIRST_SPAWN_MS);
  }, [unlocked, revealedSymbols, scheduleSpawn]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Lifecycle: in → live → out → gone (+ respawn, unless locked).
  useEffect(() => {
    if (!spawn || claimedOpen || lockedRef.current) return;
    const reduced = reducedRef.current;

    if (spawn.phase === "in") {
      const inMs = reduced ? 0 : SCALE_IN_MS;
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        if (lockedRef.current) return;
        setSpawn((s) => (s && s.id === spawn.id ? { ...s, phase: "live" } : s));
      }, inMs);
      return () => {
        if (hideTimerRef.current != null) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      };
    }

    if (spawn.phase === "live") {
      // Remainder of the 1s window after the entrance.
      const liveMs = Math.max(
        120,
        VISIBLE_MS - (reduced ? 0 : SCALE_IN_MS) - (reduced ? 0 : SCALE_OUT_MS),
      );
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        if (lockedRef.current) return;
        setSpawn((s) => (s && s.id === spawn.id ? { ...s, phase: "out" } : s));
      }, liveMs);
      return () => {
        if (hideTimerRef.current != null) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      };
    }

    // phase === "out"
    const outMs = reduced ? 0 : SCALE_OUT_MS;
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setSpawn(null);
      if (!lockedRef.current) scheduleSpawn(RESPAWN_MS);
    }, outMs);
    return () => {
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [spawn, claimedOpen, scheduleSpawn]);

  // Continuous wander while the diamond is on stage (not exiting / claimed).
  useEffect(() => {
    if (!spawn || claimedOpen || spawn.phase === "out") return;
    if (reducedRef.current) return;

    lastTsRef.current = 0;
    nextRetargetAtRef.current = performance.now() + WANDER_RETARGET_MS;

    const tick = (ts: number) => {
      const prev = lastTsRef.current || ts;
      lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - prev) / 1000);

      if (ts >= nextRetargetAtRef.current) {
        targetRef.current = { left: randomPct(), top: randomPct() };
        nextRetargetAtRef.current = ts + WANDER_RETARGET_MS * (0.7 + Math.random() * 0.6);
      }

      const pos = posRef.current;
      const target = targetRef.current;
      const maxStep = WANDER_SPEED_PCT_PER_S * dt;
      const dx = target.left - pos.left;
      const dy = target.top - pos.top;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(maxStep, dist);
      pos.left += (dx / dist) * step;
      pos.top += (dy / dist) * step;

      const el = nodeRef.current;
      if (el) {
        el.style.left = `${pos.left}%`;
        el.style.top = `${pos.top}%`;
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [spawn, claimedOpen]);

  const claim = useCallback(() => {
    if (!spawn || claimedOpen || spawn.phase === "out") return;
    clearTimers();
    setSpawn(null);
    setClaimedOpen(true);
  }, [spawn, claimedOpen, clearTimers]);

  const dismissClaim = useCallback(() => {
    setClaimedOpen(false);
    if (!lockedRef.current) scheduleSpawn(RESPAWN_MS);
  }, [scheduleSpawn]);

  const phaseClass =
    spawn?.phase === "in"
      ? "is-in"
      : spawn?.phase === "out"
        ? "is-out"
        : "is-live";

  const style: CSSProperties | undefined = spawn
    ? {
        left: `${spawn.leftPct}%`,
        top: `${spawn.topPct}%`,
        width: DIAMOND_SIZE_PX,
        height: DIAMOND_SIZE_PX,
      }
    : undefined;

  return (
    <>
      {spawn ? (
        <button
          type="button"
          key={spawn.id}
          ref={nodeRef}
          className={`bonus-diamond ${phaseClass}`}
          style={style}
          aria-label="Claim bonus diamond"
          onClick={claim}
          disabled={spawn.phase === "out"}
        >
          <span className="bonus-diamond__motion" aria-hidden="true">
            <DotLottieReact
              src={BONUS_DIAMOND_LOTTIE_SRC}
              autoplay
              loop
              speed={1.15}
              renderConfig={lottieRenderConfig({
                extraScale: DIAMOND_LOTTIE_EXTRA_SCALE,
                autoResize: true,
                freezeOnOffscreen: false,
              })}
              style={{
                width: "100%",
                height: "100%",
                imageRendering: "auto",
              }}
            />
          </span>
        </button>
      ) : null}
      {claimedOpen ? <DiamondClaimedModal onDismiss={dismissClaim} /> : null}
    </>
  );
}

function DiamondClaimedModal({ onDismiss }: { onDismiss: () => void }) {
  const titleId = useId();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  useEffect(() => {
    okRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="game-pause bonus-diamond-claim" role="presentation">
      <button
        type="button"
        className="game-pause__scrim"
        aria-label="Close"
        onClick={onDismiss}
      />
      <div
        className="game-pause__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="game-pause__title">
          Diamond claimed
        </h2>
        <button
          ref={okRef}
          type="button"
          className="game-pause__resume"
          onClick={onDismiss}
        >
          Nice
        </button>
      </div>
    </div>,
    document.body,
  );
}
