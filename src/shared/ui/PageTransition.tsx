/**
 * Page readiness gate for SitePreloader / MemoryTransition — not a visual
 * route transition. Visual slides live in PagePushStage; content enter fades
 * live in PageContentEnter (gated on `revealed` so they don't finish under splash).
 */
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

function initialGate(pathname: string, key: string) {
  // No splash (static route or already warmed) → ready + revealed together.
  return !routeNeedsWait(pathname) || isPageKeyWarmed(key);
}

export function PageReadyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const key = pageKey(location.pathname, location.search);
  const [epoch, setEpoch] = useState(currentPageReadyEpoch);
  const [state, setState] = useState(() => {
    const open = initialGate(location.pathname, key);
    return { key, ready: open, revealed: open };
  });

  if (epoch !== currentPageReadyEpoch()) {
    setEpoch(currentPageReadyEpoch());
    const open = !routeNeedsWait(location.pathname);
    setState({ key, ready: open, revealed: open });
  } else if (state.key !== key) {
    const open = initialGate(location.pathname, key);
    setState({ key, ready: open, revealed: open });
  }

  const markReady = useCallback(() => {
    setState((current) => {
      markPageKeyWarmed(current.key);
      return current.ready ? current : { ...current, ready: true };
    });
  }, []);

  const markRevealed = useCallback(() => {
    setState((current) =>
      current.revealed ? current : { ...current, revealed: true },
    );
  }, []);

  const value = useMemo<PageReadyValue>(
    () => ({
      ready: state.ready,
      revealed: state.revealed,
      markReady,
      markRevealed,
      isWaiting: !state.ready,
    }),
    [markReady, markRevealed, state.ready, state.revealed],
  );

  return (
    <PageReadyContext.Provider value={value}>
      {children}
    </PageReadyContext.Provider>
  );
}
