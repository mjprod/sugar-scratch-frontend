import { createContext, useContext } from "react";
import type { MemoryNavigateOptions } from "@/lib/memory/memoryNavigate";

export type MemoryPhase =
  | "idle"
  | "fading-in"
  | "purging"
  | "holding"
  | "fading-out";

type TransitionToOptions = MemoryNavigateOptions;

export type MemoryTransitionValue = {
  transitionTo: (to: string, options?: TransitionToOptions) => void;
  isTransitioning: boolean;
  phase: MemoryPhase;
};

export const MemoryTransitionContext = createContext<MemoryTransitionValue | null>(
  null,
);

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
          window.history.replaceState(options?.state ?? null, "", next);
        } else {
          window.history.pushState(options?.state ?? null, "", next);
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
