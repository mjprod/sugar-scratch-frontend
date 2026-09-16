import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  bindMemoryNavigate,
  isMemoryTransitioning,
  setMemoryTransitioning,
  type MemoryNavigateOptions,
} from "@/lib/memory/memoryNavigate";
import { purgeRouteMemory } from "@/lib/memory/purgeRouteMemory";
import {
  pathFromTarget,
  routeMemoryDomain,
  shouldMemoryTransition,
  shouldSafetyNetTransition,
} from "@/lib/memory/routeMemoryDomain";
import { usePageReady } from "@/shared/ui/PageTransition";
import "./MemoryTransition.css";

export type MemoryPhase =
  | "idle"
  | "fading-in"
  | "purging"
  | "holding"
  | "fading-out";

const FADE_IN_MS = 360;
const FADE_OUT_MS = 420;
const MIN_HOLD_MS = 120;
const MAX_HOLD_MS = 1000;
/** Safety-net: still brief so back-nav jank is covered without a long wait. */
const SAFETY_FADE_IN_MS = 140;

type TransitionToOptions = MemoryNavigateOptions;

type MemoryTransitionValue = {
  transitionTo: (to: string, options?: TransitionToOptions) => void;
  isTransitioning: boolean;
  phase: MemoryPhase;
};

const MemoryTransitionContext = createContext<MemoryTransitionValue | null>(
  null,
);

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

type PendingNav = {
  to: string;
  pathname: string;
  search: string;
  replace?: boolean;
  state?: unknown;
  fromPathname: string;
  /** Safety net: location already changed; skip navigate. */
  safetyNet: boolean;
  fadeInMs: number;
};

/**
 * Fade-to-black coordinator: hide → purge decoders/GL leftovers → navigate →
 * hold until page ready (or ceiling) → fade out.
 */
export function MemoryTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { ready } = usePageReady();
  const [phase, setPhase] = useState<MemoryPhase>("idle");
  const generationRef = useRef(0);
  const pendingRef = useRef<PendingNav | null>(null);
  const holdStartedAtRef = useRef(0);
  const locationKeyRef = useRef(`${location.pathname}${location.search}`);
  const prevPathRef = useRef(location.pathname);
  const intentionalNavRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    for (const id of intervalsRef.current) window.clearInterval(id);
    timersRef.current = [];
    intervalsRef.current = [];
  }, []);

  const setPhaseSafe = useCallback((gen: number, next: MemoryPhase) => {
    if (generationRef.current !== gen) return;
    setPhase(next);
    setMemoryTransitioning(next !== "idle");
  }, []);

  const runPlainNavigate = useCallback(
    (to: string, options?: MemoryNavigateOptions) => {
      navigate(to, {
        replace: options?.replace,
        state: options?.state,
      });
    },
    [navigate],
  );

  const finishToIdle = useCallback(
    (gen: number) => {
      if (generationRef.current !== gen) return;
      clearTimers();
      pendingRef.current = null;
      intentionalNavRef.current = false;
      setPhaseSafe(gen, "idle");
    },
    [clearTimers, setPhaseSafe],
  );

  const beginFadeOut = useCallback(
    (gen: number) => {
      if (generationRef.current !== gen) return;
      setPhaseSafe(gen, "fading-out");
      const id = window.setTimeout(() => finishToIdle(gen), FADE_OUT_MS + 16);
      timersRef.current.push(id);
    },
    [finishToIdle, setPhaseSafe],
  );

  const enterHolding = useCallback(
    (gen: number) => {
      if (generationRef.current !== gen) return;
      setPhaseSafe(gen, "holding");
      holdStartedAtRef.current = performance.now();

      const tryRelease = () => {
        if (generationRef.current !== gen) return;
        const elapsed = performance.now() - holdStartedAtRef.current;
        const minMet = elapsed >= MIN_HOLD_MS;
        const maxMet = elapsed >= MAX_HOLD_MS;
        if ((readyRef.current && minMet) || maxMet) {
          beginFadeOut(gen);
          return true;
        }
        return false;
      };

      if (tryRelease()) return;

      const poll = window.setInterval(() => {
        if (tryRelease()) window.clearInterval(poll);
      }, 32);
      intervalsRef.current.push(poll);

      const maxId = window.setTimeout(() => {
        window.clearInterval(poll);
        if (generationRef.current === gen) beginFadeOut(gen);
      }, MAX_HOLD_MS + 8);
      timersRef.current.push(maxId);
    },
    [beginFadeOut, setPhaseSafe],
  );

  const runPurgeAndMaybeNavigate = useCallback(
    async (gen: number, pending: PendingNav) => {
      if (generationRef.current !== gen) return;
      setPhaseSafe(gen, "purging");

      const from = routeMemoryDomain(pending.fromPathname);
      const to = routeMemoryDomain(pending.pathname);
      purgeRouteMemory({
        from,
        to,
        // Safety-net runs after the new route mounted — don't kill its media.
        detachDom: !pending.safetyNet,
      });

      await doubleRaf();
      if (generationRef.current !== gen) return;

      if (!pending.safetyNet) {
        intentionalNavRef.current = true;
        navigate(pending.to, {
          replace: pending.replace,
          state: pending.state,
        });
        // Let React commit the new route under black before holding.
        await doubleRaf();
      }

      if (generationRef.current !== gen) return;
      enterHolding(gen);
    },
    [enterHolding, navigate, setPhaseSafe],
  );

  const startTransition = useCallback(
    (pending: PendingNav) => {
      generationRef.current += 1;
      const gen = generationRef.current;
      clearTimers();
      pendingRef.current = pending;
      setMemoryTransitioning(true);
      setPhaseSafe(gen, "fading-in");

      const id = window.setTimeout(() => {
        void runPurgeAndMaybeNavigate(gen, pending);
      }, pending.fadeInMs);
      timersRef.current.push(id);
    },
    [clearTimers, runPurgeAndMaybeNavigate, setPhaseSafe],
  );

  const transitionTo = useCallback(
    (to: string, options?: TransitionToOptions) => {
      const { pathname: toPath } = pathFromTarget(to);
      const fromPath = location.pathname;

      if (options?.skipTransition) {
        runPlainNavigate(to, options);
        return;
      }

      const needs =
        options?.force === true || shouldMemoryTransition(fromPath, toPath);

      if (!needs) {
        runPlainNavigate(to, options);
        return;
      }

      // Already transitioning — bump generation and retarget (last tap wins).
      startTransition({
        to,
        pathname: toPath,
        search: pathFromTarget(to).search,
        replace: options?.replace,
        state: options?.state,
        fromPathname: fromPath,
        safetyNet: false,
        fadeInMs: FADE_IN_MS,
      });
    },
    [location.pathname, runPlainNavigate, startTransition],
  );

  // Register module bridge for AuthContext / game navigate.
  useEffect(() => {
    bindMemoryNavigate(transitionTo, runPlainNavigate);
    return () => bindMemoryNavigate(null, null);
  }, [transitionTo, runPlainNavigate]);

  // Safety net: location changed while idle across a heavy boundary.
  useLayoutEffect(() => {
    const key = `${location.pathname}${location.search}`;
    const prevKey = locationKeyRef.current;
    const prevPath = prevPathRef.current;

    locationKeyRef.current = key;
    prevPathRef.current = location.pathname;

    if (key === prevKey) return;

    if (intentionalNavRef.current) {
      intentionalNavRef.current = false;
      return;
    }

    // Ignore if we're already in a transition we own.
    if (phase !== "idle" && isMemoryTransitioning()) return;

    if (!shouldSafetyNetTransition(prevPath, location.pathname)) return;

    startTransition({
      to: key,
      pathname: location.pathname,
      search: location.search,
      fromPathname: prevPath,
      safetyNet: true,
      fadeInMs: SAFETY_FADE_IN_MS,
    });
  }, [location.pathname, location.search, phase, startTransition]);

  // If ready flips true during hold, release as soon as min hold is met.
  useEffect(() => {
    if (phase !== "holding" || !ready) return;
    const gen = generationRef.current;
    const elapsed = performance.now() - holdStartedAtRef.current;
    if (elapsed >= MIN_HOLD_MS) {
      beginFadeOut(gen);
      return;
    }
    const id = window.setTimeout(
      () => beginFadeOut(gen),
      Math.max(0, MIN_HOLD_MS - elapsed),
    );
    timersRef.current.push(id);
  }, [beginFadeOut, phase, ready]);

  useEffect(
    () => () => {
      clearTimers();
      setMemoryTransitioning(false);
      bindMemoryNavigate(null, null);
    },
    [clearTimers],
  );

  const value = useMemo<MemoryTransitionValue>(
    () => ({
      transitionTo,
      isTransitioning: phase !== "idle",
      phase,
    }),
    [phase, transitionTo],
  );

  const showVeil = phase !== "idle";

  return (
    <MemoryTransitionContext.Provider value={value}>
      {children}
      {showVeil && typeof document !== "undefined"
        ? createPortal(
            <div
              className="memory-veil"
              data-phase={phase}
              aria-hidden={phase === "fading-out"}
            />,
            document.body,
          )
        : null}
    </MemoryTransitionContext.Provider>
  );
}

export function useMemoryTransition(): MemoryTransitionValue {
  const ctx = useContext(MemoryTransitionContext);
  if (!ctx) {
    return {
      transitionTo: (to, options) => {
        // Fallback if provider missing — best-effort history hop.
        if (typeof window === "undefined") return;
        const url = new URL(to, window.location.href);
        const next = `${url.pathname}${url.search}${url.hash}`;
        if (options?.replace) {
          window.history.replaceState(options.state ?? null, "", next);
        } else {
          window.history.pushState(options.state ?? null, "", next);
        }
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
      isTransitioning: false,
      phase: "idle",
    };
  }
  return ctx;
}

/** Drop-in navigate that prefers fade-to-black when domains differ. */
export function useMemoryNavigate() {
  const { transitionTo } = useMemoryTransition();
  return transitionTo;
}
