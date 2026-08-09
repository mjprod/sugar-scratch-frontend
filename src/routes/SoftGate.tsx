import { useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import type { AppTab } from "@/types/app";

/** Soft-gate: guests see auth sheet and bounce home; authed users pass through. */
export function SoftGate({
  tab,
  children,
}: {
  tab: AppTab;
  children: ReactNode;
}) {
  const { authed, requireAuth } = useAuth();

  useEffect(() => {
    if (!authed) {
      requireAuth({ type: "tab", tab });
    }
  }, [authed, requireAuth, tab]);

  if (!authed) {
    return <Navigate to={Paths.home} replace />;
  }

  return <>{children}</>;
}
