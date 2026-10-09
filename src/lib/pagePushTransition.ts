/**
 * Which AppLayout hops get an iOS push, and which stay instant.
 * A transform ancestor breaks canvas/WebGL, and purchase already runs its
 * own AnimatePresence — so either side of those hops skips the slide.
 */

/** Query and hash do not change the surface. */
export function pushPathname(pathname: string): string {
  return pathname.split("?")[0]?.split("#")[0] || "/";
}

/**
 * Scratch / game surfaces. Exact prefixes only — `/profile/game-history`
 * is not a game surface.
 */
export function isScratchGamePath(pathname: string): boolean {
  const path = pushPathname(pathname);
  return (
    path === "/game" ||
    path === "/game-ui" ||
    path === "/photo-scratch" ||
    path === "/audio-test" ||
    path.startsWith("/game/") ||
    path.startsWith("/game-ui/") ||
    path.startsWith("/photo-scratch/") ||
    path.startsWith("/audio-test/")
  );
}

/**
 * Immersive purchase already runs its own AnimatePresence stages.
 * A route-level push would fight that and the memory veil.
 */
export function isPurchaseFlowPath(pathname: string): boolean {
  return pushPathname(pathname).startsWith("/purchase");
}

/** True when this pathname must not sit under a transformed push ancestor. */
export function shouldSkipPushTransition(pathname: string): boolean {
  return isScratchGamePath(pathname) || isPurchaseFlowPath(pathname);
}

/**
 * Skip the slide when either side is scratch/purchase. Leaving `/game`
 * must not transform the outgoing canvas, not only the incoming page.
 */
export function shouldSkipPushHop(fromPath: string, toPath: string): boolean {
  return shouldSkipPushTransition(fromPath) || shouldSkipPushTransition(toPath);
}

/** React Router history index (0 on first entry / unknown). */
export function historyIndex(): number {
  if (typeof window === "undefined") return 0;
  try {
    const state = window.history.state as { idx?: number } | null;
    if (typeof state?.idx === "number") return state.idx;
  } catch {
    /* ignore */
  }
  return 0;
}

/** +1 = push from the right; -1 = pop from the left. Same idx (replace) is a push. */
export function pushDirection(prevIdx: number, nextIdx: number): 1 | -1 {
  return nextIdx < prevIdx ? -1 : 1;
}
