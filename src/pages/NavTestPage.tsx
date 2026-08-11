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

const DESKTOP_MQ = "(min-width: 441px)";
type NavHandoff = "none" | "to-desktop" | "to-mobile";
type NavTestTab = "home" | "browse" | "collection" | "rewards" | "profile";

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

function bubbleRadiusForTab(id: NavTestTab) {
  if (id === "home") return BUBBLE_RADIUS.home;
  if (id === "profile") return BUBBLE_RADIUS.profile;
  return BUBBLE_RADIUS.default;
}

type TabConfig = {
  id: NavTestTab;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

const TABS: TabConfig[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Browse", icon: Compass },
  { id: "collection", label: "Collection", icon: Layers3, primary: true },
  { id: "rewards", label: "Rewards", icon: Gift },
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

const COVER_IMAGE = "linear-gradient(180deg, #0c0c0e 0%, #15151c 100%)";

/** Exactly 3 mesh colors for Collection BorderGlow rim */
const COLLECTION_GLOW_COLORS = ["#ff8fb1", "#f472b6", "#c084fc"] as const;

/** Locked Collection glow center cutout */
const CUTOUT = {
  offsetX: 50.5,
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

function measureBubbleForTab(
  parent: HTMLElement,
  target: HTMLElement,
  tabId: NavTestTab,
): Omit<DockBubble, "visible" | "ready" | "underCollection"> {
  const parentRect = parent.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const insetX = 2;
  const insetY = 4;
  const fullH = Math.max(0, rect.height - insetY * 2);
  // ~5% shorter than the tab hit area, bottom-aligned under icon+label
  const bubbleH = fullH * 0.95;
  const bubbleY = rect.top - parentRect.top + insetY + (fullH - bubbleH);

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
  tabId: NavTestTab,
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

export function NavTestPage() {
  const [active, setActive] = useState<NavTestTab>("home");
  const [isDesktop, setIsDesktop] = useState(false);
  const [handoff, setHandoff] = useState<NavHandoff>("none");
  const [bubble, setBubble] = useState<DockBubble>(HIDDEN_BUBBLE);
  const [topBubble, setTopBubble] = useState<DockBubble>(HIDDEN_BUBBLE);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [isDraggingTopBubble, setIsDraggingTopBubble] = useState(false);
  const [dragHoverTab, setDragHoverTab] = useState<NavTestTab | null>(null);
  const [topDragHoverTab, setTopDragHoverTab] = useState<NavTestTab | null>(
    null,
  );

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
    ) => {
      // Horizontal-only targeting.
      let best:
        | {
            id: NavTestTab;
            index: number;
            el: HTMLElement;
            dist: number;
          }
        | null = null;

      TABS.forEach((tab, index) => {
        if (opts?.ignorePrimary && tab.primary) return;
        const el = tabRefs[index];
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - cx);

        // Prefer actual horizontal hit, else nearest center X.
        const hit = clientX >= rect.left && clientX <= rect.right;
        const score = hit ? dist * 0.25 : dist;

        if (!best || score < best.dist) {
          best = { id: tab.id, index, el, dist: score };
        }
      });

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
    const activeTab = TABS[activeIndex];
    const target = dockTabRefs.current[activeIndex];

    // Hero/Collection slot has its own glow treatment — hide shared bubble.
    if (!parent || !target || !activeTab || activeTab.primary) {
      setBubble((prev) => ({
        ...prev,
        underCollection: 0,
        visible: false,
        ready: prev.ready,
      }));
      return;
    }

    const measured = measureBubbleForTab(parent, target, activeTab.id);
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
    const activeTab = TABS[activeIndex];
    const target = topTabRefs.current[activeIndex];

    if (!parent || !target || !activeTab) {
      setTopBubble((prev) => ({
        ...prev,
        visible: false,
        ready: prev.ready,
      }));
      return;
    }

    const measured = measureTopBubbleForTab(parent, target, activeTab.id);
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
          setActive(nearest.id);
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
    [findNearestDraggableTab, measureUnderCollection, updateDockBubble],
  );

  const selectTab = useCallback((id: NavTestTab) => {
    if (suppressTabClickRef.current) return;
    setActive(id);
  }, []);

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
          setActive(nearest.id);
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
    [findNearestTopTab, updateTopBubble],
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    let settleTimer = 0;

    const apply = (matches: boolean, animate: boolean) => {
      setIsDesktop(matches);
      window.clearTimeout(settleTimer);

      if (!animate) {
        setHandoff("none");
        return;
      }

      // Keep handoff class until the longest enter/exit sequence finishes.
      setHandoff(matches ? "to-desktop" : "to-mobile");
      settleTimer = window.setTimeout(() => setHandoff("none"), 1100);
    };

    apply(mq.matches, false);

    const onChange = (event: MediaQueryListEvent) => apply(event.matches, true);
    mq.addEventListener("change", onChange);
    return () => {
      window.clearTimeout(settleTimer);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  // Mutually exclusive modes so resting styles don't fight handoff animations.
  const rootClass = [
    "nav-test",
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
    ["--dock-bubble-h" as string]: `${bubble.h}px`,
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
    <section className={rootClass}>
      <style>{NAV_TEST_CSS}</style>

      <div
        className="nav-test-cover"
        style={{ backgroundImage: `url(${COVER_IMAGE})` }}
        role="img"
        aria-label={`${active} cover background`}
      />

      {/* Desktop / wide: black glass top nav (enters as bottom dock exits) */}
      <nav className="nav-test-top" aria-label="Experimental top navigation">
        <div className="nav-test-top-surface" aria-hidden="true" />
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
            role="slider"
            aria-label="Drag top navigation indicator"
            aria-valuetext={
              topDragHoverTab
                ? TABS.find((t) => t.id === topDragHoverTab)?.label
                : TABS.find((t) => t.id === active)?.label
            }
            aria-hidden={topBubble.visible ? undefined : true}
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

      <nav className="nav-test-dock" aria-label="Experimental bottom navigation">
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
    </section>
  );
}

const NAV_TEST_CSS = `
.nav-test {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  /* visible so dock rims / mask bleed aren't clipped at the page edge */
  overflow: visible;
  background: #0c0c0e;
}

/* Full-bleed cover behind the dock */
.nav-test-cover {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  /* Never steal taps/drags from the fixed dock / top nav */
  pointer-events: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

/* ── Top glass nav (wide screens) ──────────────────────────────── */
.nav-test-top {
  position: fixed;
  top: max(12px, env(safe-area-inset-top, 0px));
  left: 50%;
  /* Above cover (0) and bottom dock (10) */
  z-index: 20;
  width: min(720px, calc(100% - 32px));
  max-width: 720px;
  height: 56px;
  pointer-events: none;
  opacity: 0;
  transform: translate3d(-50%, calc(-100% - 28px), 0);
  filter: blur(10px);
  will-change: transform, opacity, filter, width, max-width;
  transition:
    width 320ms cubic-bezier(0.22, 1, 0.36, 1),
    max-width 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.nav-test-top-surface {
  position: absolute;
  inset: 0;
  border-radius: 0.8rem;
  background: rgb(0 0 0 / 75%);
  backdrop-filter: blur(4px) brightness(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid #ffffff4f;
  /* Soft rim lights: top-left + bottom-right */
  box-shadow:
    inset 3px 4px 1px -4px rgb(255 255 255),
    inset 9px 10px 7px -8px rgba(255, 255, 255, 0.18),
    inset -7px -6px 1px -6.7px rgb(255 255 255 / 58%),
    inset -8px -9px 4px -3px rgba(255, 255, 255, 0.12);
  pointer-events: none;
  transition: border-radius 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.nav-test-top-items {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  height: 100%;
  padding: 0 10px;
  pointer-events: none;
  transition:
    gap 280ms cubic-bezier(0.22, 1, 0.36, 1),
    padding 280ms cubic-bezier(0.22, 1, 0.36, 1),
    justify-content 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Top-nav sliding active indicator (mirrors bottom dock bubble) */
.nav-test-top-bubble,
.nav-test-top-bubble-active-glow,
.nav-test-top-bubble-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--top-bubble-w, 0px);
  height: var(--top-bubble-h, 0px);
  border-radius: var(--top-bubble-radius, 0.5rem);
  pointer-events: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transform: translate3d(
    var(--top-bubble-x, 0px),
    var(--top-bubble-y, 0px),
    0
  );
  transition:
    transform var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    width var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    border-radius var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
  will-change: transform, width, height, border-radius, opacity;
}

.nav-test-top-bubble {
  z-index: 0;
  opacity: var(--top-bubble-opacity, 0);
  background: linear-gradient(180deg, #0000002e, transparent);
  box-shadow:
    inset 3px 4px 1px -4px rgb(255 255 255 / 58%),
    inset 9px 10px 7px -8px rgba(255, 255, 255, 0.18),
    inset -7px -6px 1px -6.7px rgb(255 255 255 / 35%),
    inset -8px -9px 4px -3px rgb(255 255 255 / 5%);
}

.nav-test-top-bubble-active-glow {
  z-index: 0;
  background: linear-gradient(0deg, #ff004e00 7%, #ff004ead, #ff004e, #ff004e00);
  opacity: calc(var(--top-bubble-opacity, 0) * 0.5);
  background-position: center 27px;
  background-repeat: no-repeat;
  background-size: 130%;
  box-shadow: inset 4px 5px 0px -3px #ff0096;
  /* Slow fade-in after the indicator settles */
  transition:
    transform var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    width var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    border-radius var(--top-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Invisible drag handle above items so bubble can be grabbed */
.nav-test-top-bubble-handle {
  z-index: 12;
  background: transparent;
  box-shadow: none;
  opacity: 0;
}

.nav-test-top-bubble-handle.is-interactive {
  pointer-events: auto;
  cursor: grab;
}

.nav-test-top-bubble-handle.is-dragging,
.nav-test.is-dragging-top-bubble .nav-test-top-bubble-handle {
  cursor: grabbing;
  pointer-events: auto;
}

/* While dragging on desktop, hide the pink glow until settle */
.nav-test.is-dragging-top-bubble .nav-test-top-bubble-active-glow {
  opacity: 0;
  transition:
    transform 0ms linear,
    width 0ms linear,
    height 0ms linear,
    border-radius 0ms linear,
    opacity 140ms ease-out;
}

.nav-test.is-dragging-top-bubble .nav-test-top-item {
  pointer-events: none;
}

.nav-test-top-item.is-drag-target {
  color: #ff8fb1;
}

.nav-test-top-item.is-drag-target .nav-test-top-icon,
.nav-test-top-item.is-drag-target .nav-test-top-label {
  transform: scale(1.1);
}

.nav-test-top-slot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  flex: 1 1 0;
  transition: flex 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.nav-test-top-item {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  height: 40px;
  padding: 0 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  transition:
    color 160ms ease,
    transform 140ms ease,
    gap 280ms cubic-bezier(0.22, 1, 0.36, 1),
    padding 280ms cubic-bezier(0.22, 1, 0.36, 1),
    width 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* No hover/visited/active fill or brightness change — indicator owns chrome */
.nav-test-top-item:hover,
.nav-test-top-item:focus,
.nav-test-top-item:active,
.nav-test-top-item:visited {
  background: transparent;
  background-color: transparent;
  color: rgba(255, 255, 255, 0.5);
  opacity: 1;
}

.nav-test-top-item:active {
  transform: scale(0.97);
}

.nav-test-top-item.is-active,
.nav-test-top-item.is-drag-target {
  background: transparent;
  background-color: transparent;
  opacity: 1;
}

.nav-test-top-item.is-active,
.nav-test-top-item.is-drag-target {
  color: #ff8fb1;
}

.nav-test-top-item.is-primary.is-active {
  color: #ffb0c8;
}

.nav-test-top-item .nav-test-top-icon,
.nav-test-top-item .nav-test-top-label {
  position: relative;
  z-index: 1;
  transform: scale(1);
  transform-origin: center center;
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-test-top-item.is-active .nav-test-top-icon,
.nav-test-top-item.is-active .nav-test-top-label {
  transform: scale(1.1);
}

.nav-test-top-item:focus-visible {
  outline: 2px solid rgba(255, 143, 177, 0.9);
  outline-offset: 2px;
}

.nav-test-top-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.nav-test-top-label {
  display: inline-block;
  min-width: 0;
  max-width: 7.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 550;
  line-height: 1;
  letter-spacing: 0.01em;
  opacity: 1;
  transform: translateX(0);
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  pointer-events: none;
  transition:
    max-width 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
    margin 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

/*
 * Compact top nav: icon-only, centered.
 * Also force this during desktop→mobile handoff so labels don't flash
 * when the viewport crosses below 441px mid-exit animation.
 */
@media (min-width: 441px) and (max-width: 620px) {
  .nav-test-top {
    width: min(360px, calc(100% - 28px));
    max-width: 360px;
  }

  .nav-test-top-surface {
    border-radius: 0.8rem;
  }

  .nav-test-top-items {
    justify-content: space-around;
    gap: 2px;
    padding: 0 8px;
  }

  .nav-test-top-slot {
    flex: 0 0 auto;
  }

  .nav-test-top-item {
    gap: 0;
    width: 44px;
    padding: 0;
  }

  .nav-test-top-icon {
    transform: scale(1.08);
  }

  .nav-test-top-label {
    max-width: 0;
    opacity: 0;
    margin: 0;
    transform: translateX(-4px);
    pointer-events: none;
  }
}

/* Keep top nav icon-only for the entire mobile handoff (any width) */
.nav-test.is-handoff-to-mobile .nav-test-top {
  width: min(360px, calc(100% - 28px));
  max-width: 360px;
}

.nav-test.is-handoff-to-mobile .nav-test-top-surface {
  border-radius: 0.8rem;
}

.nav-test.is-handoff-to-mobile .nav-test-top-items {
  justify-content: space-around;
  gap: 2px;
  padding: 0 8px;
}

.nav-test.is-handoff-to-mobile .nav-test-top-slot {
  flex: 0 0 auto;
}

.nav-test.is-handoff-to-mobile .nav-test-top-item {
  gap: 0;
  width: 44px;
  padding: 0;
}

.nav-test.is-handoff-to-mobile .nav-test-top-icon {
  transform: scale(1.08);
}

.nav-test.is-handoff-to-mobile .nav-test-top-label {
  max-width: 0 !important;
  opacity: 0 !important;
  margin: 0 !important;
  transform: translateX(-4px);
  pointer-events: none;
  transition: none !important;
}

@keyframes nav-test-top-enter {
  0% {
    opacity: 0;
    transform: translate3d(-50%, calc(-100% - 28px), 0);
    filter: blur(10px);
  }
  55% {
    opacity: 1;
    filter: blur(0);
  }
  78% {
    transform: translate3d(-50%, 5px, 0);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(-50%, 0, 0);
    filter: blur(0);
  }
}

/* Top bar exit: anticipation dip, then lift up + blur */
@keyframes nav-test-top-exit {
  0% {
    opacity: 1;
    transform: translate3d(-50%, 0, 0) scale(1);
    filter: blur(0);
  }
  18% {
    opacity: 1;
    transform: translate3d(-50%, 10px, 0) scale(1.02);
    filter: blur(0);
  }
  45% {
    filter: blur(8px);
  }
  100% {
    opacity: 0;
    transform: translate3d(-50%, calc(-100% - 28px), 0) scale(0.98);
    filter: blur(18px);
  }
}

@keyframes nav-test-top-surface-exit {
  0% {
    opacity: 1;
    filter: blur(0);
  }
  10% {
    opacity: 1;
    filter: blur(4px);
  }
  28% {
    opacity: 0.88;
    filter: blur(12px);
  }
  100% {
    opacity: 0;
    filter: blur(22px);
  }
}

/* Top items: dip down slightly, then fly up + blur (mirror of dock fall) */
@keyframes nav-test-top-item-exit {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
  20% {
    opacity: 1;
    transform: translate3d(0, 8px, 0) scale(1.04);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, -42px, 0) scale(0.96);
    filter: blur(8px);
  }
}

/* Bottom dock enter — no overshoot, ease straight into place */
@keyframes nav-test-dock-enter {
  0% {
    transform: translate3d(-50%, calc(100% + env(safe-area-inset-bottom, 0px) + 28px), 0) scale(0.98);
    filter: blur(10px);
  }
  100% {
    transform: translate3d(-50%, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes nav-test-dock-shell-enter {
  0% {
    opacity: 0;
    filter: blur(12px);
  }
  100% {
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes nav-test-dock-item-enter {
  0% {
    opacity: 0;
    transform: translate3d(0, 42px, 0) scale(0.96);
    filter: blur(8px);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

/* Default: top nav off-screen (mobile resting state) */
.nav-test-top {
  /* resting transforms already set above; keep pointer-events off until active */
}

.nav-test-top-item {
  will-change: opacity, transform, filter;
}

/* Desktop resting: top nav visible, bottom dock hidden */
.nav-test.is-desktop .nav-test-top {
  opacity: 1;
  transform: translate3d(-50%, 0, 0);
  filter: blur(0);
  pointer-events: auto;
}

.nav-test.is-desktop .nav-test-top .nav-test-top-items {
  pointer-events: auto;
}

.nav-test.is-desktop .nav-test-dock {
  transform: translate3d(-50%, calc(100% + env(safe-area-inset-bottom, 0px) + 28px), 0);
  filter: blur(10px);
  pointer-events: none;
}

.nav-test.is-desktop .nav-test-dock .nav-test-dock-items {
  pointer-events: none;
}

.nav-test.is-desktop .nav-test-dock-surface,
.nav-test.is-desktop .nav-test-dock-rims,
.nav-test.is-desktop .nav-test-dock-primary,
.nav-test.is-desktop .nav-test-dock-item {
  opacity: 0;
}

/* Mobile → desktop: bottom exits, top enters */
.nav-test.is-handoff-to-desktop .nav-test-dock {
  animation: nav-test-dock-exit 820ms cubic-bezier(0.33, 1, 0.32, 1) 180ms both;
  pointer-events: none;
}

.nav-test.is-handoff-to-desktop .nav-test-dock .nav-test-dock-items {
  pointer-events: none;
}

.nav-test.is-handoff-to-desktop .nav-test-dock-surface,
.nav-test.is-handoff-to-desktop .nav-test-dock-rims,
.nav-test.is-handoff-to-desktop .nav-test-dock-primary {
  animation: nav-test-dock-shell-fade 800ms cubic-bezier(0.22, 1, 0.36, 1) 110ms both;
  transition: none;
}

.nav-test.is-handoff-to-desktop .nav-test-dock-item:nth-child(1),
.nav-test.is-handoff-to-desktop .nav-test-dock-item:nth-child(5) {
  animation: nav-test-dock-item-exit 560ms cubic-bezier(0.33, 1, 0.32, 1) 0ms both;
}

.nav-test.is-handoff-to-desktop .nav-test-dock-item:nth-child(2),
.nav-test.is-handoff-to-desktop .nav-test-dock-item:nth-child(4) {
  animation: nav-test-dock-item-exit 560ms cubic-bezier(0.33, 1, 0.32, 1) 100ms both;
}

.nav-test.is-handoff-to-desktop .nav-test-top {
  animation: nav-test-top-enter 720ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both;
  pointer-events: auto;
}

.nav-test.is-handoff-to-desktop .nav-test-top .nav-test-top-items {
  pointer-events: auto;
}

/*
 * Desktop → mobile: top exits UP first (staggered outside-in),
 * then bottom dock enters from below.
 */
.nav-test.is-handoff-to-mobile .nav-test-top {
  animation: nav-test-top-exit 780ms cubic-bezier(0.33, 1, 0.32, 1) 160ms both;
  pointer-events: none;
}

.nav-test.is-handoff-to-mobile .nav-test-top .nav-test-top-items {
  pointer-events: none;
}

.nav-test.is-handoff-to-mobile .nav-test-top-surface {
  animation: nav-test-top-surface-exit 720ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both;
}

/* Outside-in: Home+Profile, then Browse+Rewards, then Collection */
.nav-test.is-handoff-to-mobile .nav-test-top-slot:nth-child(1) .nav-test-top-item,
.nav-test.is-handoff-to-mobile .nav-test-top-slot:nth-child(5) .nav-test-top-item {
  animation: nav-test-top-item-exit 560ms cubic-bezier(0.33, 1, 0.32, 1) 0ms both;
}

.nav-test.is-handoff-to-mobile .nav-test-top-slot:nth-child(2) .nav-test-top-item,
.nav-test.is-handoff-to-mobile .nav-test-top-slot:nth-child(4) .nav-test-top-item {
  animation: nav-test-top-item-exit 560ms cubic-bezier(0.33, 1, 0.32, 1) 100ms both;
}

.nav-test.is-handoff-to-mobile .nav-test-top-slot:nth-child(3) .nav-test-top-item {
  animation: nav-test-top-item-exit 560ms cubic-bezier(0.33, 1, 0.32, 1) 160ms both;
}

/* Bottom dock waits for top exit to lead, then animates in (snappier) */
.nav-test.is-handoff-to-mobile .nav-test-dock {
  animation: nav-test-dock-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both;
  pointer-events: none;
}

.nav-test.is-handoff-to-mobile .nav-test-dock .nav-test-dock-items {
  pointer-events: none;
}

.nav-test.is-handoff-to-mobile .nav-test-dock-surface,
.nav-test.is-handoff-to-mobile .nav-test-dock-rims,
.nav-test.is-handoff-to-mobile .nav-test-dock-primary {
  animation: nav-test-dock-shell-enter 520ms cubic-bezier(0.22, 1, 0.36, 1) 300ms both;
  transition: none;
}

.nav-test.is-handoff-to-mobile .nav-test-dock-item:nth-child(1),
.nav-test.is-handoff-to-mobile .nav-test-dock-item:nth-child(5) {
  animation: nav-test-dock-item-enter 460ms cubic-bezier(0.22, 1, 0.36, 1) 310ms both;
}

.nav-test.is-handoff-to-mobile .nav-test-dock-item:nth-child(2),
.nav-test.is-handoff-to-mobile .nav-test-dock-item:nth-child(4) {
  animation: nav-test-dock-item-enter 460ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both;
}

/* After mobile handoff settles, restore item pointer events */
.nav-test.is-mobile:not(.is-handoff-to-mobile) .nav-test-dock .nav-test-dock-items {
  pointer-events: auto;
}

/* ── Experimental dock ─────────────────────────────────────────── */
.nav-test-dock {
  position: fixed;
  /* Centered horizontally; side inset keeps caps off the viewport edge */
  left: 50%;
  right: auto;
  /* Default / desktop: slight lift off bottom edge */
  bottom: calc(2.5dvh + env(safe-area-inset-bottom, 0px));
  /* Above cover (0); interactive children re-enable pointer-events */
  z-index: 30;
  width: min(
    400px,
    calc(100% - 2 * max(18px, env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px)))
  );
  max-width: 400px;
  height: 96px;
  overflow: visible;
  pointer-events: none;
  transform: translate3d(-50%, 0, 0);
  will-change: transform, filter;
  isolation: isolate;
}

/* Mobile: sit lower and stay fixed (dvh + safe-area) */
@media (max-width: 440px) {
  .nav-test-dock {
    position: fixed;
    /* Between original 2.5dvh lift and the too-low inset-only position */
    bottom: calc(env(safe-area-inset-bottom, 0px) + 0.1dvh);
  }
}

/*
 * Exit: slight anticipation lift, then fall away.
 * Delay lets outside-in tab fall start first.
 */
@keyframes nav-test-dock-exit {
  0% {
    transform: translate3d(-50%, 0, 0) scale(1);
    filter: blur(0);
  }
  /* Anticipation — crouch/lift opposite the exit */
  18% {
    transform: translate3d(-50%, -14px, 0) scale(1.025);
    filter: blur(0);
  }
  100% {
    transform: translate3d(-50%, calc(100% + env(safe-area-inset-bottom, 0px) + 28px), 0) scale(0.98);
    filter: blur(10px);
  }
}

@keyframes nav-test-dock-shell-fade {
  0%,
  12% {
    opacity: 1;
    filter: blur(0);
  }
  100% {
    opacity: 0;
    filter: blur(12px);
  }
}

/* Tab items: lift slightly, then fall + fade + blur out */
@keyframes nav-test-dock-item-exit {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
  /* Anticipation — opposite of the fall */
  20% {
    opacity: 1;
    transform: translate3d(0, -10px, 0) scale(1.04);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, 46px, 0) scale(0.96);
    filter: blur(8px);
  }
}

/* Shell pieces fade after tab items start falling */
.nav-test-dock-surface,
.nav-test-dock-rims,
.nav-test-dock-primary {
  opacity: 1;
  transition: opacity 600ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: 0ms;
}

/* Tab items — base state for stagger fall-away */
.nav-test-dock-item {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  transition: color 160ms ease;
  will-change: opacity, transform, filter;
}

@media (prefers-reduced-motion: reduce) {
  .nav-test-dock,
  .nav-test-dock-surface,
  .nav-test-dock-rims,
  .nav-test-dock-primary,
  .nav-test-dock-item,
  .nav-test-top,
  .nav-test-top-surface,
  .nav-test-top-items,
  .nav-test-top-slot,
  .nav-test-top-item,
  .nav-test-top-icon,
  .nav-test-top-label {
    animation: none !important;
    transition: none !important;
    transition-delay: 0ms !important;
  }
}

/*
 * Glass fill — masked with the SVG path so backdrop-filter follows the
 * dock silhouette. clip-path leaves blur rectangular in most engines.
 */
.nav-test-dock-surface {
  position: absolute;
  /* Symmetric bleed so both end caps + stroke AA have room */
  right: -3px;
  bottom: 9px;
  left: -3px;
  height: 93px;
  pointer-events: none;
  background: rgb(0 0 0 / 75%);
  backdrop-filter: blur(4px) brightness(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  /* Avoid filter/mask paint getting clipped to the border box */
  overflow: visible;
}

/* ── Rim light sets (left / center / right strips) ──────────────── */
.nav-test-dock-rims {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  overflow: visible;
  transform: translate(0, 2px);
}

.top-left-rim-light,
.middle-right-rim-light,
.bottom-right-rim-light {
  position: relative;
  flex: 0 0 auto;
  width: 10dvw;
  height: 96px;
  overflow: visible;
  pointer-events: none;
}

.top-left-rim-light {
  transform-origin: top left;
  height: 71.3%;
  transform: translate(-0.6vw, 0vw) scaleY(102.3%) scaleX(101.6%);
  opacity: 0.7;
}

.middle-right-rim-light {
  transform-origin: top center;
  width: 68px;
  height: 65px;
  align-self: flex-start;
  transform: translate(0%, -7%);
}

.bottom-right-rim-light {
  transform-origin: top right;
  height: 71.3%;
  transform: translate(0%, -0.7%) scaleY(101.6%) scaleX(73.4%);
  opacity: 0.7;
}

.rim-left-a,
.rim-left-a-b,
.rim-center-a,
.rim-center-a-b,
.rim-right-a,
.rim-right-a-b {
  position: absolute;
  inset: 0;
  box-sizing: content-box;
  width: 10dvw;
  height: 96px;
  border: 2px solid #fff;
  background: transparent;
  pointer-events: none;
}

.rim-left-a {
  transform-origin: top left;
  border-radius: 2.5rem 0 0 2.5rem;
  width: 34dvw;
  height: 100%;
  border-top: 1px solid #fff;
  border-left: 1px solid #fff;
  border-right: 0;
  border-bottom: 0;
  -webkit-mask-image: linear-gradient(147deg, black, transparent 50%);
  mask-image: linear-gradient(147deg, black, transparent 50%);
}

.rim-left-a-b {
  transform-origin: top left;
  border-radius: 2.5rem 0 0 2.5rem;
  width: 32dvw;
  height: 100%;
  border-top: 1px solid #fff;
  border-left: 1px solid #fff;
  border-right: 0;
  border-bottom: 0;
  filter: blur(3px);
  transform: translate(0%, 2%);
  -webkit-mask-image: linear-gradient(90deg, black 80%, transparent);
  mask-image: linear-gradient(90deg, black 80%, transparent);
}

.rim-center-a {
  transform-origin: top center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid #fff;
  -webkit-mask-image: linear-gradient(0deg, #000000d9, transparent 5%);
  mask-image: linear-gradient(0deg, #000000d9, transparent 5%);
}

.rim-center-a-b {
  transform-origin: top center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid #fff;
  filter: blur(1px);
  -webkit-mask-image: linear-gradient(0deg, #00000082, transparent 84% 20%);
  mask-image: linear-gradient(0deg, #00000082, transparent 84% 20%);
}

.rim-right-a {
  transform-origin: top right;
  border-radius: 0 2.5rem 2.5rem 0;
  width: 70dvw;
  height: 100%;
  right: 0;
  left: auto;
  border-bottom: 1px solid #fff;
  border-right: 1px solid #fff;
  border-left: 0;
  border-top: 0;
  -webkit-mask-image: linear-gradient(48deg, transparent 20%, black, transparent 80%);
  mask-image: linear-gradient(48deg, transparent 20%, black, transparent 80%);
}

.rim-right-a-b {
  transform-origin: top right;
  border-radius: 0 2.5rem 2.5rem 0;
  width: 80dvw;
  height: 100%;
  right: 0;
  left: auto;
  border-bottom: 1px solid #fff;
  border-right: 1px solid #fff;
  border-left: 0;
  border-top: 0;
  filter: blur(3px);
  transform: translate(-0.3%, -1%);
  -webkit-mask-image: linear-gradient(9deg, transparent 20%, black, transparent 80%);
  mask-image: linear-gradient(9deg, transparent 20%, black, transparent 80%);
}

.nav-test-dock-items {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: end;
  height: 78px;
  padding: 0px 10px 18px;
  pointer-events: auto;
  touch-action: manipulation;
  /* Prevent iOS long-press text selection / callouts on dock labels */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* Shared sliding active bubble (iOS-style) behind icons + labels */
.nav-test-dock-bubble,
.nav-test-dock-bubble-active-glow,
.nav-test-dock-bubble-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--dock-bubble-w, 0px);
  height: var(--dock-bubble-h, 0px);
  border-radius: var(--dock-bubble-radius, 0.5rem);
  pointer-events: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transform: translate3d(
      var(--dock-bubble-x, 0px),
      var(--dock-bubble-y, 0px),
      0
    )
    scale(var(--dock-bubble-scale, 1));
  transform-origin: center center;
  transition:
    transform var(--dock-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    width var(--dock-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--dock-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    border-radius var(--dock-bubble-duration, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    opacity 70ms ease-out,
    filter 70ms ease-out;
  will-change: transform, width, height, border-radius, opacity, filter;
}

.nav-test-dock-bubble,
.nav-test-dock-bubble-active-glow {
  background: linear-gradient(180deg, #0000002e, transparent);
  box-shadow:
    inset 3px 4px 1px -4px rgb(255 255 255 / 58%),
    inset 9px 10px 7px -8px rgba(255, 255, 255, 0.18),
    inset -7px -6px 1px -6.7px rgb(255 255 255 / 35%),
    inset -8px -9px 4px -3px rgb(255 255 255 / 5%);
  /* Fade + blur when sliding under Collection */
  opacity: var(--dock-bubble-opacity, 0);
  filter: blur(var(--dock-bubble-blur, 0px));
}

.nav-test-dock-bubble-active-glow {
  /* Under Collection hero + regular tab content */
  z-index: 0;
  background: linear-gradient(0deg, #ff004e, #ff004e00);
  opacity: var(--dock-bubble-glow-opacity, 0.5);
  background-position: center 30px;
  background-repeat: no-repeat;
  background-size: 60px;
  box-shadow: inset 4px 5px 0px -3px #ff0096;
}

.nav-test-dock-bubble {
  /* Above glow, under Collection hero */
  z-index: 1;
}

/*
 * Invisible drag handle shares bubble geometry but sits above tabs so it can
 * be grabbed. Visual bubble stays under Collection.
 * Opacity stays 0 visually but hit-testing uses the box (pointer-events).
 */
.nav-test-dock-bubble-handle {
  z-index: 12;
  background: transparent;
  box-shadow: none;
  opacity: 0;
  filter: none;
  /* Keep full-size hit target even when visual bubble ducks */
  transform: translate3d(
    var(--dock-bubble-x, 0px),
    var(--dock-bubble-y, 0px),
    0
  );
}

.nav-test-dock-bubble-handle.is-interactive {
  pointer-events: auto;
  cursor: grab;
  /* Keep handle hittable even when visual bubble is faded under Collection */
  opacity: 0;
}

.nav-test-dock-bubble-handle.is-dragging,
.nav-test.is-dragging-bubble .nav-test-dock-bubble-handle {
  cursor: grabbing;
  pointer-events: auto;
  opacity: 0;
}

/* While dragging, let the handle own the gesture (don't steal via tabs) */
.nav-test.is-dragging-bubble .nav-test-dock-item,
.nav-test.is-dragging-bubble .nav-test-dock-primary {
  pointer-events: none;
}

.nav-test-dock-item.is-drag-target {
  color: #ff8fb1;
}

.nav-test-dock-item {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  align-content: end;
  gap: 5px;
  min-width: 0;
  height: 100%;
  padding: 0 0 10px;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.42);
  cursor: pointer;
  transition: color 180ms ease;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  /* opacity/transform transitions defined with dock hide animation above */
}

.nav-test-dock-item.is-active {
  color: #ff8fb1;
  background: transparent;
  box-shadow: none;
}

.nav-test-dock-item .nav-test-dock-icon,
.nav-test-dock-item .nav-test-dock-label {
  position: relative;
  z-index: 1;
  transform: translate3d(0, 0, 0) scale(1);
  transform-origin: center bottom;
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  pointer-events: none; /* let the button own the gesture on iOS */
}

.nav-test-dock-item.is-active .nav-test-dock-icon,
.nav-test-dock-item.is-active .nav-test-dock-label,
.nav-test-dock-item.is-drag-target .nav-test-dock-icon,
.nav-test-dock-item.is-drag-target .nav-test-dock-label {
  transform: translate3d(0, 1px, 0) scale(1.2);
}

@media (max-width: 440px) {
  .nav-test-dock-item:active {
    transform: scale(0.96);
    transition: transform 140ms ease, color 160ms ease;
  }
}

.nav-test-dock-item:focus-visible {
  outline: 2px solid rgba(255, 143, 177, 0.9);
  outline-offset: 2px;
}

.nav-test-dock-icon {
  width: 21px;
  height: 21px;
}

.nav-test-dock-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.nav-test-dock-primary {
  position: relative;
  /* Above sliding indicator so bubble travels under Collection */
  z-index: 8;
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 6px;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* Hero button — Collection icon + cutout glow (~10% larger) */
.nav-test-dock-primary-glow,
.nav-test-hero-btn {
  position: absolute;
  top: -14px;
  left: 50%;
  z-index: 9;
  width: 60px;
  height: 60px;
  border: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  transform: translate(-50%, -6px);
  transition: transform 160ms ease;
}

.nav-test-dock-primary-glow.border-glow-card {
  background: transparent !important;
}

.nav-test-dock-primary-glow .border-glow-inner {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  overflow: visible;
  background: transparent;
}

/*
 * Soft orbiting rim + circular center hole (glass shows through).
 * Hole driven by debug CSS vars:
 *   --cutout-x / --cutout-y / --cutout-size / --cutout-feather
 *   --cutout-edge-size / --cutout-edge-feather
 */
.nav-test-dock-primary-glow.border-glow-orbiting::before {
  -webkit-mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      #000 0%,
      #000 18%,
      transparent 42%,
      transparent 58%,
      #000 82%,
      #000 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      #000 0%,
      #000 18%,
      transparent 42%,
      transparent 58%,
      #000 82%,
      #000 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.nav-test-dock-primary-glow.border-glow-orbiting::after {
  -webkit-mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      transparent 0%,
      #000 10%,
      #000 30%,
      transparent 48%,
      transparent 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      transparent 0%,
      #000 10%,
      #000 30%,
      transparent 48%,
      transparent 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

/*
 * Drop outer bloom (.edge-light + multi box-shadow) — expensive on mobile
 * while the rim mesh (::before/::after) keeps orbiting.
 */
.nav-test-dock-primary-glow > .edge-light,
.nav-test-dock-primary-glow > .edge-light::before {
  display: none !important;
  opacity: 0 !important;
  box-shadow: none !important;
  mix-blend-mode: normal !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
}

.nav-test-dock-primary-btn {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #ff8fb1;
  cursor: pointer;
  transition: transform 160ms ease, color 180ms ease;
}

.nav-test-dock-primary.is-active .nav-test-dock-primary-btn {
  color: #ffb0c8;
}

.nav-test-dock-primary-glow:active {
  transform: translate(-50%, -6px) scale(0.97);
}

.nav-test-dock-primary-btn:focus-visible {
  outline: 2px solid rgba(255, 143, 177, 0.9);
  outline-offset: 3px;
}

.nav-test-dock-primary-icon {
  width: 28px;
  height: 28px;
  filter: drop-shadow(0 0 7px rgba(255, 86, 157, 0.35));
}

.nav-test-dock-primary-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  transform: translateY(5px);
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  pointer-events: none;
}

.nav-test-dock-primary.is-active .nav-test-dock-primary-label {
  color: #ff8fb1;
}
`;
