import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  CreatorFeedCard,
  useVideoRegistry,
} from "@/components/home/CreatorFeedCard";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  FEED_WARM_AHEAD,
  FEED_WARM_BEHIND,
  fetchHomeFeedPage,
  isWarmFeedIndex,
  toPurchasePack,
  type HomeFeedCreator,
} from "@/services/creatorFeed";

const SNAP_MS = 220;
const AUTO_ADVANCE_MS = 10_000;
const DESKTOP_DRAG_THRESHOLD_PX = 6;
const DESKTOP_DRAG_FLICK_VX = 0.45;
const DESKTOP_DRAG_COMMIT_RATIO = 0.22;
const DESKTOP_BENTO_MQ = "(min-width: 1024px)";
/** Stronger than the full-page feed so the smaller Home tile still reads. */
const OVERLAY_PARALLAX = 0.38;
const OVERLAY_PARALLAX_MAX_PX = 56;
const MEDIA_SCALE_BASE = 1.08;
const MEDIA_SCALE_MAX = 1.28;
const MEDIA_SCALE_GAIN = MEDIA_SCALE_MAX - MEDIA_SCALE_BASE;
const MEDIA_BLUR_MAX_PX = 4;
const OVERLAY_PARALLAX_HALFLIFE_MS = 240;
const MEDIA_SCALE_HALFLIFE_MS = 280;
const OVERLAY_PARALLAX_SETTLE_EPS = 0.12;
const MEDIA_SCALE_SETTLE_EPS = 0.0002;

export function DiscoverReel({
  onBuyPack,
  onLikeAttempt,
  onOpenCreator,
  resumeLikeId = null,
  onResumeLikeConsumed,
}: {
  onBuyPack: (pack: {
    packId: string;
    packName: string;
    price: string;
    creator: string;
  }) => void;
  onLikeAttempt?: (itemId: string) => boolean;
  onOpenCreator?: (creatorId: string) => void;
  resumeLikeId?: string | null;
  onResumeLikeConsumed?: () => void;
}) {
  const desktop = useIsDesktopBento();
  const [items, setItems] = useState<HomeFeedCreator[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error" | "empty">(
    "idle",
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inView, setInView] = useState(false);
  const [isDesktopDragging, setIsDesktopDragging] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const rootRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useVideoRegistry();
  const loadingMoreRef = useRef(false);
  const resumeAutoAdvanceTimerRef = useRef(0);
  const parallaxTargetRef = useRef(new Map<string, number>());
  const parallaxCurrentRef = useRef(new Map<string, number>());
  const scaleTargetRef = useRef(new Map<string, number>());
  const scaleCurrentRef = useRef(new Map<string, number>());
  const blurTargetRef = useRef(new Map<string, number>());
  const blurCurrentRef = useRef(new Map<string, number>());
  const scrollFxRafRef = useRef(0);
  const scrollFxLastTsRef = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  const desktopDragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
    lastY: number;
    lastTs: number;
    velocityY: number;
    moved: boolean;
  } | null>(null);

  const loadInitial = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchHomeFeedPage(null);
      if (!page.items.length) {
        setItems([]);
        setStatus("empty");
        setActiveId(null);
        setCursor(null);
        setHasMore(false);
        return;
      }
      setItems(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setActiveId(page.items[0]?.id ?? null);
      setStatus("loaded");
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: 0 });
      });
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!desktop) return;
    if (status !== "idle") return;
    void loadInitial();
  }, [desktop, loadInitial, status]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !desktop) {
      setInView(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.35));
      },
      { threshold: [0, 0.35, 0.6] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [desktop]);

  const getSlideMetrics = useCallback((root: HTMLElement) => {
    const slide = root.querySelector<HTMLElement>(".hf-slide");
    const slideHeight = slide?.offsetHeight || root.clientHeight || 1;
    return { slideHeight };
  }, []);

  const applyScrollFx = useCallback(
    (root: HTMLElement) => {
      const slides = root.querySelectorAll<HTMLElement>(".hf-slide");
      if (!slides.length) return;
      const { slideHeight } = getSlideMetrics(root);
      const scrollTop = root.scrollTop;
      const approxIndex = Math.round(scrollTop / Math.max(1, slideHeight));
      const start = Math.max(0, approxIndex - 1);
      const end = Math.min(slides.length - 1, approxIndex + 1);

      const resetSlideFx = (slide: HTMLElement) => {
        const overlay = slide.querySelector<HTMLElement>(".hf-overlay");
        const media = slide.querySelector<HTMLElement>(".hf-media");
        overlay?.style.setProperty("--hf-parallax-y", "0px");
        media?.style.setProperty("--hf-media-scale", String(MEDIA_SCALE_BASE));
        media?.style.setProperty("--hf-media-blur", "0px");
      };

      if (reducedMotion) {
        slides.forEach((slide) => resetSlideFx(slide));
        if (scrollFxRafRef.current) {
          cancelAnimationFrame(scrollFxRafRef.current);
          scrollFxRafRef.current = 0;
        }
        scrollFxLastTsRef.current = 0;
        return;
      }

      for (const key of [...parallaxTargetRef.current.keys()]) {
        const idx = items.findIndex((item) => item.id === key);
        if (idx < start || idx > end) {
          parallaxTargetRef.current.delete(key);
          parallaxCurrentRef.current.delete(key);
          scaleTargetRef.current.delete(key);
          scaleCurrentRef.current.delete(key);
          blurTargetRef.current.delete(key);
          blurCurrentRef.current.delete(key);
          if (idx >= 0 && slides[idx]) resetSlideFx(slides[idx]);
        }
      }

      for (let index = start; index <= end; index += 1) {
        const key = items[index]?.id ?? String(index);
        const progress = (scrollTop - index * slideHeight) / slideHeight;
        const absProgress = Math.min(1, Math.abs(progress));
        const overlayRaw = -progress * slideHeight * OVERLAY_PARALLAX;
        parallaxTargetRef.current.set(
          key,
          Math.max(-OVERLAY_PARALLAX_MAX_PX, Math.min(OVERLAY_PARALLAX_MAX_PX, overlayRaw)),
        );
        scaleTargetRef.current.set(
          key,
          Math.min(MEDIA_SCALE_MAX, MEDIA_SCALE_BASE + absProgress * MEDIA_SCALE_GAIN),
        );
        blurTargetRef.current.set(
          key,
          Math.min(MEDIA_BLUR_MAX_PX, Math.max(0, progress) * MEDIA_BLUR_MAX_PX),
        );
      }

      if (scrollFxRafRef.current) return;

      const tick = (ts: number) => {
        const node = scrollerRef.current;
        if (!node) {
          scrollFxRafRef.current = 0;
          scrollFxLastTsRef.current = 0;
          return;
        }

        const last = scrollFxLastTsRef.current || ts;
        const dtMs = Math.min(48, Math.max(0, ts - last));
        scrollFxLastTsRef.current = ts;
        const overlayAlpha =
          1 - Math.exp((-Math.LN2 * dtMs) / OVERLAY_PARALLAX_HALFLIFE_MS);
        const mediaAlpha =
          1 - Math.exp((-Math.LN2 * dtMs) / MEDIA_SCALE_HALFLIFE_MS);

        const liveSlides = node.querySelectorAll<HTMLElement>(".hf-slide");
        const liveSlideHeight = getSlideMetrics(node).slideHeight;
        const liveIndex = Math.round(node.scrollTop / Math.max(1, liveSlideHeight));
        const liveStart = Math.max(0, liveIndex - 1);
        const liveEnd = Math.min(liveSlides.length - 1, liveIndex + 1);
        let drifting = false;

        for (let index = liveStart; index <= liveEnd; index += 1) {
          const key = items[index]?.id ?? String(index);
          const slide = liveSlides[index];
          const overlay = slide?.querySelector<HTMLElement>(".hf-overlay");
          const media = slide?.querySelector<HTMLElement>(".hf-media");

          const oTarget = parallaxTargetRef.current.get(key) ?? 0;
          const oCurrent = parallaxCurrentRef.current.get(key) ?? 0;
          const oNext = oCurrent + (oTarget - oCurrent) * overlayAlpha;
          const oSettled = Math.abs(oTarget - oNext) < OVERLAY_PARALLAX_SETTLE_EPS;
          const oValue = oSettled ? oTarget : oNext;
          parallaxCurrentRef.current.set(key, oValue);
          overlay?.style.setProperty("--hf-parallax-y", `${oValue.toFixed(3)}px`);
          if (!oSettled) drifting = true;

          const sTarget = scaleTargetRef.current.get(key) ?? MEDIA_SCALE_BASE;
          const sCurrent = scaleCurrentRef.current.get(key) ?? MEDIA_SCALE_BASE;
          const sNext = sCurrent + (sTarget - sCurrent) * mediaAlpha;
          const sSettled = Math.abs(sTarget - sNext) < MEDIA_SCALE_SETTLE_EPS;
          const sValue = sSettled ? sTarget : sNext;
          scaleCurrentRef.current.set(key, sValue);
          media?.style.setProperty("--hf-media-scale", sValue.toFixed(5));
          if (!sSettled) drifting = true;

          const bTarget = blurTargetRef.current.get(key) ?? 0;
          const bCurrent = blurCurrentRef.current.get(key) ?? 0;
          const bNext = bCurrent + (bTarget - bCurrent) * mediaAlpha;
          const bSettled = Math.abs(bTarget - bNext) < 0.01;
          const bValue = bSettled ? bTarget : bNext;
          blurCurrentRef.current.set(key, bValue);
          media?.style.setProperty("--hf-media-blur", `${bValue.toFixed(3)}px`);
          if (!bSettled) drifting = true;
        }

        if (drifting) {
          scrollFxRafRef.current = requestAnimationFrame(tick);
        } else {
          scrollFxRafRef.current = 0;
          scrollFxLastTsRef.current = 0;
        }
      };

      scrollFxLastTsRef.current = 0;
      scrollFxRafRef.current = requestAnimationFrame(tick);
    },
    [getSlideMetrics, items, reducedMotion],
  );

  useEffect(() => {
    return () => {
      if (scrollFxRafRef.current) cancelAnimationFrame(scrollFxRafRef.current);
    };
  }, []);

  useEffect(() => {
    const activeIndex = items.findIndex((item) => item.id === activeId);
    const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;
    const warmIds = new Set<string>();
    for (let offset = -FEED_WARM_BEHIND; offset <= FEED_WARM_AHEAD; offset += 1) {
      if (offset === 0) continue;
      const neighbor = items[resolvedActiveIndex + offset];
      if (neighbor) warmIds.add(neighbor.id);
    }

    const live = desktop && inView;
    videoRefs.current.forEach((video, id) => {
      if (!live) {
        video.pause();
        return;
      }
      if (id === activeId) {
        video.muted = true;
        void video.play().catch(() => {
          /* poster still shows */
        });
        return;
      }
      video.pause();
      if (!warmIds.has(id)) return;
      try {
        if (video.preload !== "auto") video.preload = "auto";
      } catch {
        /* ignore media errors on warm path */
      }
    });
  }, [activeId, desktop, inView, items, videoRefs]);

  const go = useCallback(
    (delta: number) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;
      const current = Math.round(root.scrollTop / slideHeight);
      const length = items.length;
      const next = ((current + delta) % length + length) % length;
      const wraps = Math.abs(next - current) > 1;
      root.scrollTo({
        top: next * slideHeight,
        behavior: reducedMotion || wraps ? "auto" : "smooth",
      });
      applyScrollFx(root);
    },
    [applyScrollFx, getSlideMetrics, items.length, reducedMotion],
  );

  const stopAutoAdvance = useCallback(() => {
    setAutoAdvance(false);
    if (resumeAutoAdvanceTimerRef.current) {
      window.clearTimeout(resumeAutoAdvanceTimerRef.current);
    }
    resumeAutoAdvanceTimerRef.current = window.setTimeout(() => {
      resumeAutoAdvanceTimerRef.current = 0;
      setAutoAdvance(true);
    }, AUTO_ADVANCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeAutoAdvanceTimerRef.current) {
        window.clearTimeout(resumeAutoAdvanceTimerRef.current);
      }
    };
  }, []);

  const goFromUser = useCallback(
    (delta: number) => {
      stopAutoAdvance();
      go(delta);
    },
    [go, stopAutoAdvance],
  );

  useEffect(() => {
    if (
      !autoAdvance ||
      !desktop ||
      !inView ||
      reducedMotion ||
      status !== "loaded" ||
      items.length < 2
    ) {
      return;
    }

    const id = window.setInterval(() => {
      const root = scrollerRef.current;
      if (!root) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;
      const index = Math.round(root.scrollTop / slideHeight);
      if (index >= items.length - 1) return;
      go(1);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(id);
  }, [
    autoAdvance,
    desktop,
    getSlideMetrics,
    go,
    inView,
    items.length,
    reducedMotion,
    status,
  ]);

  const snapAfterDesktopDrag = useCallback(
    (startScrollTop: number, velocityY = 0) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;

      const startIndex = Math.round(startScrollTop / slideHeight);
      const deltaPx = root.scrollTop - startScrollTop;
      const deltaSlides = deltaPx / slideHeight;
      const flicked = Math.abs(velocityY) >= DESKTOP_DRAG_FLICK_VX;

      let target = startIndex;
      if (deltaSlides >= DESKTOP_DRAG_COMMIT_RATIO || (flicked && velocityY < 0 && deltaSlides > 0.02)) {
        target = startIndex + 1;
      } else if (
        deltaSlides <= -DESKTOP_DRAG_COMMIT_RATIO ||
        (flicked && velocityY > 0 && deltaSlides < -0.02)
      ) {
        target = startIndex - 1;
      }

      const length = items.length;
      const wrapped = ((target % length) + length) % length;
      const wraps = Math.abs(wrapped - startIndex) > 1;
      root.scrollTo({
        top: wrapped * slideHeight,
        behavior: reducedMotion || wraps ? "auto" : "smooth",
      });
      applyScrollFx(root);
    },
    [applyScrollFx, getSlideMetrics, items.length, reducedMotion],
  );

  const isDragFromInteractive = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, a, input, textarea, select, label, [role='button'], [data-no-feed-drag]",
      ),
    );
  }, []);

  const onDesktopPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!desktop || !inView) return;
      if (event.button !== 0) return;
      stopAutoAdvance();
      if (isDragFromInteractive(event.target)) return;

      const root = scrollerRef.current;
      if (!root) return;

      desktopDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollTop: root.scrollTop,
        lastY: event.clientY,
        lastTs: event.timeStamp,
        velocityY: 0,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [desktop, inView, isDragFromInteractive, stopAutoAdvance],
  );

  const onDesktopPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = desktopDragRef.current;
      const root = scrollerRef.current;
      if (!drag || !root || event.pointerId !== drag.pointerId) return;

      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.abs(dy) < DESKTOP_DRAG_THRESHOLD_PX) return;

      if (!drag.moved) {
        drag.moved = true;
        setIsDesktopDragging(true);
        root.style.scrollSnapType = "none";
        root.style.scrollBehavior = "auto";
      }

      const now = event.timeStamp;
      const dt = Math.max(1, now - drag.lastTs);
      const frameDy = event.clientY - drag.lastY;
      const instant = frameDy / dt;
      drag.velocityY = drag.velocityY * 0.7 + instant * 0.3;
      drag.lastY = event.clientY;
      drag.lastTs = now;
      root.scrollTop = drag.startScrollTop - dy;
      applyScrollFx(root);
      event.preventDefault();
    },
    [applyScrollFx],
  );

  const endDesktopPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = desktopDragRef.current;
      const root = scrollerRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const startScrollTop = drag.startScrollTop;
      const velocityY = drag.velocityY;
      const moved = drag.moved;

      desktopDragRef.current = null;
      setIsDesktopDragging(false);

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }

      if (!root) return;
      root.style.scrollSnapType = "none";
      root.style.scrollBehavior = "";

      if (!moved) {
        root.style.scrollSnapType = "";
        return;
      }

      snapAfterDesktopDrag(startScrollTop, velocityY);
      window.setTimeout(() => {
        if (!scrollerRef.current) return;
        if (!desktopDragRef.current) {
          scrollerRef.current.style.scrollSnapType = "";
        }
      }, reducedMotion ? 0 : SNAP_MS + 80);
    },
    [reducedMotion, snapAfterDesktopDrag],
  );

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !desktop || status !== "loaded") return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const page = root.closest<HTMLElement>("[data-page-scroll]");
      if (page) page.scrollTop += event.deltaY;
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [desktop, status]);

  async function loadMore() {
    if (!hasMore || loadingMoreRef.current || !cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchHomeFeedPage(cursor);
      setItems((prev) => {
        const seenIds = new Set(prev.map((item) => item.id));
        const seenVideos = new Set(
          prev.map((item) => item.videoUrl).filter((url): url is string => Boolean(url)),
        );
        const next = page.items.filter((item) => {
          if (seenIds.has(item.id)) return false;
          if (item.videoUrl && seenVideos.has(item.videoUrl)) return false;
          return true;
        });
        return [...prev, ...next];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      /* keep browsing loaded cards */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (status !== "loaded") return;
    const activeIndex = items.findIndex((item) => item.id === activeId);
    const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;
    const remaining = items.length - 1 - resolvedActiveIndex;
    if (remaining <= FEED_WARM_AHEAD) void loadMore();
  }, [activeId, items.length, status]);

  function onScroll() {
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    const { slideHeight } = getSlideMetrics(root);
    const index = Math.round(root.scrollTop / slideHeight);
    const next = items[Math.max(0, Math.min(items.length - 1, index))];
    if (next && next.id !== activeId) setActiveId(next.id);
    applyScrollFx(root);
    const remaining = items.length - 1 - index;
    if (remaining <= FEED_WARM_AHEAD) void loadMore();
  }

  function toggleLike(id: string) {
    stopAutoAdvance();
    if (onLikeAttempt && !onLikeAttempt(id)) return;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, liked: !item.liked } : item)),
    );
  }

  function ensureLike(id: string): boolean {
    stopAutoAdvance();
    const already = items.some((item) => item.id === id && item.liked);
    if (already) return true;
    if (onLikeAttempt && !onLikeAttempt(id)) return false;
    setItems((prev) => {
      if (prev.some((item) => item.id === id && item.liked)) return prev;
      return prev.map((item) => (item.id === id ? { ...item, liked: true } : item));
    });
    return true;
  }

  useEffect(() => {
    if (!resumeLikeId) return;
    let matched = false;
    setItems((prev) => {
      matched = prev.some((item) => item.id === resumeLikeId);
      if (!matched) return prev;
      return prev.map((item) =>
        item.id === resumeLikeId ? { ...item, liked: true } : item,
      );
    });
    if (matched) onResumeLikeConsumed?.();
  }, [onResumeLikeConsumed, resumeLikeId]);

  if (!desktop) return null;

  const live = inView;
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <section
      ref={rootRef}
      className={["hf-page", "hf-page--embed", live ? "is-active" : "is-inactive"].join(" ")}
      aria-label="Discover video reel"
    >
      <div className="hf-stage">
        {status === "loaded" && items.length > 1 ? (
          <div className="hf-stepper" aria-label="Feed navigation">
            <button
              type="button"
              className="hf-stepper-btn glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
              aria-label="Previous creator"
              data-no-feed-drag
              disabled={resolvedActiveIndex <= 0}
              onClick={() => {
                if (resolvedActiveIndex <= 0) return;
                goFromUser(-1);
              }}
            >
              <ChevronUp className="hf-stepper-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hf-stepper-btn glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
              aria-label="Next creator"
              data-no-feed-drag
              disabled={resolvedActiveIndex >= items.length - 1}
              onClick={() => {
                if (resolvedActiveIndex >= items.length - 1) return;
                goFromUser(1);
              }}
            >
              <ChevronDown className="hf-stepper-icon" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="hf-frame">
          {status === "loading" || status === "idle" ? (
            <div className="hf-state" aria-busy="true">
              <div className="hf-skeleton" />
            </div>
          ) : null}

          {status === "error" ? (
            <div className="hf-state" role="alert">
              <p className="hf-state-title">Unable to load creators.</p>
              <div className="hf-state-cta">
                <CtaButton
                  {...ctaButtonPropsFromTemplate("squircleCTA")}
                  fillParent
                  type="button"
                  label="Retry"
                  costAmount={null}
                  fontSize={15}
                  strokeWidth={1}
                  onClick={() => void loadInitial()}
                />
              </div>
            </div>
          ) : null}

          {status === "empty" ? (
            <div className="hf-state">
              <p className="hf-state-title">No creators available.</p>
              <p className="hf-state-copy">Please check back later.</p>
            </div>
          ) : null}

          {status === "loaded" ? (
            <div
              ref={scrollerRef}
              className={["hf-viewport", isDesktopDragging ? "is-desktop-dragging" : ""]
                .filter(Boolean)
                .join(" ")}
              onScroll={onScroll}
              onPointerDown={onDesktopPointerDown}
              onPointerMove={onDesktopPointerMove}
              onPointerUp={endDesktopPointerDrag}
              onPointerCancel={endDesktopPointerDrag}
              style={
                reducedMotion
                  ? undefined
                  : ({
                      scrollBehavior: "smooth",
                      "--hf-snap-ms": `${SNAP_MS}ms`,
                    } as CSSProperties)
              }
            >
              {(() => {
                return items.map((item, index) => {
                  const warm = isWarmFeedIndex(index, resolvedActiveIndex);

                  return (
                    <div key={item.id} className="hf-slide">
                      <CreatorFeedCard
                        item={item}
                        active={live && item.id === activeId}
                        warm={warm}
                        buyCta="pillGoldCTA"
                        onLike={() => toggleLike(item.id)}
                        onEnsureLike={() => ensureLike(item.id)}
                        onBuy={() => {
                          stopAutoAdvance();
                          onBuyPack(toPurchasePack(item));
                        }}
                        onOpenCreator={
                          onOpenCreator
                            ? (creatorId) => {
                                stopAutoAdvance();
                                onOpenCreator(creatorId);
                              }
                            : undefined
                        }
                        videoRef={(node) => {
                          if (node) videoRefs.current.set(item.id, node);
                          else videoRefs.current.delete(item.id);
                        }}
                      />
                    </div>
                  );
                });
              })()}
              {loadingMore ? (
                <div className="hf-loading-more" aria-live="polite">
                  Loading more…
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function useIsDesktopBento() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_BENTO_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_BENTO_MQ);
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return desktop;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
