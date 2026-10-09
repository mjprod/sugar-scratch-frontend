import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  currentPageReadyEpoch,
  isPageKeyWarmed,
  markPageKeyWarmed,
  pageKey,
  routeNeedsWait,
} from "@/shared/ui/pageWarmth";
import { PageReadyContext, type PageReadyValue } from "@/shared/ui/usePageReady";

export function PageReadyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const key = pageKey(location.pathname, location.search);
  const [epoch, setEpoch] = useState(currentPageReadyEpoch);
  const [state, setState] = useState(() => ({
    key,
    ready: !routeNeedsWait(location.pathname) || isPageKeyWarmed(key),
  }));

  if (epoch !== currentPageReadyEpoch()) {
    setEpoch(currentPageReadyEpoch());
    setState({
      key,
      ready: !routeNeedsWait(location.pathname),
    });
  } else if (state.key !== key) {
    setState({
      key,
      ready: !routeNeedsWait(location.pathname) || isPageKeyWarmed(key),
    });
  }

  const markReady = useCallback(() => {
    setState((current) => {
      markPageKeyWarmed(current.key);
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
