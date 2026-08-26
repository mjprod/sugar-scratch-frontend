import { useCallback } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";

/** True when React Router has an in-app history entry to pop. */
export function canNavigateBack(): boolean {
  try {
    const state = window.history.state as { idx?: number } | null;
    if (typeof state?.idx === "number") return state.idx > 0;
  } catch {
    /* ignore */
  }
  return false;
}

/** Prefer history back; otherwise go to fallback (direct entry / refresh). */
export function navigateBackOr(
  navigate: NavigateFunction,
  fallback: string,
) {
  if (canNavigateBack()) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
}

export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    navigateBackOr(navigate, fallback);
  }, [fallback, navigate]);
}
