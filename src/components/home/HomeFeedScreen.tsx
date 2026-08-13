import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  CreatorFeedCard,
  useVideoRegistry,
} from "@/components/home/CreatorFeedCard";
import {
  fetchHomeFeedPage,
  readHomeFeedCache,
  toPurchasePack,
  writeHomeFeedCache,
  type HomeFeedCreator,
} from "@/services/creatorFeed";

const SNAP_MS = 220;
/** Overlay lag vs video (0 = locked, 1 = fully detached). */
const OVERLAY_PARALLAX = 0.22;
/** Max overlay drift in px (keeps CTAs readable). */
const OVERLAY_PARALLAX_MAX_PX = 44;
/**
 * Overlay settle half-life in ms (time-based damping).
 * Higher = silkier / less stutter; lower = snappier.
 */
const OVERLAY_PARALLAX_HALFLIFE_MS = 150;
/** Media scale settle half-life — keep slightly softer than overlay. */
const MEDIA_SCALE_HALFLIFE_MS = 175;
/** Snap when within this many px of target. */
const OVERLAY_PARALLAX_SETTLE_EPS = 0.12;
/** Resting media scale inside overflow-hidden frame (keep near 1 so first frame isn't cropped). */
const MEDIA_SCALE_BASE = 1.04;
/** Extra scale added at full slide travel (more scroll → more zoom). */
const MEDIA_SCALE_GAIN = 0.1;
/** Hard ceiling so zoom stays tasteful. */
const MEDIA_SCALE_MAX = 1.16;
/** Max scroll-driven media blur (px). Desktop only — mobile skips filter blur. */
const MEDIA_BLUR_MAX_PX = 5;
/** Blur reaches max sooner than scale (1 = linear with scroll, higher = faster). */
const MEDIA_BLUR_PROGRESS_GAIN = 1.75;
/** How close scale must get before we snap to target (smaller = smoother end). */
const MEDIA_SCALE_SETTLE_EPS = 0.0002;
/** Desktop drag: ignore tiny pointer jitter before treating as a swipe. */
const DESKTOP_DRAG_THRESHOLD_PX = 6;
/** Desktop drag: velocity (px/ms) needed to advance a slide on release. */
const DESKTOP_DRAG_FLICK_VX = 0.55;

export function HomeFeedScreen({
  active,
  resumeLikeId = null,
  onResumeLikeConsumed,
  onBuyPack,
  onLikeAttempt,
  onOpenCreator,
  personalizationPrompt = null,
}: {
  /** When false, stay mounted but pause media (preserve scroll). */
  active: boolean;
  /** After auth, apply this like without a second tap. */
  resumeLikeId?: string | null;
  onResumeLikeConsumed?: () => void;
  onBuyPack: (pack: {
    packId: string;
    packName: string;
    price: string;
    creator: string;
  }) => void;
  /** Guest like gate — return false to block toggle. */
  onLikeAttempt?: (itemId: string) => boolean;
  onOpenCreator?: (creatorId: string) => void;
  personalizationPrompt?: ReactNode;
}) {
  const cached = readHomeFeedCache();
  const [items, setItems] = useState<HomeFeedCreator[]>(cached?.items ?? []);
  const [status, setStatus] = useState<"loading" | "loaded" | "error" | "empty">(
    cached?.items.length ? "loaded" : "loading",
  );
  const [activeId, setActiveId] = useState<string | null>(
    cached?.activeId ?? null,
  );
  const [cursor, setCursor] = useState<string | null>(cached?.cursor ?? null);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useVideoRegistry();
  const loadingMoreRef = useRef(false);
  const scrollIndexRef = useRef(cached?.scrollIndex ?? 0);
  const restoredRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const allowMediaBlur = useAllowMediaBlur();
  const parallaxTargetRef = useRef(new Map<string, number>());
  const parallaxCurrentRef = useRef(new Map<string, number>());
  const scaleTargetRef = useRef(new Map<string, number>());
  const scaleCurrentRef = useRef(new Map<string, number>());
  const blurTargetRef = useRef(new Map<string, number>());
  const blurCurrentRef = useRef(new Map<string, number>());
  const scrollFxRafRef = useRef(0);
  const scrollFxLastTsRef = useRef(0);
  const [isDesktopDragging, setIsDesktopDragging] = useState(false);
  const desktopDragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
    lastY: number;
    lastTs: number;
    velocityY: number;
    moved: boolean;
  } | null>(null);

  const persist = useCallback(
    (patch: Partial<{
      items: HomeFeedCreator[];
      cursor: string | null;
      hasMore: boolean;
      activeId: string | null;
      scrollIndex: number;
    }>) => {
      const base = readHomeFeedCache() ?? {
        items,
        cursor,
        hasMore,
        activeId,
        scrollIndex: scrollIndexRef.current,
      };
      writeHomeFeedCache({ ...base, ...patch });
    },
    [activeId, cursor, hasMore, items],
  );

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
        writeHomeFeedCache({
          items: [],
          cursor: null,
          hasMore: false,
          activeId: null,
          scrollIndex: 0,
        });
        return;
      }
      setItems(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setActiveId(page.items[0]?.id ?? null);
      scrollIndexRef.current = 0;
      setStatus("loaded");
      writeHomeFeedCache({
        items: page.items,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
        activeId: page.items[0]?.id ?? null,
        scrollIndex: 0,
      });
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: 0 });
      });
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (cached?.items.length) return;
    void loadInitial();
  }, [cached?.items.length, loadInitial]);

  const getSlideMetrics = useCallback((root: HTMLElement) => {
    const slide = root.querySelector<HTMLElement>(".hf-slide");
    const slideHeight = slide?.offsetHeight || root.clientHeight || 1;
    return { slideHeight };
  }, []);

  const applyScrollFx = useCallback(
    (root: HTMLElement, immediate = false) => {
      const slides = root.querySelectorAll<HTMLElement>(".hf-slide");
      if (!slides.length) return;

      const { slideHeight } = getSlideMetrics(root);
      const scrollTop = root.scrollTop;
      const approxIndex = Math.round(scrollTop / Math.max(1, slideHeight));
      // Only animate the active slide and its immediate neighbors.
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
        parallaxTargetRef.current.clear();
        parallaxCurrentRef.current.clear();
        scaleTargetRef.current.clear();
        scaleCurrentRef.current.clear();
        blurTargetRef.current.clear();
        blurCurrentRef.current.clear();
        if (scrollFxRafRef.current) {
          cancelAnimationFrame(scrollFxRafRef.current);
          scrollFxRafRef.current = 0;
        }
        scrollFxLastTsRef.current = 0;
        return;
      }

      // Clear stale targets outside the active window so they don't keep ticking.
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
        const slideTop = index * slideHeight;
        const progress = (scrollTop - slideTop) / slideHeight;
        const absProgress = Math.min(1, Math.abs(progress));

        // Overlay lags the video (signed travel).
        const overlayRaw = -progress * slideHeight * OVERLAY_PARALLAX;
        const overlayTarget = Math.max(
          -OVERLAY_PARALLAX_MAX_PX,
          Math.min(OVERLAY_PARALLAX_MAX_PX, overlayRaw),
        );
        parallaxTargetRef.current.set(key, overlayTarget);

        // More scroll away from rest → more zoom inside overflow:hidden.
        const scaleTarget = Math.min(
          MEDIA_SCALE_MAX,
          MEDIA_SCALE_BASE + absProgress * MEDIA_SCALE_GAIN,
        );
        scaleTargetRef.current.set(key, scaleTarget);

        // Blur only on exit (leaving upward). Incoming/next peek stays sharp.
        // Mobile: skip expensive filter blur; keep scale + parallax.
        const exitProgress = Math.max(0, progress);
        const blurTarget = allowMediaBlur
          ? Math.min(
              MEDIA_BLUR_MAX_PX,
              exitProgress * MEDIA_BLUR_PROGRESS_GAIN * MEDIA_BLUR_MAX_PX,
            )
          : 0;
        blurTargetRef.current.set(key, blurTarget);

        if (immediate) {
          const slide = slides[index];
          const overlay = slide?.querySelector<HTMLElement>(".hf-overlay");
          const media = slide?.querySelector<HTMLElement>(".hf-media");
          parallaxCurrentRef.current.set(key, overlayTarget);
          scaleCurrentRef.current.set(key, scaleTarget);
          blurCurrentRef.current.set(key, blurTarget);
          overlay?.style.setProperty(
            "--hf-parallax-y",
            `${overlayTarget.toFixed(3)}px`,
          );
          media?.style.setProperty(
            "--hf-media-scale",
            scaleTarget.toFixed(5),
          );
          media?.style.setProperty(
            "--hf-media-blur",
            `${blurTarget.toFixed(3)}px`,
          );
        }
      }

      if (immediate) return;
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
        // Frame-rate independent exponential smoothing.
        const overlayAlpha =
          1 - Math.exp((-Math.LN2 * dtMs) / OVERLAY_PARALLAX_HALFLIFE_MS);
        // Keep media a touch softer than overlay so UI leads slightly.
        const mediaAlpha =
          1 - Math.exp((-Math.LN2 * dtMs) / MEDIA_SCALE_HALFLIFE_MS);

        const liveSlides = node.querySelectorAll<HTMLElement>(".hf-slide");
        const liveSlideHeight = getSlideMetrics(node).slideHeight;
        const liveIndex = Math.round(
          node.scrollTop / Math.max(1, liveSlideHeight),
        );
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
          overlay?.style.setProperty(
            "--hf-parallax-y",
            `${oValue.toFixed(3)}px`,
          );
          if (!oSettled) drifting = true;

          const sTarget = scaleTargetRef.current.get(key) ?? MEDIA_SCALE_BASE;
          const sCurrent =
            scaleCurrentRef.current.get(key) ?? MEDIA_SCALE_BASE;
          const sNext = sCurrent + (sTarget - sCurrent) * mediaAlpha;
          const sSettled = Math.abs(sTarget - sNext) < MEDIA_SCALE_SETTLE_EPS;
          const sValue = sSettled ? sTarget : sNext;
          scaleCurrentRef.current.set(key, sValue);
          media?.style.setProperty(
            "--hf-media-scale",
            sValue.toFixed(5),
          );
          if (!sSettled) drifting = true;

          const bTarget = blurTargetRef.current.get(key) ?? 0;
          const bCurrent = blurCurrentRef.current.get(key) ?? 0;
          const bNext = bCurrent + (bTarget - bCurrent) * mediaAlpha;
          const bSettled = Math.abs(bTarget - bNext) < 0.01;
          const bValue = bSettled ? bTarget : bNext;
          blurCurrentRef.current.set(key, bValue);
          media?.style.setProperty(
            "--hf-media-blur",
            `${bValue.toFixed(3)}px`,
          );
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
    [allowMediaBlur, getSlideMetrics, items, reducedMotion],
  );

  useEffect(() => {
    if (status !== "loaded" || restoredRef.current) return;
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    restoredRef.current = true;
    const { slideHeight } = getSlideMetrics(root);
    const index = Math.min(
      scrollIndexRef.current,
      Math.max(0, items.length - 1),
    );
    root.scrollTo({ top: index * slideHeight });
    const next = items[index];
    if (next) setActiveId(next.id);
    applyScrollFx(root, true);
  }, [status, items, getSlideMetrics, applyScrollFx]);

  useEffect(() => {
    return () => {
      if (scrollFxRafRef.current) {
        cancelAnimationFrame(scrollFxRafRef.current);
        scrollFxRafRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    const activeIndex = items.findIndex((item) => item.id === activeId);
    const warmIds = new Set<string>();
    if (activeIndex >= 0) {
      // Next card is visible in the bottom peek — always warm it.
      const nextItem = items[activeIndex + 1];
      const prevItem = items[activeIndex - 1];
      if (nextItem) warmIds.add(nextItem.id);
      if (prevItem) warmIds.add(prevItem.id);
    } else if (items[1]) {
      // Before activeId settles, still warm the second slide for initial peek.
      warmIds.add(items[1].id);
    }

    videoRefs.current.forEach((video, id) => {
      if (!active) {
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

      // Eager-buffer neighbors so the next-video peek isn't black frames.
      if (warmIds.has(id)) {
        try {
          if (video.preload !== "auto") video.preload = "auto";
          // Kick the network pipeline without playing (iOS-friendly).
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            void video.play().then(() => {
              video.pause();
              try {
                video.currentTime = 0;
              } catch {
                /* ignore seek errors */
              }
            }).catch(() => {
              /* poster still shows */
            });
          }
        } catch {
          /* ignore media errors on warm path */
        }
      }
    });
  }, [active, activeId, items, videoRefs]);

  const go = useCallback(
    (delta: number) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;
      const next = Math.round(root.scrollTop / slideHeight) + delta;
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      root.scrollTo({
        top: clamped * slideHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [getSlideMetrics, items.length, reducedMotion],
  );

  const snapToNearest = useCallback(
    (velocityY = 0) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;

      const current = root.scrollTop / slideHeight;
      let target = Math.round(current);
      // Flick intent: if moving fast enough, advance in the swipe direction.
      // velocityY > 0 means pointer moved down → content should go up (prev).
      if (Math.abs(velocityY) >= DESKTOP_DRAG_FLICK_VX) {
        target = velocityY > 0 ? Math.floor(current) : Math.ceil(current);
        if (velocityY > 0) target = Math.min(target, Math.floor(current));
        else target = Math.max(target, Math.ceil(current));
        // Prefer one step from the starting-ish index when flicking.
        const from = Math.round(
          (desktopDragRef.current?.startScrollTop ?? root.scrollTop) /
            slideHeight,
        );
        target = velocityY > 0 ? from - 1 : from + 1;
      }

      const clamped = Math.max(0, Math.min(items.length - 1, target));
      root.scrollTo({
        top: clamped * slideHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [getSlideMetrics, items.length, reducedMotion],
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
      if (!active) return;
      // Touch already has native pan-y scrolling; this is for mouse/pen drag.
      if (event.pointerType === "touch") return;
      if (event.button !== 0) return;
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

      // Capture so drag continues even if the cursor leaves the frame.
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [active, isDragFromInteractive],
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
        // Disable snap while dragging so the frame follows the pointer 1:1.
        root.style.scrollSnapType = "none";
        root.style.scrollBehavior = "auto";
      }

      const now = event.timeStamp;
      const dt = Math.max(1, now - drag.lastTs);
      const frameDy = event.clientY - drag.lastY;
      // EMA velocity for flick detection on release.
      const instant = frameDy / dt;
      drag.velocityY = drag.velocityY * 0.7 + instant * 0.3;
      drag.lastY = event.clientY;
      drag.lastTs = now;

      // Drag down → previous (scroll up): invert delta like native touch.
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

      desktopDragRef.current = null;
      setIsDesktopDragging(false);

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }

      if (!root) return;

      root.style.scrollSnapType = "";
      root.style.scrollBehavior = "";

      if (!drag.moved) return;
      snapToNearest(drag.velocityY);
    },
    [snapToNearest],
  );

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      // Don't steal keys while typing in inputs / contenteditable.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === "j"
      ) {
        event.preventDefault();
        go(1);
      } else if (
        event.key === "ArrowUp" ||
        event.key === "PageUp" ||
        event.key === "k"
      ) {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        const root = scrollerRef.current;
        root?.scrollTo({
          top: 0,
          behavior: reducedMotion ? "auto" : "smooth",
        });
      } else if (event.key === "End") {
        event.preventDefault();
        const root = scrollerRef.current;
        if (!root || !items.length) return;
        const { slideHeight } = getSlideMetrics(root);
        root.scrollTo({
          top: Math.max(0, items.length - 1) * slideHeight,
          behavior: reducedMotion ? "auto" : "smooth",
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, getSlideMetrics, go, items.length, reducedMotion]);

  async function loadMore() {
    if (!hasMore || loadingMoreRef.current || !cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchHomeFeedPage(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const next = page.items.filter((item) => !seen.has(item.id));
        const merged = [...prev, ...next];
        persist({
          items: merged,
          cursor: page.nextCursor,
          hasMore: page.hasMore,
        });
        return merged;
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

  function onScroll() {
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    const { slideHeight } = getSlideMetrics(root);
    const index = Math.round(root.scrollTop / slideHeight);
    scrollIndexRef.current = index;
    const next = items[Math.max(0, Math.min(items.length - 1, index))];
    if (next && next.id !== activeId) {
      setActiveId(next.id);
      persist({ activeId: next.id, scrollIndex: index });
    } else {
      persist({ scrollIndex: index });
    }

    applyScrollFx(root);

    const remaining = items.length - 1 - index;
    if (remaining <= 2) void loadMore();
  }

  function toggleLike(id: string) {
    if (onLikeAttempt && !onLikeAttempt(id)) return;
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, liked: !item.liked } : item,
      );
      persist({ items: next });
      return next;
    });
  }

  useEffect(() => {
    if (!resumeLikeId) return;
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === resumeLikeId ? { ...item, liked: true } : item,
      );
      persist({ items: next });
      return next;
    });
    onResumeLikeConsumed?.();
  }, [resumeLikeId, onResumeLikeConsumed, persist]);

  return (
    <section
      className={["hf-page", active ? "is-active" : "is-inactive"].join(" ")}
      aria-label="Home Feed"
      aria-hidden={!active}
      {...(!active ? { inert: true } : {})}
    >
      {personalizationPrompt}
      <div className="hf-frame">
        {status === "loading" ? (
          <div className="hf-state" aria-busy="true">
            <div className="hf-skeleton" />
          </div>
        ) : null}

        {status === "error" ? (
          <div className="hf-state" role="alert">
            <p className="hf-state-title">Unable to load creators.</p>
            <button
              type="button"
              className="hf-state-cta"
              onClick={() => void loadInitial()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="hf-state">
            <p className="hf-state-title">No creators available.</p>
            <p className="hf-state-copy">Please check back later.</p>
            <button
              type="button"
              className="hf-state-cta"
              onClick={() => void loadInitial()}
            >
              Refresh
            </button>
          </div>
        ) : null}

        {status === "loaded" ? (
          <div
            ref={scrollerRef}
            className={[
              "hf-viewport",
              isDesktopDragging ? "is-desktop-dragging" : "",
            ]
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
              const activeIndex = items.findIndex((it) => it.id === activeId);
              const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;

              return items.map((item, index) => {
                const warm =
                  index === resolvedActiveIndex + 1 ||
                  index === resolvedActiveIndex - 1 ||
                  // Always warm slide 1 on first paint so the bottom peek has pixels.
                  (resolvedActiveIndex === 0 && index === 1);

                return (
                  <div key={item.id} className="hf-slide">
                    <CreatorFeedCard
                      item={item}
                      active={active && item.id === activeId}
                      warm={warm}
                      onLike={() => toggleLike(item.id)}
                      onBuy={() => onBuyPack(toPurchasePack(item))}
                      onOpenCreator={onOpenCreator}
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
    </section>
  );
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

/** Desktop-only media blur — filter:blur on video is too expensive on phones. */
function useAllowMediaBlur() {
  const [allow, setAllow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 981px)");
    const apply = () => setAllow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return allow;
}
