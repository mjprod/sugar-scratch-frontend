import { useAuth } from "@/contexts/AuthContext";
import { tabFromPathname } from "@/routes/Paths";
import type { AppTab } from "@/types/app";
import { useLocation } from "react-router-dom";

/** Current app tab from the URL + requestTab from auth. */
export function useTabNav() {
  const location = useLocation();
  const { requestTab, openStore, openSettings } = useAuth();
  /** null on secondary surfaces that aren't under a primary tab (e.g. creator). */
  const activeTab: AppTab | null = tabFromPathname(location.pathname);
  return { activeTab, requestTab, openStore, openSettings };
}
