/**
 * Module bridge so AuthContext / bindGameNavigate can run fade-to-black
 * transitions without sitting under MemoryTransitionProvider hooks.
 * Mirrors bindGameNavigate in gameSession.
 */

export type MemoryNavigateOptions = {
  /** React Router navigate options (replace, state). */
  replace?: boolean;
  state?: unknown;
  /**
   * Force the full transition even when domain heuristic would skip
   * (rarely needed).
   */
  force?: boolean;
  /**
   * Skip transition and call underlying navigate immediately
   * (same-tab reselect, query-only tweaks).
   */
  skipTransition?: boolean;
};

type MemoryNavigateFn = (to: string, options?: MemoryNavigateOptions) => void;

let memoryNavigateImpl: MemoryNavigateFn | null = null;
let plainNavigateImpl: ((to: string, options?: MemoryNavigateOptions) => void) | null =
  null;

/** Registered by MemoryTransitionProvider on mount. */
export function bindMemoryNavigate(
  fn: MemoryNavigateFn | null,
  plain?: ((to: string, options?: MemoryNavigateOptions) => void) | null,
): void {
  memoryNavigateImpl = fn;
  plainNavigateImpl = plain ?? null;
}

/**
 * Prefer transition when bound; otherwise plain navigate if bound; else no-op
 * (caller should have its own useNavigate fallback during early boot).
 */
export function memoryNavigate(
  to: string,
  options?: MemoryNavigateOptions,
): void {
  if (options?.skipTransition && plainNavigateImpl) {
    plainNavigateImpl(to, options);
    return;
  }
  if (memoryNavigateImpl) {
    memoryNavigateImpl(to, options);
    return;
  }
  if (plainNavigateImpl) {
    plainNavigateImpl(to, options);
    return;
  }
  if (typeof window !== "undefined") {
    const url = new URL(to, window.location.href);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (options?.replace) {
      window.history.replaceState(window.history.state, "", next);
    } else {
      window.history.pushState(window.history.state, "", next);
    }
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

/** True while a memory transition owns the veil (module mirror of provider). */
let transitioning = false;

export function setMemoryTransitioning(value: boolean): void {
  transitioning = value;
}

export function isMemoryTransitioning(): boolean {
  return transitioning;
}
