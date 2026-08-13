import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
const OVERLAY_PARALLAX = 0.28;
/** Max overlay drift in px (keeps CTAs readable). */
const OVERLAY_PARALLAX_MAX_PX = 56;
/**
 * Overlay settle half-life in ms (time-based damping).
 * Higher = silkier / less stutter; lower = snappier.
 */
const OVERLAY_PARALLAX_HALFLIFE_MS = 90;
/** Snap when within this many px of target. */
const OVERLAY_PARALLAX_SETTLE_EPS = 0.08;
/**
 * Media zoom ease — lower = softer settle (less jitter when snapping home).
 * Applied every rAF toward the scroll target.
 */
const MEDIA_SCALE_EASE = 0.08;
/** Resting media scale inside overflow-hidden frame (keep near 1 so first frame isn't cropped). */
const MEDIA_SCALE_BASE = 1.04;
/** Extra scale added at full slide travel (more scroll → more zoom). */
const MEDIA_SCALE_GAIN = 0.1;
/** Hard ceiling so zoom stays tasteful. */
const MEDIA_SCALE_MAX = 1.16;
/** Max scroll-driven media blur (px). */
const MEDIA_BLUR_MAX_PX = 5;
/** Blur reaches max sooner than scale (1 = linear with scroll, higher = faster). */
const MEDIA_BLUR_PROGRESS_GAIN = 1.75;
/** Blur settle ease — slightly softer than before so it doesn't chatter with zoom. */
const MEDIA_BLUR_EASE = 0.14;
/** How close scale must get before we snap to target (smaller = smoother end). */
const MEDIA_SCALE_SETTLE_EPS = 0.00015;

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
  const parallaxTargetRef = useRef(new Map<string, number>());
  const parallaxCurrentRef = useRef(new Map<string, number>());
  const scaleTargetRef = useRef(new Map<string, number>());
  const scaleCurrentRef = useRef(new Map<string, number>());
  const blurTargetRef = useRef(new Map<string, number>());
  const blurCurrentRef = useRef(new Map<string, number>());
  const scrollFxRafRef = useRef(0);
  const scrollFxLastTsRef = useRef(0);

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
      const overlays = root.querySelectorAll<HTMLElement>(".hf-overlay");
      const medias = root.querySelectorAll<HTMLElement>(".hf-media");
      if (!overlays.length && !medias.length) return;

      if (reducedMotion) {
        overlays.forEach((overlay) => {
          overlay.style.setProperty("--hf-parallax-y", "0px");
        });
        medias.forEach((media) => {
          media.style.setProperty("--hf-media-scale", String(MEDIA_SCALE_BASE));
          media.style.setProperty("--hf-media-blur", "0px");
        });
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

      const { slideHeight } = getSlideMetrics(root);
      const scrollTop = root.scrollTop;
      const count = Math.max(overlays.length, medias.length);

      for (let index = 0; index < count; index += 1) {
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
        const exitProgress = Math.max(0, progress);
        const blurTarget = Math.min(
          MEDIA_BLUR_MAX_PX,
          exitProgress * MEDIA_BLUR_PROGRESS_GAIN * MEDIA_BLUR_MAX_PX,
        );
        blurTargetRef.current.set(key, blurTarget);

        if (immediate) {
          parallaxCurrentRef.current.set(key, overlayTarget);
          scaleCurrentRef.current.set(key, scaleTarget);
          blurCurrentRef.current.set(key, blurTarget);
          overlays[index]?.style.setProperty(
            "--hf-parallax-y",
            `${overlayTarget.toFixed(3)}px`,
          );
          medias[index]?.style.setProperty(
            "--hf-media-scale",
            scaleTarget.toFixed(5),
          );
          medias[index]?.style.setProperty(
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
        const mediaAlpha = 1 - Math.exp((-Math.LN2 * dtMs) / 120);

        const liveOverlays = node.querySelectorAll<HTMLElement>(".hf-overlay");
        const liveMedias = node.querySelectorAll<HTMLElement>(".hf-media");
        const liveCount = Math.max(liveOverlays.length, liveMedias.length);
        let drifting = false;

        for (let index = 0; index < liveCount; index += 1) {
          const key = items[index]?.id ?? String(index);

          const oTarget = parallaxTargetRef.current.get(key) ?? 0;
          const oCurrent = parallaxCurrentRef.current.get(key) ?? 0;
          const oNext = oCurrent + (oTarget - oCurrent) * overlayAlpha;
          const oSettled = Math.abs(oTarget - oNext) < OVERLAY_PARALLAX_SETTLE_EPS;
          const oValue = oSettled ? oTarget : oNext;
          parallaxCurrentRef.current.set(key, oValue);
          liveOverlays[index]?.style.setProperty(
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
          liveMedias[index]?.style.setProperty(
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
          liveMedias[index]?.style.setProperty(
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
    [getSlideMetrics, items, reducedMotion],
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
      const next = Math.round(root.scrollTop / slideHeight) + delta;
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      root.scrollTo({
        top: clamped * slideHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [getSlideMetrics, items.length, reducedMotion],
  );

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

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
            className="hf-viewport"
            onScroll={onScroll}
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
