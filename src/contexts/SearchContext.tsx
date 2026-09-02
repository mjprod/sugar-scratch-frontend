import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PackLibrary } from "@/components/home/PackLibrary";

type SearchContextValue = {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    if (pathnameRef.current === location.pathname) return;
    pathnameRef.current = location.pathname;
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const state = location.state as { openPackLibrary?: boolean } | null;
    const wantsSearch =
      params.get("library") === "1" || Boolean(state?.openPackLibrary);
    if (!wantsSearch) return;

    setSearchOpen(true);

    params.delete("library");
    const next = params.toString();
    navigate(
      { pathname: location.pathname, search: next ? `?${next}` : "" },
      { replace: true, state: {} },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  const value = useMemo(
    () => ({ searchOpen, openSearch, closeSearch }),
    [closeSearch, openSearch, searchOpen],
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      <PackLibrary open={searchOpen} onClose={closeSearch} />
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}
