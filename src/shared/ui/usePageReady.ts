import { createContext, useContext, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { markPageKeyWarmed, pageKey } from "@/shared/ui/pageWarmth";

export type PageReadyValue = {
  ready: boolean;
  markReady: () => void;
  isWaiting: boolean;
};

export const PageReadyContext = createContext<PageReadyValue | null>(null);

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

/** Dismiss the site preloader once this route's first useful view is ready. */
export function useMarkPageReady(isReady: boolean) {
  const location = useLocation();
  const { markReady } = usePageReady();
  if (isReady) {
    markPageKeyWarmed(pageKey(location.pathname, location.search));
  }
  useLayoutEffect(() => {
    if (isReady) markReady();
  }, [isReady, markReady]);
}
