import { useAuth } from "@/contexts/AuthContext";
import type { ProtectedAction } from "@/services/auth";

/** Soft-gate helper — opens auth sheet when guest; resumes when authed. */
export function useRequireAuth() {
  const { requireAuth, authed, guest } = useAuth();
  return {
    authed,
    guest,
    requireAuth: (action: ProtectedAction) => requireAuth(action),
  };
}
