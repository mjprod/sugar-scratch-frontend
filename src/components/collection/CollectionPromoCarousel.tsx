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
  const [dragging, setDragging] = useState(false);
  const indexRef = useRef(0);
  const pauseUntilRef = useRef(0);
  const userScrollingRef = useRef(false);
  const programmaticRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);
  const slideCount = PROMO_SLIDES.length;

  const setIndexSafe = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, next));
    if (clamped === indexRef.current) return;
    indexRef.current = clamped;
    setIndex(clamped);
  }, [slideCount]);

  const scrollToIndex = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el) return;
      const target = Math.max(0, Math.min(slideCount - 1, i));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      programmaticRef.current = true;
      setIndexSafe(target);
      el.scrollTo({
        left: target * el.clientWidth,
        behavior: reduce ? "auto" : behavior,
      });
    },
    [setIndexSafe, slideCount],
  );

  const syncFromScroll = useCallback(() => {
    if (programmaticRef.current) return;
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
      if (programmaticRef.current) {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          programmaticRef.current = false;
        }, 80);
        return;
      }
      syncFromScroll();
      if (!userScrollingRef.current) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        userScrollingRef.current = false;
        pauseUntilRef.current = performance.now() + RESUME_MS;
      }, 180);
    };

    const markUser = () => {
      programmaticRef.current = false;
      userScrollingRef.current = true;
      pauseUntilRef.current = performance.now() + RESUME_MS;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      markUser();
      if (event.pointerType !== "mouse") return;
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScroll: el.scrollLeft,
        moved: false,
      };
      el.setPointerCapture(event.pointerId);
      setDragging(true);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) > 4) drag.moved = true;
      if (!drag.moved) return;
      event.preventDefault();
      el.scrollLeft = drag.startScroll - dx;
    };

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
      syncFromScroll();
      scrollToIndex(indexRef.current, "smooth");
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("touchstart", markUser, { passive: true });
    el.addEventListener("wheel", markUser, { passive: true });

    const ro = new ResizeObserver(() => {
      const node = scrollerRef.current;
      if (!node) return;
      programmaticRef.current = true;
      node.scrollTo({
        left: indexRef.current * node.clientWidth,
        behavior: "auto",
      });
    });
    ro.observe(el);

    return () => {
      window.clearTimeout(settleTimer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("touchstart", markUser);
      el.removeEventListener("wheel", markUser);
      ro.disconnect();
    };
  }, [scrollToIndex, syncFromScroll]);

  useEffect(() => {
    if (slideCount <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tick = window.setInterval(() => {
      if (performance.now() < pauseUntilRef.current) return;
      if (userScrollingRef.current) return;
      if (dragRef.current) return;
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
        className={["mc-promo-track", dragging ? "is-dragging" : ""].filter(Boolean).join(" ")}
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
      <div
        className="mc-promo-pager"
        role="tablist"
        aria-label="Promo slides"
        style={{ ["--mc-promo-index" as string]: String(index) }}
      >
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
