import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  readHomeFeedCache,
  toPurchasePack,
  writeHomeFeedCache,
  type HomeFeedCreator,
} from "@/services/creatorFeed";
import {
  addFeedFavourite,
  removeFeedFavourite,
  withFavouriteLikes,
} from "@/services/feedFavourites";
import { useMarkPageReady } from "@/shared/ui/PageTransition";

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
/** Mobile: extra scale added at full slide travel. */
const MEDIA_SCALE_GAIN_MOBILE = 0.1;
/** Mobile ceiling — keep light for phones. */
const MEDIA_SCALE_MAX_MOBILE = 1.16;
/**
 * Desktop scrub zoom uses the performance headroom: scale toward 1.5× at full
 * slide travel (gain = max - base so progress 1 lands on the ceiling).
 */
const MEDIA_SCALE_MAX_DESKTOP = 1.5;
const MEDIA_SCALE_GAIN_DESKTOP = MEDIA_SCALE_MAX_DESKTOP - MEDIA_SCALE_BASE;
/** Max scroll-driven media blur (px). Desktop only — mobile skips filter blur. */
const MEDIA_BLUR_MAX_PX = 5;
/** Blur reaches max sooner than scale (1 = linear with scroll, higher = faster). */
const MEDIA_BLUR_PROGRESS_GAIN = 1.75;
/** How close scale must get before we snap to target (smaller = smoother end). */
const MEDIA_SCALE_SETTLE_EPS = 0.0002;
/** Desktop drag: ignore tiny pointer jitter before treating as a swipe. */
const DESKTOP_DRAG_THRESHOLD_PX = 6;
/** Desktop drag: velocity (px/ms) needed to advance a slide on release. */
const DESKTOP_DRAG_FLICK_VX = 0.45;
/**
 * Fraction of slide height the pointer must travel (or cross) to commit to
 * the next/prev card. Keeps one-card-at-a-time behavior like mobile.
 */
const DESKTOP_DRAG_COMMIT_RATIO = 0.22;
/** Ignore extra wheel ticks until the snap has settled. */
const WHEEL_SNAP_LOCK_MS = 520;
/** Ignore tiny trackpad jitter before treating it as a slide change. */
const WHEEL_SNAP_THRESHOLD = 8;

/** Delay before the first-land scroll-nudge affordance. */
const SCROLL_NUDGE_FIRST_DELAY_MS = 900;
/** Replay the scroll-nudge after this much feed inactivity. */
const SCROLL_NUDGE_IDLE_MS = 30_000;
/** Peak travel of the nudge as a fraction of slide height. */
const SCROLL_NUDGE_TRAVEL_RATIO = 0.085;
/** Hard cap so tall desktop slides still get a subtle peek. */
const SCROLL_NUDGE_TRAVEL_MAX_PX = 72;
/** Outbound (down) leg duration. */
const SCROLL_NUDGE_OUT_MS = 520;
/** Return (ease back) leg duration. */
const SCROLL_NUDGE_BACK_MS = 680;

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
  const [items, setItems] = useState<HomeFeedCreator[]>(
    () => withFavouriteLikes(cached?.items ?? []),
  );
  const [status, setStatus] = useState<"loading" | "loaded" | "error" | "empty">(
    cached?.items.length ? "loaded" : "loading",
  );
  useMarkPageReady(status !== "loading");
  const [activeId, setActiveId] = useState<string | null>(
    cached?.activeId ?? null,
  );
  const [viewIndex, setViewIndex] = useState(() =>
    Math.max(0, cached?.scrollIndex ?? 0),
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
  /** Desktop (≥981px): blur + aggressive scrub zoom. Mobile keeps the light path. */
  const isDesktopFeed = useIsDesktopFeed();
  const allowMediaBlur = isDesktopFeed;
  const mediaScaleGain = isDesktopFeed
    ? MEDIA_SCALE_GAIN_DESKTOP
    : MEDIA_SCALE_GAIN_MOBILE;
  const mediaScaleMax = isDesktopFeed
    ? MEDIA_SCALE_MAX_DESKTOP
    : MEDIA_SCALE_MAX_MOBILE;
  /** Seamless loop: clone last before first, clone first after last. */
  const loopEnabled = items.length > 1;
  const loopSlides = useMemo(() => {
    if (!loopEnabled) {
      return items.map((item, logicalIndex) => ({
        item,
        key: item.id,
        logicalIndex,
        clone: false as const,
      }));
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    return [
      {
        item: last,
        key: `${last.id}__loop-head`,
        logicalIndex: items.length - 1,
        clone: true as const,
      },
      ...items.map((item, logicalIndex) => ({
        item,
        key: item.id,
        logicalIndex,
        clone: false as const,
      })),
      {
        item: first,
        key: `${first.id}__loop-tail`,
        logicalIndex: 0,
        clone: true as const,
      },
    ];
  }, [items, loopEnabled]);
  const maxScrollIndex = Math.max(0, loopSlides.length - 1);
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
  const desktopDragWindowCleanupRef = useRef<(() => void) | null>(null);
  /** True while the programmatic scroll-nudge rAF is driving the viewport. */
  const nudgeAnimatingRef = useRef(false);
  const nudgeRafRef = useRef(0);
  const nudgeIdleTimerRef = useRef(0);
  const nudgeFirstTimerRef = useRef(0);
  const nudgeFirstPlayedRef = useRef(false);
  /** Any real feed interaction — suppresses a pending first-land nudge. */
  const nudgeUserTouchedRef = useRef(false);
  const markFeedActivityRef = useRef<() => void>(() => {});
  const wheelLockUntilRef = useRef(0);
  const goRef = useRef<(delta: number) => void>(() => {});

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
        const idx = Number.parseInt(key, 10);
        if (!Number.isFinite(idx) || idx < start || idx > end) {
          parallaxTargetRef.current.delete(key);
          parallaxCurrentRef.current.delete(key);
          scaleTargetRef.current.delete(key);
          scaleCurrentRef.current.delete(key);
          blurTargetRef.current.delete(key);
          blurCurrentRef.current.delete(key);
          if (Number.isFinite(idx) && slides[idx]) resetSlideFx(slides[idx]!);
        }
      }

      for (let index = start; index <= end; index += 1) {
        const key = String(index);
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
        // Desktop ramps to 1.5×; mobile stays near the original subtle zoom.
        const scaleTarget = Math.min(
          mediaScaleMax,
          MEDIA_SCALE_BASE + absProgress * mediaScaleGain,
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
    [
      allowMediaBlur,
      getSlideMetrics,
      mediaScaleGain,
      mediaScaleMax,
      reducedMotion,
    ],
  );

  const normalizeLoopScroll = useCallback(
    (root: HTMLElement) => {
      if (!loopEnabled) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;
      const index = Math.round(root.scrollTop / slideHeight);
      // Head clone → real last; tail clone → real first.
      let target = index;
      if (index <= 0) target = items.length;
      else if (index >= items.length + 1) target = 1;
      else return;

      const y = target * slideHeight;
      if (Math.abs(root.scrollTop - y) < 1) return;

      const prevSnap = root.style.scrollSnapType;
      const prevBehavior = root.style.scrollBehavior;
      root.style.scrollSnapType = "none";
      root.style.scrollBehavior = "auto";
      root.scrollTop = y;
      setViewIndex(target);
      scrollIndexRef.current = target - 1;
      requestAnimationFrame(() => {
        root.style.scrollSnapType = prevSnap;
        root.style.scrollBehavior = prevBehavior;
        applyScrollFx(root, true);
      });
    },
    [applyScrollFx, getSlideMetrics, items.length, loopEnabled],
  );

  useEffect(() => {
    if (status !== "loaded" || restoredRef.current) return;
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    restoredRef.current = true;
    const { slideHeight } = getSlideMetrics(root);
    const logical = Math.min(
      scrollIndexRef.current,
      Math.max(0, items.length - 1),
    );
    const index = loopEnabled ? logical + 1 : logical;
    root.scrollTo({ top: index * slideHeight });
    setViewIndex(index);
    const next = items[logical];
    if (next) setActiveId(next.id);
    applyScrollFx(root, true);
  }, [status, items, getSlideMetrics, applyScrollFx, loopEnabled]);

  const stopScrollNudge = useCallback(() => {
    if (nudgeRafRef.current) {
      cancelAnimationFrame(nudgeRafRef.current);
      nudgeRafRef.current = 0;
    }
    if (!nudgeAnimatingRef.current) return;
    nudgeAnimatingRef.current = false;
    const root = scrollerRef.current;
    if (!root) return;
    // Leave scrollTop where the user interrupted; restore snap so CSS can settle.
    root.style.scrollSnapType = "";
    root.style.scrollBehavior = "";
  }, []);

  const playScrollNudge = useCallback(() => {
    if (reducedMotion || !active || status !== "loaded") return;
    if (nudgeAnimatingRef.current || desktopDragRef.current) return;
    if (gestureLayerBlocksNudge()) return;

    const root = scrollerRef.current;
    if (!root || items.length < 2) return;

    const { slideHeight } = getSlideMetrics(root);
    if (slideHeight <= 0) return;

    // Only nudge when parked on a slide — mid-scroll means the user is already moving.
    const restTop = root.scrollTop;
    const index = Math.round(restTop / slideHeight);
    if (Math.abs(restTop - index * slideHeight) > 2) return;
    // Need a next slide to peek (includes loop tail clone after the last real).
    if (index >= maxScrollIndex) return;

    const travel = Math.min(
      SCROLL_NUDGE_TRAVEL_MAX_PX,
      Math.max(28, slideHeight * SCROLL_NUDGE_TRAVEL_RATIO),
    );
    const peakTop = restTop + travel;
    const totalMs = SCROLL_NUDGE_OUT_MS + SCROLL_NUDGE_BACK_MS;

    nudgeAnimatingRef.current = true;
    // Disable snap so the peek doesn't get sucked to the next card.
    root.style.scrollSnapType = "none";
    root.style.scrollBehavior = "auto";

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const startedAt = performance.now();

    const tick = (now: number) => {
      if (!nudgeAnimatingRef.current) return;
      const node = scrollerRef.current;
      if (!node) {
        stopScrollNudge();
        return;
      }

      const elapsed = now - startedAt;
      if (elapsed >= totalMs) {
        node.scrollTop = restTop;
        applyScrollFx(node, true);
        stopScrollNudge();
        return;
      }

      let y: number;
      if (elapsed <= SCROLL_NUDGE_OUT_MS) {
        const t = easeInOutCubic(elapsed / SCROLL_NUDGE_OUT_MS);
        y = restTop + (peakTop - restTop) * t;
      } else {
        const t = easeInOutCubic(
          (elapsed - SCROLL_NUDGE_OUT_MS) / SCROLL_NUDGE_BACK_MS,
        );
        y = peakTop + (restTop - peakTop) * t;
      }

      node.scrollTop = y;
      applyScrollFx(node);
      nudgeRafRef.current = requestAnimationFrame(tick);
    };

    nudgeRafRef.current = requestAnimationFrame(tick);
  }, [
    active,
    applyScrollFx,
    getSlideMetrics,
    items.length,
    maxScrollIndex,
    reducedMotion,
    status,
    stopScrollNudge,
  ]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !loopEnabled || status !== "loaded") return;
    const onScrollEnd = () => normalizeLoopScroll(root);
    root.addEventListener("scrollend", onScrollEnd);
    return () => root.removeEventListener("scrollend", onScrollEnd);
  }, [loopEnabled, normalizeLoopScroll, status, items.length]);

  const armScrollNudgeIdle = useCallback(() => {
    if (nudgeIdleTimerRef.current) {
      window.clearTimeout(nudgeIdleTimerRef.current);
      nudgeIdleTimerRef.current = 0;
    }
    if (!active || reducedMotion || status !== "loaded" || items.length < 2) {
      return;
    }
    nudgeIdleTimerRef.current = window.setTimeout(() => {
      nudgeIdleTimerRef.current = 0;
      playScrollNudge();
      // After an idle nudge, keep the 30s loop armed.
      armScrollNudgeIdle();
    }, SCROLL_NUDGE_IDLE_MS);
  }, [active, items.length, playScrollNudge, reducedMotion, status]);

  const markFeedActivity = useCallback(() => {
    nudgeUserTouchedRef.current = true;
    if (nudgeFirstTimerRef.current) {
      window.clearTimeout(nudgeFirstTimerRef.current);
      nudgeFirstTimerRef.current = 0;
      nudgeFirstPlayedRef.current = true;
    }
    // User engagement cancels an in-flight affordance and restarts the idle clock.
    // Keep current scrollTop so wheel/touch take over without a yank-back.
    stopScrollNudge();
    armScrollNudgeIdle();
  }, [armScrollNudgeIdle, stopScrollNudge]);

  markFeedActivityRef.current = markFeedActivity;

  // First-land nudge + 30s idle loop while the home feed is the active tab.
  useEffect(() => {
    if (!active || reducedMotion || status !== "loaded" || items.length < 2) {
      stopScrollNudge();
      if (nudgeFirstTimerRef.current) {
        window.clearTimeout(nudgeFirstTimerRef.current);
        nudgeFirstTimerRef.current = 0;
      }
      if (nudgeIdleTimerRef.current) {
        window.clearTimeout(nudgeIdleTimerRef.current);
        nudgeIdleTimerRef.current = 0;
      }
      return;
    }

    if (!nudgeFirstPlayedRef.current && !nudgeUserTouchedRef.current) {
      if (nudgeFirstTimerRef.current) {
        window.clearTimeout(nudgeFirstTimerRef.current);
      }
      nudgeFirstTimerRef.current = window.setTimeout(() => {
        nudgeFirstTimerRef.current = 0;
        if (nudgeUserTouchedRef.current) {
          nudgeFirstPlayedRef.current = true;
          armScrollNudgeIdle();
          return;
        }
        nudgeFirstPlayedRef.current = true;
        playScrollNudge();
        armScrollNudgeIdle();
      }, SCROLL_NUDGE_FIRST_DELAY_MS);
    } else {
      nudgeFirstPlayedRef.current = true;
      armScrollNudgeIdle();
    }

    return () => {
      if (nudgeFirstTimerRef.current) {
        window.clearTimeout(nudgeFirstTimerRef.current);
        nudgeFirstTimerRef.current = 0;
      }
      if (nudgeIdleTimerRef.current) {
        window.clearTimeout(nudgeIdleTimerRef.current);
        nudgeIdleTimerRef.current = 0;
      }
      stopScrollNudge();
    };
  }, [
    active,
    armScrollNudgeIdle,
    items.length,
    playScrollNudge,
    reducedMotion,
    status,
    stopScrollNudge,
  ]);

  useEffect(() => {
    return () => {
      if (scrollFxRafRef.current) {
        cancelAnimationFrame(scrollFxRafRef.current);
        scrollFxRafRef.current = 0;
      }
      if (nudgeRafRef.current) {
        cancelAnimationFrame(nudgeRafRef.current);
        nudgeRafRef.current = 0;
      }
      if (nudgeFirstTimerRef.current) {
        window.clearTimeout(nudgeFirstTimerRef.current);
        nudgeFirstTimerRef.current = 0;
      }
      if (nudgeIdleTimerRef.current) {
        window.clearTimeout(nudgeIdleTimerRef.current);
        nudgeIdleTimerRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    const activeSlide = loopSlides[viewIndex];
    const activeKey = activeSlide?.key;
    const logical = activeSlide?.logicalIndex ?? 0;
    const warmKeys = new Set<string>();
    for (let offset = -FEED_WARM_BEHIND; offset <= FEED_WARM_AHEAD; offset += 1) {
      if (offset === 0) continue;
      const neighborLogical = logical + offset;
      if (neighborLogical < 0 || neighborLogical >= items.length) continue;
      const neighbor = items[neighborLogical];
      if (neighbor) warmKeys.add(neighbor.id);
      // Also warm the matching loop clone keys when relevant.
      if (loopEnabled && neighborLogical === 0) {
        warmKeys.add(`${items[0]!.id}__loop-tail`);
      }
      if (loopEnabled && neighborLogical === items.length - 1) {
        warmKeys.add(`${items[items.length - 1]!.id}__loop-head`);
      }
    }

    videoRefs.current.forEach((video, id) => {
      if (!active) {
        video.pause();
        return;
      }

      if (id === activeKey) {
        video.muted = true;
        void video.play().catch(() => {
          /* poster still shows */
        });
        return;
      }

      video.pause();

      if (warmKeys.has(id)) {
        try {
          if (video.preload !== "auto") video.preload = "auto";
        } catch {
          /* ignore media errors on warm path */
        }
      }
    });
  }, [active, items, loopEnabled, loopSlides, videoRefs, viewIndex]);

  const go = useCallback(
    (delta: number) => {
      const root = scrollerRef.current;
      if (!root || !loopSlides.length) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;
      const current = Math.round(root.scrollTop / slideHeight);
      const next = Math.max(0, Math.min(maxScrollIndex, current + delta));
      root.scrollTo({
        top: next * slideHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
      if (reducedMotion) {
        normalizeLoopScroll(root);
      }
    },
    [
      getSlideMetrics,
      loopSlides.length,
      maxScrollIndex,
      normalizeLoopScroll,
      reducedMotion,
    ],
  );

  goRef.current = go;

  /**
   * Snap after a desktop drag. Always relative to the drag *start* index and
   * limited to ±1 slide — never jump from drag progress + an extra flick step.
   *
   * velocityY > 0  → pointer moved down → previous card
   * velocityY < 0  → pointer moved up   → next card
   */
  const snapAfterDesktopDrag = useCallback(
    (startScrollTop: number, velocityY = 0) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;
      const { slideHeight } = getSlideMetrics(root);
      if (slideHeight <= 0) return;

      const startIndex = Math.round(startScrollTop / slideHeight);
      const deltaPx = root.scrollTop - startScrollTop;
      const deltaSlides = deltaPx / slideHeight;
      const commit = DESKTOP_DRAG_COMMIT_RATIO;
      const flicked = Math.abs(velocityY) >= DESKTOP_DRAG_FLICK_VX;

      let target = startIndex;
      // Dragged far enough toward next, or flicked up.
      if (deltaSlides >= commit || (flicked && velocityY < 0 && deltaSlides > 0.02)) {
        target = startIndex + 1;
      } else if (
        deltaSlides <= -commit ||
        (flicked && velocityY > 0 && deltaSlides < -0.02)
      ) {
        target = startIndex - 1;
      }

      target = Math.max(0, Math.min(maxScrollIndex, target));
      root.scrollTo({
        top: target * slideHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
      if (reducedMotion) normalizeLoopScroll(root);
    },
    [getSlideMetrics, maxScrollIndex, normalizeLoopScroll, reducedMotion],
  );

  const isDragFromInteractive = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, a, input, textarea, select, label, [role='button'], [data-no-feed-drag]",
      ),
    );
  }, []);

  const detachDesktopDragWindowListeners = useCallback(() => {
    desktopDragWindowCleanupRef.current?.();
    desktopDragWindowCleanupRef.current = null;
  }, []);

  const finishDesktopPointerDrag = useCallback(
    (pointerId: number, captureTarget?: HTMLElement | null) => {
      const drag = desktopDragRef.current;
      const root = scrollerRef.current;
      if (!drag || pointerId !== drag.pointerId) return;

      detachDesktopDragWindowListeners();

      const startScrollTop = drag.startScrollTop;
      const velocityY = drag.velocityY;
      const moved = drag.moved;

      desktopDragRef.current = null;
      setIsDesktopDragging(false);

      if (captureTarget) {
        try {
          captureTarget.releasePointerCapture(pointerId);
        } catch {
          /* not captured */
        }
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
    [detachDesktopDragWindowListeners, reducedMotion, snapAfterDesktopDrag],
  );

  useEffect(
    () => () => detachDesktopDragWindowListeners(),
    [detachDesktopDragWindowListeners],
  );

  const onDesktopPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!active) return;
      markFeedActivityRef.current();
      // Touch already has native pan-y scrolling; this is for mouse/pen drag.
      if (event.pointerType === "touch") return;
      if (event.button !== 0) return;
      if (isDragFromInteractive(event.target)) return;

      const root = scrollerRef.current;
      if (!root) return;

      detachDesktopDragWindowListeners();

      const pointerId = event.pointerId;
      desktopDragRef.current = {
        pointerId,
        startY: event.clientY,
        startScrollTop: root.scrollTop,
        lastY: event.clientY,
        lastTs: event.timeStamp,
        velocityY: 0,
        moved: false,
      };

      const onWindowEnd = (e: PointerEvent) => {
        finishDesktopPointerDrag(e.pointerId, scrollerRef.current);
      };
      window.addEventListener("pointerup", onWindowEnd);
      window.addEventListener("pointercancel", onWindowEnd);
      desktopDragWindowCleanupRef.current = () => {
        window.removeEventListener("pointerup", onWindowEnd);
        window.removeEventListener("pointercancel", onWindowEnd);
      };
    },
    [
      active,
      detachDesktopDragWindowListeners,
      finishDesktopPointerDrag,
      isDragFromInteractive,
    ],
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
        event.currentTarget.setPointerCapture(event.pointerId);
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
      finishDesktopPointerDrag(event.pointerId, event.currentTarget);
    },
    [finishDesktopPointerDrag],
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
        event.key === "ArrowUp" ||
        event.key === "PageUp" ||
        event.key === "k"
      ) {
        event.preventDefault();
        markFeedActivityRef.current();
        go(-1);
      } else if (
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === "j"
      ) {
        event.preventDefault();
        markFeedActivityRef.current();
        go(1);
      } else if (event.key === "Home") {
        event.preventDefault();
        markFeedActivityRef.current();
        const root = scrollerRef.current;
        root?.scrollTo({
          top: 0,
          behavior: reducedMotion ? "auto" : "smooth",
        });
      } else if (event.key === "End") {
        event.preventDefault();
        markFeedActivityRef.current();
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

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !active || status !== "loaded") return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      event.preventDefault();
      event.stopPropagation();

      if (desktopDragRef.current || nudgeAnimatingRef.current) return;
      if (Math.abs(event.deltaY) < WHEEL_SNAP_THRESHOLD) return;

      const now = performance.now();
      if (now < wheelLockUntilRef.current) return;

      wheelLockUntilRef.current = now + WHEEL_SNAP_LOCK_MS;
      markFeedActivityRef.current();
      goRef.current(event.deltaY > 0 ? 1 : -1);
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [active, status, items.length]);

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

  useEffect(() => {
    if (status !== "loaded") return;
    const activeIndex = items.findIndex((item) => item.id === activeId);
    const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;
    const remaining = items.length - 1 - resolvedActiveIndex;
    if (remaining <= FEED_WARM_AHEAD) void loadMore();
  }, [activeId, items.length, status]);

  function onScroll() {
    const root = scrollerRef.current;
    if (!root || !loopSlides.length) return;
    // Programmatic nudge drives scrollTop itself — don't treat that as user activity.
    if (!nudgeAnimatingRef.current) {
      markFeedActivityRef.current();
    }
    const { slideHeight } = getSlideMetrics(root);
    const index = Math.round(root.scrollTop / slideHeight);
    const safeIndex = Math.max(0, Math.min(maxScrollIndex, index));
    setViewIndex(safeIndex);
    const slide = loopSlides[safeIndex];
    if (slide) {
      scrollIndexRef.current = slide.logicalIndex;
      if (slide.item.id !== activeId) {
        setActiveId(slide.item.id);
        persist({
          activeId: slide.item.id,
          scrollIndex: slide.logicalIndex,
        });
      } else {
        persist({ scrollIndex: slide.logicalIndex });
      }
    }

    applyScrollFx(root);

    const logical = slide?.logicalIndex ?? 0;
    const remaining = items.length - 1 - logical;
    if (remaining <= FEED_WARM_AHEAD) void loadMore();

    // Settled on a loop clone → teleport to the matching real slide.
    if (
      loopEnabled &&
      Math.abs(root.scrollTop - safeIndex * slideHeight) < 2 &&
      (safeIndex <= 0 || safeIndex >= items.length + 1)
    ) {
      normalizeLoopScroll(root);
    }
  }

  function toggleLike(id: string) {
    if (onLikeAttempt && !onLikeAttempt(id)) return;
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, liked: !item.liked } : item,
      );
      const item = next.find((entry) => entry.id === id);
      if (item?.liked) addFeedFavourite(item);
      else if (item) removeFeedFavourite(item);
      persist({ items: next });
      return next;
    });
  }

  /** One-way Like for double-tap — never unlikes; idempotent when already liked. */
  function ensureLike(id: string): boolean {
    const already = items.some((item) => item.id === id && item.liked);
    if (already) return true;
    if (onLikeAttempt && !onLikeAttempt(id)) return false;
    setItems((prev) => {
      if (prev.some((item) => item.id === id && item.liked)) return prev;
      const next = prev.map((item) =>
        item.id === id ? { ...item, liked: true } : item,
      );
      const item = next.find((entry) => entry.id === id);
      if (item) addFeedFavourite(item);
      persist({ items: next });
      return next;
    });
    return true;
  }

  useEffect(() => {
    if (!resumeLikeId) return;
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === resumeLikeId ? { ...item, liked: true } : item,
      );
      const item = next.find((entry) => entry.id === resumeLikeId);
      if (item) addFeedFavourite(item);
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
      <div className="hf-stage">
        <div className="hf-frame">
          {status === "loading" ? (
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
            <div className="hf-state-cta">
              <CtaButton
                {...ctaButtonPropsFromTemplate("squircleCTA")}
                fillParent
                type="button"
                label="Refresh"
                costAmount={null}
                fontSize={15}
                strokeWidth={1}
                onClick={() => void loadInitial()}
              />
            </div>
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
              const activeLogical =
                loopSlides[viewIndex]?.logicalIndex ??
                items.findIndex((it) => it.id === activeId);
              const resolvedActiveIndex = activeLogical >= 0 ? activeLogical : 0;

              return loopSlides.map((slide, index) => {
                const warm =
                  !slide.clone &&
                  isWarmFeedIndex(slide.logicalIndex, resolvedActiveIndex);

                return (
                  <div key={slide.key} className="hf-slide">
                    <CreatorFeedCard
                      item={slide.item}
                      active={active && index === viewIndex}
                      warm={warm || (active && index === viewIndex)}
                      onLike={() => toggleLike(slide.item.id)}
                      onEnsureLike={() => ensureLike(slide.item.id)}
                      onBuy={() => onBuyPack(toPurchasePack(slide.item))}
                      onOpenCreator={onOpenCreator}
                      videoRef={(node) => {
                        if (node) videoRefs.current.set(slide.key, node);
                        else videoRefs.current.delete(slide.key);
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
        {isDesktopFeed && status === "loaded" && items.length > 1 ? (
        <div className="hf-stepper" aria-label="Feed navigation">
          <button
            type="button"
            className="hf-stepper-btn glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
            aria-label="Previous creator"
            data-no-feed-drag
            onClick={() => {
              markFeedActivityRef.current();
              go(-1);
            }}
          >
            <ChevronUp className="hf-stepper-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="hf-stepper-btn glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
            aria-label="Next creator"
            data-no-feed-drag
            onClick={() => {
              markFeedActivityRef.current();
              go(1);
            }}
          >
            <ChevronDown className="hf-stepper-icon" aria-hidden="true" />
          </button>
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

/** Skip the scroll-nudge while a modal/dialog owns the screen. */
function gestureLayerBlocksNudge() {
  return Boolean(
    document.querySelector(
      '[aria-modal="true"], [role="dialog"][aria-modal="true"]',
    ),
  );
}

/**
 * Desktop feed breakpoint — matches CTA / pack mobile MQ (≤980 = mobile).
 * Used for blur + larger scrub zoom where there's GPU headroom.
 */
function useIsDesktopFeed() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 981px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return desktop;
}
