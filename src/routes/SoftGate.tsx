import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
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
  const { authed, authReady, requireAuth } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!authReady || authed) return;
    requireAuth(
      action ?? {
        type: "resume",
        path: `${location.pathname}${location.search}`,
      },
    );
    // Gate once session is known; path/action captured on that first guest hit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate once after authReady
  }, [authReady, authed]);

  if (!authReady) {
    return null;
  }

  if (!authed) {
    return <Navigate to={Paths.discover} replace />;
  }

  return <>{children}</>;
}
