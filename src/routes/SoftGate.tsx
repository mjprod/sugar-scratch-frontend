import { useEffect, useRef, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { Paths } from "@/routes/Paths";
import { shouldPromptLoginOnSoftGate } from "@/routes/softGateAuth";
import type { ProtectedAction } from "@/services/auth";
import type { AppTab } from "@/types/app";

/** Soft-gate: guests see auth sheet and bounce to Discover; authed users pass through. */
export function SoftGate({
  tab: _tab,
  action,
  children,
}: {
  tab: AppTab;
  /** Prefer over path resume when resume should open a secondary surface. */
  action?: ProtectedAction;
  children: ReactNode;
}) {
  const { authed, authReady, hasLoggedInBefore, requireAuth } = useAuth();
  const location = useLocation();
  const wasAuthedRef = useRef(authed);

  useEffect(() => {
    if (
      shouldPromptLoginOnSoftGate(authReady, authed, wasAuthedRef.current)
    ) {
      requireAuth(
        action ?? {
          type: "resume",
          path: `${location.pathname}${location.search}`,
        },
      );
    }
    if (authReady) wasAuthedRef.current = authed;
    // Gate once session is known; path/action captured on that first guest hit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate once after authReady
  }, [authReady, authed]);

  if (!authReady) {
    // Returning visitors keep the last chrome; first-time guests wait.
    return hasLoggedInBefore ? <>{children}</> : null;
  }

  if (!authed) {
    return <Navigate to={Paths.discover} replace />;
  }

  return <>{children}</>;
}
