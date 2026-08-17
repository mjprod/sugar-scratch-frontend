import { useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import type { ProtectedAction } from "@/services/auth";
import type { AppTab } from "@/types/app";

/** Soft-gate: guests see auth sheet and bounce to Discover; authed users pass through. */
export function SoftGate({
  tab,
  action,
  children,
}: {
  tab: AppTab;
  /** Prefer over `{ type: "tab", tab }` when resume should open a secondary surface. */
  action?: ProtectedAction;
  children: ReactNode;
}) {
  const { authed, requireAuth } = useAuth();

  useEffect(() => {
    if (!authed) {
      requireAuth(action ?? { type: "tab", tab });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate once on mount
  }, []);

  if (!authed) {
    return <Navigate to={Paths.discover} replace />;
  }

  return <>{children}</>;
}
