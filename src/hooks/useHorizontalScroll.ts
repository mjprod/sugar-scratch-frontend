import { useCallback, useEffect, useRef, useState } from "react";

/** Horizontal overflow + page-step scroll for a row of items. */
export function useHorizontalScroll(itemSelector: string, revision = 0) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(max - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => updateScrollState();
    measure();
    const raf = window.requestAnimationFrame(measure);
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      window.cancelAnimationFrame(raf);
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [revision, updateScrollState]);

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>(itemSelector);
      const styles = window.getComputedStyle(el);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 14;
      const cardWidth = card?.offsetWidth ?? 148;
      const step = cardWidth + gap;
      const visible = Math.max(1, Math.floor((el.clientWidth + gap) / step));
      const page = Math.max(1, visible > 1 ? visible - 1 : 1);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      el.scrollBy({
        left: direction * page * step,
        behavior: reduce ? "auto" : "smooth",
      });
    },
    [itemSelector],
  );

  const canScroll = canScrollLeft || canScrollRight;

  return {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    canScroll,
    scrollByPage,
    updateScrollState,
  };
}
