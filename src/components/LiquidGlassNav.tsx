import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Compass,
  Gift,
  Home,
  Layers3,
  User,
  type LucideIcon,
} from "lucide-react";
import { BorderGlow } from "@/components/ui/BorderGlow";
import type { AppTab } from "@/types/app";
import "./LiquidGlassNav.css";

const DESKTOP_MQ = "(min-width: 441px)";
type NavHandoff = "none" | "to-desktop" | "to-mobile";

type DockBubble = {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: string;
  /** 0–1 how much the bubble is under the Collection hero */
  underCollection: number;
  visible: boolean;
  ready: boolean;
};

const BUBBLE_RADIUS = {
  home: "1.5rem 0.2rem 0.2rem 1.5rem",
  profile: "0.2rem 1.5rem 1.5rem 0.2rem",
  default: "0.5rem",
} as const;

const HIDDEN_BUBBLE: DockBubble = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  radius: BUBBLE_RADIUS.default,
  underCollection: 0,
  visible: false,
  ready: false,
};

function bubbleRadiusForTab(id: AppTab) {
  if (id === "home") return BUBBLE_RADIUS.home;
  if (id === "profile") return BUBBLE_RADIUS.profile;
  return BUBBLE_RADIUS.default;
}

type TabConfig = {
  id: AppTab;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

const TABS: TabConfig[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "feed", label: "Browse", icon: Compass },
  { id: "bag", label: "Collection", icon: Layers3, primary: true },
  { id: "hub", label: "Hub", icon: Gift },
  { id: "profile", label: "Profile", icon: User },
];

/**
 * Source: /public/svg/bottomNavClip.svg (viewBox 0 0 512.2 106.5)
 *
 * IMPORTANT: clip-path does NOT reliably clip backdrop-filter (blur stays
 * rectangular). mask-image with this SVG works for glass silhouettes.
 * White-filled data URI so luminance masking is solid (file fill is decorative).
 */
const DOCK_PATH =
  "M470.5,23.6h-173.6C288.7,9.5,273.5,0,256.1,0s-32.6,9.4-40.8,23.5H41.7C18.8,23.6.2,42.1.2,65H.2c0,22.9,18.6,41.5,41.5,41.5h428.9c22.9,0,41.5-18.6,41.5-41.5h0c0-22.9-18.6-41.5-41.5-41.5h0Z";

// Symmetric bleed around the path so left/right caps aren't clipped by mask AA
// or a one-sided viewBox stretch (path lives ~0.2 → 512.1 in a 512.2 artboard).
const DOCK_VIEWBOX = "-2 -1 516.2 108.5";
const DOCK_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${DOCK_VIEWBOX}" preserveAspectRatio="none"><path fill="white" d="${DOCK_PATH}"/></svg>`,
)}")`;

/** Exactly 3 mesh colors for Collection BorderGlow rim */
const COLLECTION_GLOW_COLORS = ["#ff8fb1", "#f472b6", "#c084fc"] as const;

/** Locked Collection glow center cutout */
const CUTOUT = {
  offsetX: 50,
  offsetY: 52,
  size: 62,
  feather: 72,
  edgeScale: 0.63,
} as const;

const CUTOUT_STYLE = {
  ["--cutout-x" as string]: `${CUTOUT.offsetX}%`,
  ["--cutout-y" as string]: `${CUTOUT.offsetY}%`,
  ["--cutout-size" as string]: `${CUTOUT.size}%`,
  ["--cutout-feather" as string]: `${Math.max(CUTOUT.size, CUTOUT.feather)}%`,
  ["--cutout-edge-size" as string]: `${Math.max(1, CUTOUT.size * CUTOUT.edgeScale)}%`,
  ["--cutout-edge-feather" as string]: `${Math.max(
    CUTOUT.size * CUTOUT.edgeScale + 1,
    Math.max(CUTOUT.size, CUTOUT.feather) * CUTOUT.edgeScale,
  )}%`,
};

/** Fixed dock bubble height — keep in sync with --dock-bubble-h in CSS. */
const DOCK_BUBBLE_H_REM = 3.3;

function remToPx(rem: number) {
  if (typeof document === "undefined") return rem * 16;
  const rootPx = parseFloat(
    getComputedStyle(document.documentElement).fontSize || "16",
  );
  return rem * (Number.isFinite(rootPx) && rootPx > 0 ? rootPx : 16);
}

function measureBubbleForTab(
  parent: HTMLElement,
  target: HTMLElement,
  tabId: AppTab,
): Omit<DockBubble, "visible" | "ready" | "underCollection"> {
  const parentRect = parent.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const insetX = 2;
  const bubbleH = remToPx(DOCK_BUBBLE_H_REM);
  // Vertically center the fixed-height bubble, then nudge up ~5px
  const bubbleY =
    rect.top - parentRect.top + (rect.height - bubbleH) / 2 - 5;

  // Side-pad compensation for end caps (Home / Profile)
  const baseX = rect.left - parentRect.left + insetX;
  const baseW = Math.max(0, rect.width - insetX * 2);

  let bubbleX = baseX;
  let bubbleW = baseW;

  if (tabId === "home") {
    bubbleX = baseX - 5;
    bubbleW = baseW + 8;
  } else if (tabId === "profile") {
    bubbleX = baseX + 3;
    bubbleW = baseW + 5;
  }

  return {
    x: bubbleX,
    y: bubbleY,
    w: bubbleW,
    h: bubbleH,
    radius: bubbleRadiusForTab(tabId),
  };
}

/** Top-nav bubble — centered on the item, includes Collection. */
function measureTopBubbleForTab(
  parent: HTMLElement,
  target: HTMLElement,
  _tabId: AppTab,
): Omit<DockBubble, "visible" | "ready" | "underCollection"> {
  const parentRect = parent.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const insetX = 2;
  const insetY = 4;
  const fullH = Math.max(0, rect.height - insetY * 2);
  const bubbleH = fullH * 1.2;
  const bubbleY = rect.top - parentRect.top + insetY + (fullH - bubbleH) / 2;

  // Top nav has uniform corners — no Home/Profile end-cap compensation
  const bubbleX = rect.left - parentRect.left + insetX;
  const bubbleW = Math.max(0, rect.width - insetX * 2);

  return {
    x: bubbleX,
    y: bubbleY,
    w: bubbleW,
    h: bubbleH,
    radius: BUBBLE_RADIUS.default,
  };
}

export type LiquidGlassNavProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onReselect?: (tab: AppTab) => void;
  hidden?: boolean;
};

/**
 * Liquid-glass primary navigation — bottom dock on mobile, top bar on desktop.
 * Ported from NavTestPage for product chrome.
 */
export function LiquidGlassNav({
  activeTab,
  onTabChange,
  onReselect,
  hidden = false,
}: LiquidGlassNavProps) {
  const active = activeTab;
  const [isDesktop, setIsDesktop] = useState(false);
  const [handoff, setHandoff] = useState<NavHandoff>("none");
  const [bubble, setBubble] = useState<DockBubble>(HIDDEN_BUBBLE);
  const [topBubble, setTopBubble] = useState<DockBubble>(HIDDEN_BUBBLE);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [isDraggingTopBubble, setIsDraggingTopBubble] = useState(false);
  const [dragHoverTab, setDragHoverTab] = useState<AppTab | null>(null);
  const [topDragHoverTab, setTopDragHoverTab] = useState<AppTab | null>(null);

  const dockItemsRef = useRef<HTMLDivElement>(null);
  const dockTabRefs = useRef<Array<HTMLElement | null>>([]);
  const topItemsRef = useRef<HTMLDivElement>(null);
  const topTabRefs = useRef<Array<HTMLElement | null>>([]);
  const bubbleDragRef = useRef<{
    pointerId: number;
    grabOffsetX: number;
    originY: number;
    startX: number;
    moved: boolean;
    width: number;
    height: number;
  } | null>(null);
  const topBubbleDragRef = useRef<{
    pointerId: number;
    grabOffsetX: number;
    originY: number;
    startX: number;
    moved: boolean;
    width: number;
    height: number;
  } | null>(null);
  const suppressTabClickRef = useRef(false);

  const findNearestTab = useCallback(
    (
      clientX: number,
      tabRefs: Array<HTMLElement | null>,
      opts?: { ignorePrimary?: boolean },
    ): {
      id: AppTab;
      index: number;
      el: HTMLElement;
      dist: number;
    } | null => {
      // Horizontal-only targeting.
      type Nearest = {
        id: AppTab;
        index: number;
        el: HTMLElement;
        dist: number;
      };
      let best: Nearest | null = null;

      for (let index = 0; index < TABS.length; index += 1) {
        const tab = TABS[index];
        if (opts?.ignorePrimary && tab.primary) continue;
        const el = tabRefs[index];
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - cx);

        // Prefer actual horizontal hit, else nearest center X.
        const hit = clientX >= rect.left && clientX <= rect.right;
        const score = hit ? dist * 0.25 : dist;

        if (!best || score < best.dist) {
          best = { id: tab.id, index, el, dist: score };
        }
      }

      return best;
    },
    [],
  );

  const findNearestDraggableTab = useCallback(
    (clientX: number) =>
      findNearestTab(clientX, dockTabRefs.current, { ignorePrimary: true }),
    [findNearestTab],
  );

  const findNearestTopTab = useCallback(
    (clientX: number) => findNearestTab(clientX, topTabRefs.current),
    [findNearestTab],
  );

  /** 0–1 how centered the bubble is under Collection (smooth falloff). */
  const measureUnderCollection = useCallback(
    (bubbleX: number, bubbleW: number) => {
      const parent = dockItemsRef.current;
      const collectionIndex = TABS.findIndex((tab) => tab.primary);
      const collectionEl = dockTabRefs.current[collectionIndex];
      if (!parent || !collectionEl || bubbleW <= 0) return 0;

      const parentRect = parent.getBoundingClientRect();
      const collectionRect = collectionEl.getBoundingClientRect();
      const collectionCenter =
        collectionRect.left - parentRect.left + collectionRect.width / 2;
      const bubbleCenter = bubbleX + bubbleW / 2;
      const dist = Math.abs(bubbleCenter - collectionCenter);
      // Tighter range + ease-in so the duck hits harder near center
      const fadeRange = Math.max(collectionRect.width * 0.42, 22);
      const linear = Math.max(0, Math.min(1, 1 - dist / fadeRange));
      // Aggressive curve (ease-in cubic)
      return linear * linear * linear;
    },
    [],
  );

  const updateDockBubble = useCallback(() => {
    if (bubbleDragRef.current) return;

    const parent = dockItemsRef.current;
    const activeIndex = TABS.findIndex((tab) => tab.id === active);
    const activeTabConfig = TABS[activeIndex];
    const target = dockTabRefs.current[activeIndex];

    // Hero/Collection slot has its own glow treatment — hide shared bubble.
    if (!parent || !target || !activeTabConfig || activeTabConfig.primary) {
      setBubble((prev) => ({
        ...prev,
        underCollection: 0,
        visible: false,
        ready: prev.ready,
      }));
      return;
    }

    const measured = measureBubbleForTab(parent, target, activeTabConfig.id);
    setBubble({
      ...measured,
      underCollection: measureUnderCollection(measured.x, measured.w),
      visible: true,
      ready: true,
    });
  }, [active, measureUnderCollection]);

  const updateTopBubble = useCallback(() => {
    if (topBubbleDragRef.current) return;

    const parent = topItemsRef.current;
    const activeIndex = TABS.findIndex((tab) => tab.id === active);
    const activeTabConfig = TABS[activeIndex];
    const target = topTabRefs.current[activeIndex];

    if (!parent || !target || !activeTabConfig) {
      setTopBubble((prev) => ({
        ...prev,
        visible: false,
        ready: prev.ready,
      }));
      return;
    }

    const measured = measureTopBubbleForTab(parent, target, activeTabConfig.id);
    setTopBubble({
      ...measured,
      underCollection: 0,
      visible: true,
      ready: true,
    });
  }, [active]);

  useLayoutEffect(() => {
    updateDockBubble();
    updateTopBubble();
  }, [updateDockBubble, updateTopBubble, handoff, isDesktop]);

  useEffect(() => {
    const dockParent = dockItemsRef.current;
    const topParent = topItemsRef.current;

    const onResize = () => {
      updateDockBubble();
      updateTopBubble();
    };

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const ro = new ResizeObserver(onResize);
    if (dockParent) ro.observe(dockParent);
    if (topParent) ro.observe(topParent);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [updateDockBubble, updateTopBubble]);

  const handleBubblePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (!bubble.visible) return;

      const parent = dockItemsRef.current;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const grabOffsetX = event.clientX - parentRect.left - bubble.x;

      bubbleDragRef.current = {
        pointerId: event.pointerId,
        grabOffsetX,
        // Lock vertical position for the whole drag
        originY: bubble.y,
        startX: event.clientX,
        moved: false,
        width: bubble.w,
        height: bubble.h,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDraggingBubble(true);
      setDragHoverTab(active);
      event.preventDefault();
    },
    [active, bubble.h, bubble.visible, bubble.w, bubble.x, bubble.y],
  );

  const handleBubblePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = bubbleDragRef.current;
      const parent = dockItemsRef.current;
      if (!drag || !parent || event.pointerId !== drag.pointerId) return;

      const dx = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) > 4) {
        drag.moved = true;
      }

      const parentRect = parent.getBoundingClientRect();
      const nextX = event.clientX - parentRect.left - drag.grabOffsetX;
      // Horizontal-only: keep the locked origin Y
      const nextY = drag.originY;

      const nearest = findNearestDraggableTab(event.clientX);
      const hoverId = nearest?.id ?? null;
      setDragHoverTab(hoverId);

      // Morph toward nearest tab geometry while dragging on X only.
      if (nearest) {
        const measured = measureBubbleForTab(parent, nearest.el, nearest.id);
        setBubble((prev) => ({
          ...prev,
          x: nextX,
          y: nextY,
          w: measured.w,
          h: measured.h,
          radius: measured.radius,
          underCollection: measureUnderCollection(nextX, measured.w),
          visible: true,
          ready: true,
        }));
      } else {
        setBubble((prev) => {
          const w = prev.w || drag.width;
          return {
            ...prev,
            x: nextX,
            y: nextY,
            underCollection: measureUnderCollection(nextX, w),
            visible: true,
            ready: true,
          };
        });
      }
    },
    [findNearestDraggableTab, measureUnderCollection],
  );

  const endBubbleDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = bubbleDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const parent = dockItemsRef.current;
      const moved = drag.moved;
      bubbleDragRef.current = null;
      setIsDraggingBubble(false);
      setDragHoverTab(null);

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }

      if (!parent) {
        updateDockBubble();
        return;
      }

      if (moved) {
        // Avoid accidental tab click right after a drag drop.
        suppressTabClickRef.current = true;
        window.setTimeout(() => {
          suppressTabClickRef.current = false;
        }, 0);

        const nearest = findNearestDraggableTab(event.clientX);
        if (nearest) {
          // Collection is never selected via bubble drag.
          onTabChange(nearest.id);
          const measured = measureBubbleForTab(parent, nearest.el, nearest.id);
          setBubble({
            ...measured,
            underCollection: measureUnderCollection(measured.x, measured.w),
            visible: true,
            ready: true,
          });
          return;
        }
      }

      // Snap back to current active if no valid drop target.
      updateDockBubble();
    },
    [
      findNearestDraggableTab,
      measureUnderCollection,
      onTabChange,
      updateDockBubble,
    ],
  );

  const selectTab = useCallback(
    (id: AppTab) => {
      if (suppressTabClickRef.current) return;
      if (id === active) {
        onReselect?.(id);
        window.dispatchEvent(
          new CustomEvent("sugar:footer-reselect", {
            detail: { tab: id },
          }),
        );
        const scroller = document.querySelector<HTMLElement>("[data-page-scroll]");
        if (scroller && scroller.scrollTop > 2) {
          const reduce = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          scroller.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        }
        return;
      }
      onTabChange(id);
    },
    [active, onReselect, onTabChange],
  );

  const handleTopBubblePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (!topBubble.visible) return;

      const parent = topItemsRef.current;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const grabOffsetX = event.clientX - parentRect.left - topBubble.x;

      topBubbleDragRef.current = {
        pointerId: event.pointerId,
        grabOffsetX,
        originY: topBubble.y,
        startX: event.clientX,
        moved: false,
        width: topBubble.w,
        height: topBubble.h,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDraggingTopBubble(true);
      setTopDragHoverTab(active);
      event.preventDefault();
    },
    [active, topBubble.h, topBubble.visible, topBubble.w, topBubble.x, topBubble.y],
  );

  const handleTopBubblePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = topBubbleDragRef.current;
      const parent = topItemsRef.current;
      if (!drag || !parent || event.pointerId !== drag.pointerId) return;

      const dx = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) > 4) {
        drag.moved = true;
      }

      const parentRect = parent.getBoundingClientRect();
      const nextX = event.clientX - parentRect.left - drag.grabOffsetX;
      const nextY = drag.originY;

      // Include Collection on desktop top nav (no ducking).
      const nearest = findNearestTopTab(event.clientX);
      setTopDragHoverTab(nearest?.id ?? null);

      if (nearest) {
        const measured = measureTopBubbleForTab(parent, nearest.el, nearest.id);
        setTopBubble((prev) => ({
          ...prev,
          x: nextX,
          y: nextY,
          w: measured.w,
          h: measured.h,
          radius: measured.radius,
          underCollection: 0,
          visible: true,
          ready: true,
        }));
      } else {
        setTopBubble((prev) => ({
          ...prev,
          x: nextX,
          y: nextY,
          underCollection: 0,
          visible: true,
          ready: true,
        }));
      }
    },
    [findNearestTopTab],
  );

  const endTopBubbleDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = topBubbleDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const parent = topItemsRef.current;
      const moved = drag.moved;
      topBubbleDragRef.current = null;
      setIsDraggingTopBubble(false);
      setTopDragHoverTab(null);

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }

      if (!parent) {
        updateTopBubble();
        return;
      }

      if (moved) {
        suppressTabClickRef.current = true;
        window.setTimeout(() => {
          suppressTabClickRef.current = false;
        }, 0);

        const nearest = findNearestTopTab(event.clientX);
        if (nearest) {
          onTabChange(nearest.id);
          const measured = measureTopBubbleForTab(
            parent,
            nearest.el,
            nearest.id,
          );
          setTopBubble({
            ...measured,
            underCollection: 0,
            visible: true,
            ready: true,
          });
          return;
        }
      }

      updateTopBubble();
    },
    [findNearestTopTab, onTabChange, updateTopBubble],
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    let settleTimer = 0;

    /** Publish mode so mobile HUD / desktop utils can share handoff timing. */
    const publishChromeMode = (
      matches: boolean,
      phase: NavHandoff,
    ) => {
      const mode =
        phase === "to-desktop"
          ? "to-desktop"
          : phase === "to-mobile"
            ? "to-mobile"
            : matches
              ? "desktop"
              : "mobile";
      document.body.dataset.liquidNav = mode;
    };

    const apply = (matches: boolean, animate: boolean) => {
      setIsDesktop(matches);
      window.clearTimeout(settleTimer);

      if (!animate) {
        setHandoff("none");
        publishChromeMode(matches, "none");
        return;
      }

      // Keep handoff class until the longest enter/exit sequence finishes.
      const phase: NavHandoff = matches ? "to-desktop" : "to-mobile";
      setHandoff(phase);
      publishChromeMode(matches, phase);
      // Dock/top sequences peak ~1s; hold chrome mode until both settle.
      settleTimer = window.setTimeout(() => {
        setHandoff("none");
        publishChromeMode(matches, "none");
      }, 1100);
    };

    apply(mq.matches, false);

    const onChange = (event: MediaQueryListEvent) => apply(event.matches, true);
    mq.addEventListener("change", onChange);
    return () => {
      window.clearTimeout(settleTimer);
      mq.removeEventListener("change", onChange);
      delete document.body.dataset.liquidNav;
    };
  }, []);

  // Mutually exclusive modes so resting styles don't fight handoff animations.
  const rootClass = [
    "nav-test",
    "liquid-glass-nav",
    hidden ? "is-chrome-hidden" : "",
    handoff === "to-desktop"
      ? "is-handoff-to-desktop"
      : handoff === "to-mobile"
        ? "is-handoff-to-mobile"
        : isDesktop
          ? "is-desktop"
          : "is-mobile",
    isDraggingBubble ? "is-dragging-bubble" : "",
    isDraggingTopBubble ? "is-dragging-top-bubble" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Soften under Collection: fade + blur + duck scale (handle stays interactive)
  const under = bubble.underCollection;
  // Almost fully gone under Collection
  const bubbleVisualOpacity = bubble.visible ? 1 - under * 0.99 : 0;
  const bubbleVisualBlur = under * 10;
  const glowVisualOpacity = bubble.visible ? 0.5 * (1 - under) : 0;
  // Duck hard under Collection — scale down to ~72%
  const bubbleVisualScale = 1 - under * 0.28;

  const dockBubbleStyle = {
    ["--dock-bubble-x" as string]: `${bubble.x}px`,
    ["--dock-bubble-y" as string]: `${bubble.y}px`,
    ["--dock-bubble-w" as string]: `${bubble.w}px`,
    ["--dock-bubble-h" as string]: `${DOCK_BUBBLE_H_REM}rem`,
    ["--dock-bubble-radius" as string]: bubble.radius,
    ["--dock-bubble-opacity" as string]: String(bubbleVisualOpacity),
    ["--dock-bubble-blur" as string]: `${bubbleVisualBlur}px`,
    ["--dock-bubble-glow-opacity" as string]: String(glowVisualOpacity),
    ["--dock-bubble-scale" as string]: String(bubbleVisualScale),
    // Instant follow while dragging; smooth snap/morph otherwise
    ["--dock-bubble-duration" as string]:
      isDraggingBubble || !bubble.ready ? "0ms" : "420ms",
  } satisfies CSSProperties;

  const topBubbleStyle = {
    ["--top-bubble-x" as string]: `${topBubble.x}px`,
    ["--top-bubble-y" as string]: `${topBubble.y}px`,
    ["--top-bubble-w" as string]: `${topBubble.w}px`,
    ["--top-bubble-h" as string]: `${topBubble.h}px`,
    ["--top-bubble-radius" as string]: topBubble.radius,
    ["--top-bubble-opacity" as string]: topBubble.visible ? "1" : "0",
    ["--top-bubble-duration" as string]:
      isDraggingTopBubble || !topBubble.ready ? "0ms" : "420ms",
  } satisfies CSSProperties;

  return (
    <div className={rootClass} aria-hidden={hidden || undefined}>
      {/*
        Desktop / wide top nav.
        Glass + displacement MUST live on this same node as the centered
        transform (like .top-nav-mobile). A child with backdrop-filter under a
        transformed parent often samples nothing — no visible distortion.
      */}
      <nav
        className="nav-test-top glass glass-strength-40 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
        aria-label="Primary"
      >
        <div
          className="nav-test-top-items"
          ref={topItemsRef}
          style={topBubbleStyle}
        >
          {/* Sliding active indicator for top nav + drag handle */}
          <div className="nav-test-top-bubble-active-glow" aria-hidden="true" />
          <div
            className={[
              "nav-test-top-bubble",
              isDraggingTopBubble ? "is-dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          />
          <div
            className={[
              "nav-test-top-bubble-handle",
              topBubble.visible ? "is-interactive" : "",
              isDraggingTopBubble ? "is-dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
            onPointerDown={handleTopBubblePointerDown}
            onPointerMove={handleTopBubblePointerMove}
            onPointerUp={endTopBubbleDrag}
            onPointerCancel={endTopBubbleDrag}
          />

          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            const isDragTarget =
              isDraggingTopBubble && topDragHoverTab === tab.id;

            return (
              <div key={tab.id} className="nav-test-top-slot">
                <button
                  ref={(node) => {
                    topTabRefs.current[index] = node;
                  }}
                  type="button"
                  className={[
                    "nav-test-top-item",
                    tab.primary ? "is-primary" : "",
                    isActive ? "is-active" : "",
                    isDragTarget ? "is-drag-target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={tab.label}
                  tabIndex={hidden ? -1 : undefined}
                  onClick={() => selectTab(tab.id)}
                >
                  <Icon
                    className="nav-test-top-icon"
                    strokeWidth={isActive || isDragTarget ? 2.1 : 1.8}
                    fill={isActive || isDragTarget ? "currentColor" : "none"}
                    fillOpacity={isActive || isDragTarget ? 0.2 : 0}
                    aria-hidden="true"
                  />
                  <span className="nav-test-top-label">{tab.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      <nav className="nav-test-dock" aria-label="Primary">
        {/*
          Glass fill — SVG mask-image from public/svg/bottomNavClip.svg
          (not clip-path) so backdrop-filter is shaped.
        */}
        <div
          className="nav-test-dock-surface"
          style={{
            maskImage: DOCK_MASK,
            WebkitMaskImage: DOCK_MASK,
          }}
          aria-hidden="true"
        />

        {/* Rim light sets — narrow 2px stroke strips at left / center / right */}
        <div className="nav-test-dock-rims" aria-hidden="true">
          <div className="top-left-rim-light">
            <div className="rim-left-a" />
            <div className="rim-left-a-b" />
          </div>

          <div className="middle-right-rim-light">
            <div className="rim-center-a" />
            <div className="rim-center-a-b" />
          </div>

          <div className="bottom-right-rim-light">
            <div className="rim-right-a" />
            <div className="rim-right-a-b" />
          </div>
        </div>

        <div
          className="nav-test-dock-items"
          ref={dockItemsRef}
          style={dockBubbleStyle}
        >
          {/* Sliding active bubble + glow twin — drag to a nearby tab (not Collection) */}
          <div className="nav-test-dock-bubble-active-glow" aria-hidden="true" />
          <div
            className={[
              "nav-test-dock-bubble",
              isDraggingBubble ? "is-dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          />
          {/*
            Transparent hit target above tabs so the bubble can be grabbed.
            Visual bubble stays under Collection; this handle receives the drag.
          */}
          <div
            className={[
              "nav-test-dock-bubble-handle",
              bubble.visible ? "is-interactive" : "",
              isDraggingBubble ? "is-dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="slider"
            aria-label="Drag navigation indicator"
            aria-valuetext={
              dragHoverTab
                ? TABS.find((t) => t.id === dragHoverTab)?.label
                : TABS.find((t) => t.id === active)?.label
            }
            aria-hidden={bubble.visible ? undefined : true}
            onPointerDown={handleBubblePointerDown}
            onPointerMove={handleBubblePointerMove}
            onPointerUp={endBubbleDrag}
            onPointerCancel={endBubbleDrag}
          />

          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            const isDragTarget =
              isDraggingBubble && dragHoverTab === tab.id && !tab.primary;

            if (tab.primary) {
              return (
                <div
                  key={tab.id}
                  ref={(node) => {
                    dockTabRefs.current[index] = node;
                  }}
                  className={[
                    "nav-test-dock-primary",
                    isActive ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <BorderGlow
                    className="nav-test-dock-primary-glow nav-test-hero-btn border-glow-always-on"
                    borderRadius={999}
                    backgroundColor="transparent"
                    glowColor="330 90 78"
                    glowRadius={21}
                    glowIntensity={1.05}
                    coneSpread={28}
                    edgeSensitivity={0}
                    fillOpacity={0.2}
                    animated={false}
                    orbit
                    orbitDuration={7}
                    colors={[...COLLECTION_GLOW_COLORS]}
                    style={CUTOUT_STYLE}
                  >
                    <button
                      type="button"
                      className="nav-test-dock-primary-btn"
                      aria-current={isActive ? "page" : undefined}
                      aria-label={tab.label}
                      tabIndex={hidden ? -1 : undefined}
                      onClick={() => selectTab(tab.id)}
                    >
                      <Icon
                        className="nav-test-dock-primary-icon"
                        aria-hidden="true"
                      />
                    </button>
                  </BorderGlow>
                  <span className="nav-test-dock-primary-label" aria-hidden="true">
                    {tab.label}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={tab.id}
                ref={(node) => {
                  dockTabRefs.current[index] = node;
                }}
                type="button"
                className={[
                  "nav-test-dock-item",
                  isActive ? "is-active" : "",
                  isDragTarget ? "is-drag-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                tabIndex={hidden ? -1 : undefined}
                onClick={() => selectTab(tab.id)}
              >
                <Icon
                  className="nav-test-dock-icon"
                  strokeWidth={isActive || isDragTarget ? 2.1 : 1.8}
                  fill={isActive || isDragTarget ? "currentColor" : "none"}
                  fillOpacity={isActive || isDragTarget ? 0.2 : 0}
                  aria-hidden="true"
                />
                <span className="nav-test-dock-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
