import { useAuth } from "@/contexts/AuthContext";
import { tabFromPathname } from "@/routes/Paths";
import type { AppTab } from "@/types/app";
import { useLocation } from "react-router-dom";

/** Current app tab from the URL + requestTab from auth. */
export function useTabNav() {
  const location = useLocation();
  const { requestTab, openStore, openSettings } = useAuth();
  const activeTab: AppTab = tabFromPathname(location.pathname);
  return { activeTab, requestTab, openStore, openSettings };
}
