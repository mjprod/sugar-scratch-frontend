import { useEffect, useState } from "react";

const PAGE_SCROLL = "[data-page-scroll]";

/**
 * True while the app page scroller is moving; false after `idleMs` of rest.
 * Used to pause Shop aurora (CSS fallback stays) during scroll.
 */
export function usePageScrollActive(idleMs = 160) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(PAGE_SCROLL);
    if (!scroller) return;
    let timer = 0;
    const onScroll = () => {
      setActive((was) => was || true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setActive(false), idleMs);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [idleMs]);

  return active;
}
