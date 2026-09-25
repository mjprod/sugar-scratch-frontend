import { useCallback, useEffect, useRef, useState } from "react";

const PROMO_SLIDES = [
  {
    id: "promo-01",
    src: "/img/figma-my-collection/86d4f39478b36d507194017d10f86c3f93bb849f.png",
    alt: "Collection promo",
  },
  {
    id: "promo-02",
    src: "/img/figma-my-collection/1d9af28cb93cd6d47151fef2a48c01962ccfd627.png",
    alt: "Collection promo",
  },
] as const;

const AUTO_MS = 3000;
const RESUME_MS = 5000;

/** Figma MyCollection promo strip — auto-advances every 3s with synced dots. */
export function CollectionPromoCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const pauseUntilRef = useRef(0);
  const userScrollingRef = useRef(false);
  const slideCount = PROMO_SLIDES.length;

  const setIndexSafe = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, next));
    indexRef.current = clamped;
    setIndex(clamped);
  }, [slideCount]);

  const scrollToIndex = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el) return;
      const target = Math.max(0, Math.min(slideCount - 1, i));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({
        left: target * el.clientWidth,
        behavior: reduce ? "auto" : behavior,
      });
      setIndexSafe(target);
    },
    [setIndexSafe, slideCount],
  );

  const syncIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / width);
    setIndexSafe(next);
  }, [setIndexSafe]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let settleTimer = 0;
    const onScroll = () => {
      syncIndexFromScroll();
      if (!userScrollingRef.current) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        userScrollingRef.current = false;
        pauseUntilRef.current = performance.now() + RESUME_MS;
      }, 180);
    };

    const markUser = () => {
      userScrollingRef.current = true;
      pauseUntilRef.current = performance.now() + RESUME_MS;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", markUser, { passive: true });
    el.addEventListener("touchstart", markUser, { passive: true });
    el.addEventListener("wheel", markUser, { passive: true });

    const ro = new ResizeObserver(() => {
      // Keep the active slide aligned after layout changes.
      scrollToIndex(indexRef.current, "auto");
    });
    ro.observe(el);

    return () => {
      window.clearTimeout(settleTimer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", markUser);
      el.removeEventListener("touchstart", markUser);
      el.removeEventListener("wheel", markUser);
      ro.disconnect();
    };
  }, [scrollToIndex, syncIndexFromScroll]);

  useEffect(() => {
    if (slideCount <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tick = window.setInterval(() => {
      if (performance.now() < pauseUntilRef.current) return;
      if (userScrollingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const next = (indexRef.current + 1) % slideCount;
      scrollToIndex(next, "smooth");
    }, AUTO_MS);

    return () => window.clearInterval(tick);
  }, [scrollToIndex, slideCount]);

  function goTo(i: number) {
    pauseUntilRef.current = performance.now() + RESUME_MS;
    scrollToIndex(i, "smooth");
  }

  return (
    <div className="mc-promo" aria-label="Promotions" aria-roledescription="carousel">
      <div
        ref={scrollerRef}
        className="mc-promo-track"
        tabIndex={0}
        aria-live="polite"
      >
        {PROMO_SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className="mc-promo-slide"
            aria-hidden={i !== index}
          >
            <img src={slide.src} alt={slide.alt} draggable={false} />
          </div>
        ))}
      </div>
      <div className="mc-promo-pager" role="tablist" aria-label="Promo slides">
        <span className="mc-promo-pager-pill" aria-hidden="true" />
        {PROMO_SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Promo ${i + 1}`}
            className={["mc-promo-dot", i === index ? "is-active" : ""].join(" ")}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
