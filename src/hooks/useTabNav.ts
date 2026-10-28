import { useAuth } from "@/contexts/useAuth";
import { tabFromPathname } from "@/routes/Paths";
import type { AppTab } from "@/types/app";
import { useLocation } from "react-router-dom";

/** Current app tab from the URL + requestTab from auth. */
export function useTabNav() {
  const location = useLocation();
  const { authed, authReady, hasLoggedInBefore, requestTab, openStore, openSettings } =
    useAuth();
  const chromeAuthed = authReady ? authed : hasLoggedInBefore;
  /** null on secondary surfaces that aren't under a primary tab (e.g. store). */
  const activeTab: AppTab | null = tabFromPathname(location.pathname, chromeAuthed);
  return { activeTab, requestTab, openStore, openSettings };
}
