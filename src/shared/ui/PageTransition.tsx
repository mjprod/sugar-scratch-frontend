import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { Paths } from "@/routes/Paths";

type PageReadyValue = {
  ready: boolean;
  markReady: () => void;
  isWaiting: boolean;
};

const PageReadyContext = createContext<PageReadyValue | null>(null);

const warmedPageKeys = new Set<string>();
let pageReadyEpoch = 0;

function pageKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

/** Routes whose first useful view is async — overlay waits on markReady(). */
export function routeNeedsWait(pathname: string) {
  if (pathname === Paths.preLoader || pathname === Paths.loading) return false;
  if (pathname === Paths.home) return true;
  if (pathname.startsWith(Paths.discover)) return true;
  if (pathname.startsWith(Paths.search)) return true;
  if (pathname.startsWith("/creator/")) return true;
  if (pathname === Paths.recommendSwipe) return true;
  if (pathname.startsWith("/purchase/")) return true;
  if (pathname === Paths.coverflowV2) return true;
  if (pathname.startsWith(Paths.game)) return true;
  if (pathname.startsWith(Paths.photoScratch)) return true;
  return false;
}

export function resetPageReady() {
  pageReadyEpoch += 1;
  warmedPageKeys.clear();
}

export function PageReadyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const key = pageKey(location.pathname, location.search);
  const [epoch, setEpoch] = useState(pageReadyEpoch);
  const [state, setState] = useState(() => ({
    key,
    ready: !routeNeedsWait(location.pathname) || warmedPageKeys.has(key),
  }));

  if (epoch !== pageReadyEpoch) {
    setEpoch(pageReadyEpoch);
    setState({
      key,
      ready: !routeNeedsWait(location.pathname),
    });
  } else if (state.key !== key) {
    setState({
      key,
      ready: !routeNeedsWait(location.pathname) || warmedPageKeys.has(key),
    });
  }

  const markReady = useCallback(() => {
    setState((current) => {
      warmedPageKeys.add(current.key);
      return current.ready ? current : { ...current, ready: true };
    });
  }, []);

  const value = useMemo<PageReadyValue>(
    () => ({
      ready: state.ready,
      markReady,
      isWaiting: !state.ready,
    }),
    [markReady, state.ready],
  );

  return (
    <PageReadyContext.Provider value={value}>
      {children}
    </PageReadyContext.Provider>
  );
}

export function usePageReady() {
  const ctx = useContext(PageReadyContext);
  if (!ctx) {
    return {
      ready: true,
      markReady: () => {},
      isWaiting: false,
    };
  }
  return ctx;
}

export function isPageWarmed(pathname: string, search: string) {
  return warmedPageKeys.has(pageKey(pathname, search));
}

/** Dismiss the site preloader once this route's first useful view is ready. */
export function useMarkPageReady(isReady: boolean) {
  const location = useLocation();
  const { markReady } = usePageReady();
  if (isReady) {
    warmedPageKeys.add(pageKey(location.pathname, location.search));
  }
  useLayoutEffect(() => {
    if (isReady) markReady();
  }, [isReady, markReady]);
}
