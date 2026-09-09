import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Compass,
  Home,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";
import { CurrencyBalances } from "@/components/CurrencyBalances";
import { InboxUtilityBadge, PacksButton } from "@/components/InboxButton";
import { BorderGlow } from "@/components/ui/BorderGlow";
import { useAuth } from "@/contexts/AuthContext";
import type { AppTab } from "@/types/app";
import {
  DESKTOP_MIN_PX,
  DESKTOP_PRIMARY_LABELS,
  MOBILE_DOCK_LABELS,
} from "@/lib/navChrome";
import "./LiquidGlassNav.css";

export { DESKTOP_MIN_PX, NAV_LABEL_MIN_PX } from "@/lib/navChrome";

const DESKTOP_MQ = `(min-width: ${DESKTOP_MIN_PX}px)`;

function isDesktopViewport() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia(DESKTOP_MQ).matches && window.innerWidth >= DESKTOP_MIN_PX
  );
}
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
  /** Left end-cap (Discover tab is first). */
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

type NavIcon =
  | LucideIcon
  | typeof LoginIcon
  | typeof DiamondIcon
  | typeof CollectionIcon;

type TabConfig = {
  id: AppTab;
  label: string;
  icon: NavIcon;
  primary?: boolean;
};

function GuestCollectionIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  return (
    <svg
      viewBox="4.8 5.6 10.3 9.4"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M5.8 6.1s.4.7 1.2.9c-.7.3-1.1 1-1.2 1.7-.4-.3-.7-1 0-2.6Z"
      />
      <path
        fill="currentColor"
        d="M10.5 13.5l-.5.5-.5-.5c-1.9-1.7-3.1-2.8-3.1-4.2s.9-2 2-2 1.2.3 1.6.8c.4-.5 1-.8 1.6-.8 1.1 0 2 .9 2 2s-1.2 2.5-3.1 4.2Z"
      />
      <path
        fill="currentColor"
        d="M14.2 8.8c0-.8-.5-1.4-1.2-1.8.4 0 .8-.4 1.3-.9 0 0 .9 1.7-.1 2.7Z"
      />
    </svg>
  );
}

function LoginIcon({
  className,
  strokeWidth = 2,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={["nav-login-icon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <path
        d="M17,12l-4,4M13,8l4,4M3,12h14M8,8v-1c0-1.7,1.3-3,3-3h7c1.7,0,3,1.3,3,3v10c0,1.7-1.3,3-3,3h-7c-1.7,0-3-1.3-3-3v-1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Store tab — sourced from /public/svg/iconDiamond.svg */
function DiamondIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={["nav-diamond-icon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M11.329 19.159q-.323-.14-.566-.432L3.267 9.731q-.186-.217-.28-.475t-.093-.55q0-.187.047-.366q.048-.18.134-.361l1.779-3.59q.217-.405.603-.647t.845-.242h11.396q.46 0 .845.242t.603.646l1.779 3.59q.087.182.134.362t.047.366q0 .292-.094.55t-.28.475l-7.495 8.996q-.243.292-.566.432q-.323.139-.671.139t-.671-.14M8.817 8.5h6.366l-2-4h-2.366zm2.683 9.56V9.5H4.392zm1 0l7.108-8.56H12.5zm3.792-9.56h3.766L18.23 4.846q-.077-.154-.231-.25t-.327-.096h-3.38zm-12.35 0h3.766l2-4H6.327q-.173 0-.327.096t-.23.25z"
      />
    </svg>
  );
}

/** My Collection tab — stacked cards mark (14 artboard, padded for stroke). */
function CollectionIcon({
  className,
  strokeWidth = 1.8,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  // Lucide icons use ~1.8–2.1 on a 24 viewBox; scale to this 14 artboard.
  const sw = Math.max(0.9, (strokeWidth * 14) / 24);
  return (
    <svg
      viewBox="-1 -1 16 16"
      fill="none"
      overflow="visible"
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.546.857a.475.475 0 0 1 .581-.335l6.02 1.612a.475.475 0 0 1 .337.581l-2.31 8.618a.475.475 0 0 1-.582.335l-6.02-1.612a.475.475 0 0 1-.336-.581z" />
        <path d="M6.108 2.535L.852 3.944a.475.475 0 0 0-.336.581l2.308 8.618a.475.475 0 0 0 .582.335l3.01-.806" />
      </g>
    </svg>
  );
}

/** Mobile dock order. AC8a: Discover, Home, My Collection (center), Store, Profile. */
export const TABS: TabConfig[] = [
  { id: "home", label: MOBILE_DOCK_LABELS[0], icon: Compass },
  { id: "feed", label: MOBILE_DOCK_LABELS[1], icon: Home },
  {
    id: "bag",
    label: MOBILE_DOCK_LABELS[2],
    icon: CollectionIcon,
    primary: true,
  },
  { id: "hub", label: MOBILE_DOCK_LABELS[3], icon: DiamondIcon },
  { id: "profile", label: MOBILE_DOCK_LABELS[4], icon: User },
];

/**
 * Desktop top bar primary tabs.
 * Profile is icon-only in the right utility cluster (not in this list).
 * AC4: Home, Discover, Store, My Collection.
 */
export const DESKTOP_TABS: TabConfig[] = [
  { id: "feed", label: DESKTOP_PRIMARY_LABELS[0], icon: Home },
  { id: "home", label: DESKTOP_PRIMARY_LABELS[1], icon: Compass },
  { id: "hub", label: DESKTOP_PRIMARY_LABELS[2], icon: DiamondIcon },
  {
    id: "bag",
    label: DESKTOP_PRIMARY_LABELS[3],
    icon: CollectionIcon,
    primary: true,
  },
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

/**
 * Exactly 3 mesh colors for Collection BorderGlow rim.
 * Keep hex — BorderGlow gradient mesh consumes these as CSS color stops and
 * some engines/pipelines still resolve hex more reliably than oklch here.
 */
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

/** Fixed dock bubble size — keep in sync with --dock-bubble-* in CSS. */
const DOCK_BUBBLE_H_REM = 3.3;
/** After dock-items gap, keep indicator at a compact fixed width. */
const DOCK_BUBBLE_W_REM = 3.8;

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
  const bubbleH = remToPx(DOCK_BUBBLE_H_REM);
  const bubbleW = remToPx(DOCK_BUBBLE_W_REM);
  // Vertically center the fixed-height bubble, then nudge up ~5px
  // so the indicator sits with the icon/label cluster.
  const bubbleY =
    rect.top - parentRect.top + (rect.height - bubbleH) / 2 - 5;

  // Center the fixed-width bubble on the tab cell (works with dock-items gap).
  let bubbleX =
    rect.left - parentRect.left + (rect.width - bubbleW) / 2;

  // Side-pad compensation for end caps (Discover / Profile)
  if (tabId === "home") {
    bubbleX -= 2;
  } else if (tabId === "profile") {
    bubbleX += 2;
  }

  return {
    x: bubbleX,
    y: bubbleY,
    w: bubbleW,
    h: bubbleH,
    radius: bubbleRadiusForTab(tabId),
  };
}

type TopNavTarget = AppTab | "cart";

/** Top-nav bubble — centered on the item, includes Collection and cart. */
function measureTopBubbleForTab(
  parent: HTMLElement,
  target: HTMLElement,
  tabId: TopNavTarget,
): Omit<DockBubble, "visible" | "ready" | "underCollection"> {
  const parentRect = parent.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  // Pocket is a smaller hit target than Profile; match Profile's indicator height.
  const heightRect =
    tabId === "cart"
      ? parent
          .querySelector<HTMLElement>(".nav-test-top-profile")
          ?.getBoundingClientRect() ?? rect
      : rect;
  // Slight outer pad so the pill reads roomier than the label (esp. My Collection).
  const padX = tabId === "profile" || tabId === "cart" ? 8 : 6;
  const insetY = 4;
  const fullH = Math.max(0, heightRect.height - insetY * 2);
  const bubbleH = fullH * 1.2;
  const bubbleY = rect.top - parentRect.top + (rect.height - bubbleH) / 2;

  // Top nav has uniform corners — no Home/Profile end-cap compensation
  const bubbleX = rect.left - parentRect.left - padX;
  const bubbleW = Math.max(0, rect.width + padX * 2);

  return {
    x: bubbleX,
    y: bubbleY,
    w: bubbleW,
    h: bubbleH,
    radius: BUBBLE_RADIUS.default,
  };
}

export type LiquidGlassNavProps = {
  activeTab: AppTab | null;
  onTabChange: (tab: AppTab) => void;
  onReselect?: (tab: AppTab) => void;
  hidden?: boolean;
  /** Desktop top-bar balances (optional — omitted on playground). */
  coins?: number | null;
  diamonds?: number | null;
  onOpenStore?: () => void;
  onOpenUnopenedPacks?: () => void;
  /** Desktop search control (opens global search overlay). */
  onOpenSearch?: () => void;
  /** Cart / Pack Pocket is active — bubble sits on the cart utility. */
  packsActive?: boolean;
  /** Search overlay open — highlights the search control. */
  searchActive?: boolean;
  /** Hide the mobile bottom dock (purchase keeps the top bar only). */
  hideDock?: boolean;
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
  coins = null,
  diamonds = null,
  onOpenStore,
  onOpenUnopenedPacks,
  onOpenSearch,
  packsActive = false,
  searchActive = false,
  hideDock = false,
}: LiquidGlassNavProps) {
  const { authed, guestAuthLabel, inboxUnread } = useAuth();
  const desktopTabs = useMemo(
    () => (authed ? DESKTOP_TABS : DESKTOP_TABS.filter((tab) => tab.id !== "bag")),
    [authed],
  );
  // AC26: guests hide My Collection on the mobile dock (desktop already filters).
  const dockTabs = useMemo(() => {
    const tabs = authed ? TABS : TABS.filter((tab) => tab.id !== "bag");
    return tabs.map((tab) =>
      tab.id === "profile" && !authed
        ? { ...tab, label: guestAuthLabel, icon: LoginIcon }
        : tab,
    );
  }, [authed, guestAuthLabel]);
  const active = packsActive ? null : activeTab;
  const [isDesktop, setIsDesktop] = useState(isDesktopViewport);
  const [handoff, setHandoff] = useState<NavHandoff>("none");
  const [bubble, setBubble] = useState<DockBubble>(HIDDEN_BUBBLE);
  const [topBubble, setTopBubble] = useState<DockBubble>(HIDDEN_BUBBLE);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [isDraggingTopBubble, setIsDraggingTopBubble] = useState(false);
  const [dragHoverTab, setDragHoverTab] = useState<AppTab | null>(null);
  const [topDragHoverTab, setTopDragHoverTab] = useState<TopNavTarget | null>(
    null,
  );
  const [utilsOverlap, setUtilsOverlap] = useState(0);
  const topUtilsRef = useRef<HTMLDivElement>(null);

  const dockItemsRef = useRef<HTMLDivElement>(null);
  const dockTabRefs = useRef<Array<HTMLElement | null>>([]);
  const topBarRef = useRef<HTMLElement>(null);
  const topItemsRef = useRef<HTMLDivElement>(null);
  const topTabRefs = useRef<Array<HTMLElement | null>>([]);
  const topProfileRef = useRef<HTMLButtonElement>(null);
  const topCartRef = useRef<HTMLButtonElement>(null);
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
      tabs: TabConfig[],
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

      for (let index = 0; index < tabs.length; index += 1) {
        const tab = tabs[index];
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
      findNearestTab(clientX, dockTabRefs.current, dockTabs, {
        ignorePrimary: true,
      }),
    [dockTabs, findNearestTab],
  );

  const measureUtilsOverlap = useCallback(
    (bubbleX: number, bubbleW: number) => {
      const parent = topBarRef.current;
      const utils = topUtilsRef.current;
      if (!parent || !utils || bubbleW <= 0) return 0;

      const parentRect = parent.getBoundingClientRect();
      const utilsRect = utils.getBoundingClientRect();
      const utilsLeft = utilsRect.left - parentRect.left;
      const utilsRight = utilsRect.right - parentRect.left;
      const bubbleLeft = bubbleX;
      const bubbleRight = bubbleX + bubbleW;
      const overlap = Math.min(bubbleRight, utilsRight) - Math.max(bubbleLeft, utilsLeft);
      return overlap > 0 ? 1 : 0;
    },
    [],
  );

  const findNearestTopTab = useCallback(
    (clientX: number) => {
      type Candidate = {
        id: TopNavTarget;
        index: number;
        el: HTMLElement;
        dist: number;
      };
      let best: Candidate | null = findNearestTab(
        clientX,
        topTabRefs.current,
        desktopTabs,
      );

      const consider = (
        id: TopNavTarget,
        el: HTMLElement | null,
        index: number,
      ) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - cx);
        const hit = clientX >= rect.left && clientX <= rect.right;
        const score = hit ? dist * 0.25 : dist;
        if (!best || score < best.dist) {
          best = { id, index, el, dist: score };
        }
      };

      consider("cart", topCartRef.current, desktopTabs.length);
      consider("profile", topProfileRef.current, desktopTabs.length + 1);
      return best;
    },
    [desktopTabs, findNearestTab],
  );

  /** 0–1 how centered the bubble is under Collection (smooth falloff). */
  const measureUnderCollection = useCallback(
    (bubbleX: number, bubbleW: number) => {
      const parent = dockItemsRef.current;
      const collectionIndex = dockTabs.findIndex((tab) => tab.primary);
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
    [dockTabs],
  );

  const updateDockBubble = useCallback(() => {
    if (bubbleDragRef.current) return;

    const parent = dockItemsRef.current;
    const activeIndex = dockTabs.findIndex((tab) => tab.id === active);
    const activeTabConfig = dockTabs[activeIndex];
    const target = dockTabRefs.current[activeIndex];

    // Hero/Collection slot has its own glow treatment — hide shared bubble.
    // Cart is a top-bar destination, so the dock indicator stays off.
    if (
      packsActive ||
      !parent ||
      !target ||
      !activeTabConfig ||
      activeTabConfig.primary
    ) {
      setBubble((prev) => ({
        ...prev,
        underCollection: 0,
        visible: false,
        // Keep ready so a later tab change can still animate from last geometry.
        ready: prev.ready,
      }));
      return;
    }

    const measured = measureBubbleForTab(parent, target, activeTabConfig.id);
    setBubble((prev) => ({
      ...measured,
      underCollection: measureUnderCollection(measured.x, measured.w),
      visible: true,
      // First placement must stay duration:0 until after paint, otherwise the
      // bubble slides up from the default (0,0) origin on load.
      ready: prev.ready,
    }));
  }, [active, dockTabs, measureUnderCollection, packsActive]);

  const updateTopBubble = useCallback(() => {
    if (topBubbleDragRef.current) return;

    const parent = topBarRef.current;
    let target: HTMLElement | null = null;
    let activeTabId: TopNavTarget | undefined;

    if (packsActive) {
      target = topCartRef.current;
      activeTabId = "cart";
    } else if (active === "profile") {
      target = topProfileRef.current;
      activeTabId = "profile";
    } else {
      const activeIndex = desktopTabs.findIndex((tab) => tab.id === active);
      target = topTabRefs.current[activeIndex] ?? null;
      activeTabId = desktopTabs[activeIndex]?.id;
    }

    if (!parent || !target || !activeTabId) {
      setTopBubble((prev) => ({
        ...prev,
        visible: false,
        ready: prev.ready,
      }));
      return;
    }

    const measured = measureTopBubbleForTab(parent, target, activeTabId);
    setTopBubble((prev) => ({
      ...measured,
      underCollection: 0,
      visible: true,
      // Same first-paint snap as the dock bubble.
      ready: prev.ready,
    }));
  }, [active, desktopTabs, packsActive]);

  useLayoutEffect(() => {
    updateDockBubble();
    updateTopBubble();
  }, [updateDockBubble, updateTopBubble, handoff, isDesktop]);

  // After the first measured geometry has painted with duration:0, arm
  // transitions so later tab/drag moves ease instead of sliding from (0,0).
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    const needsDockArm = bubble.visible && !bubble.ready && bubble.w > 0;
    const needsTopArm = topBubble.visible && !topBubble.ready && topBubble.w > 0;
    if (!needsDockArm && !needsTopArm) return;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (needsDockArm) {
          setBubble((prev) =>
            prev.visible && !prev.ready && prev.w > 0
              ? { ...prev, ready: true }
              : prev,
          );
        }
        if (needsTopArm) {
          setTopBubble((prev) =>
            prev.visible && !prev.ready && prev.w > 0
              ? { ...prev, ready: true }
              : prev,
          );
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [
    bubble.ready,
    bubble.visible,
    bubble.w,
    topBubble.ready,
    topBubble.visible,
    topBubble.w,
  ]);

  useEffect(() => {
    const dockParent = dockItemsRef.current;
    const topParent = topBarRef.current;

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

  /** Logo always leaves secondary/immersive routes (tear, pack pocket, etc.). */
  const goHome = useCallback(() => {
    if (suppressTabClickRef.current) return;
    onTabChange("feed");
  }, [onTabChange]);

  const handleTopBubblePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (!topBubble.visible) return;

      const parent = topBarRef.current;
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
      setTopDragHoverTab(packsActive ? "cart" : active);
      event.preventDefault();
    },
    [
      active,
      packsActive,
      topBubble.h,
      topBubble.visible,
      topBubble.w,
      topBubble.x,
      topBubble.y,
    ],
  );

  const handleTopBubblePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = topBubbleDragRef.current;
      const parent = topBarRef.current;
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
      const overlapW = nearest
        ? measureTopBubbleForTab(parent, nearest.el, nearest.id).w
        : drag.width;
      setUtilsOverlap(
        nearest?.id === "cart" ? 0 : measureUtilsOverlap(nextX, overlapW),
      );

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
    [findNearestTopTab, measureUtilsOverlap],
  );

  const endTopBubbleDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = topBubbleDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const parent = topBarRef.current;
      const moved = drag.moved;
      topBubbleDragRef.current = null;
      setIsDraggingTopBubble(false);
      setTopDragHoverTab(null);
      setUtilsOverlap(0);

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
          if (nearest.id === "cart") {
            onOpenUnopenedPacks?.();
          } else {
            onTabChange(nearest.id);
          }
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
    [findNearestTopTab, onOpenUnopenedPacks, onTabChange, updateTopBubble],
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

    const sync = (animate: boolean) => apply(isDesktopViewport(), animate);

    sync(false);

    const onChange = () => sync(true);
    mq.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    window.visualViewport?.addEventListener("resize", onChange);
    return () => {
      window.clearTimeout(settleTimer);
      mq.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
      window.visualViewport?.removeEventListener("resize", onChange);
      delete document.body.dataset.liquidNav;
    };
  }, []);

  // Mutually exclusive modes so resting styles don't fight handoff animations.
  const rootClass = [
    "nav-test",
    "liquid-glass-nav",
    hidden ? "is-chrome-hidden" : "",
    hideDock ? "is-dock-hidden" : "",
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

  // AC7: only the visible chrome lane is keyboard-focusable (dock XOR top).
  const topNavKeyboard = !hidden && isDesktop;
  const dockKeyboard = !hidden && !hideDock && !isDesktop;
  const topTabIndex = topNavKeyboard ? undefined : -1;
  const dockTabIndex = dockKeyboard ? undefined : -1;

  // Soften under Collection: fade + blur + duck scale (handle stays interactive)
  const under = bubble.underCollection;
  // Almost fully gone under Collection
  const bubbleVisualOpacity = bubble.visible ? 1 - under * 0.99 : 0;
  const bubbleVisualBlur = under * 10;
  const glowVisualOpacity = bubble.visible ? 0.5 * (1 - under) : 0;
  // Duck hard under Collection — scale down to ~72%
  const bubbleVisualScale = 1 - under * 0.28;

  const dockBubbleStyle = {
    ["--dock-bubble-x" as string]: bubble.ready
      ? `${bubble.x}px`
      : "4.7rem",
    ["--dock-bubble-y" as string]: `${bubble.y}px`,
    ["--dock-bubble-w" as string]: bubble.ready
      ? `${bubble.w}px`
      : `${DOCK_BUBBLE_W_REM}rem`,
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
    ["--top-bubble-opacity" as string]: topBubble.visible
      ? String(1 - utilsOverlap)
      : "0",
    ["--top-bubble-scale" as string]: String(1 - utilsOverlap * 0.4),
    ["--top-bubble-duration" as string]:
      isDraggingTopBubble || !topBubble.ready ? "0ms" : "420ms",
    ["--top-bubble-opacity-duration" as string]: isDraggingTopBubble
      ? "80ms"
      : "220ms",
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
        ref={topBarRef}
        className="nav-test-top glass glass-strength-40 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
        aria-label="Primary"
        aria-hidden={topNavKeyboard ? undefined : true}
        {...(!topNavKeyboard ? { inert: true } : {})}
        style={topBubbleStyle}
      >
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
        <button
          type="button"
          className="nav-test-top-brand"
          aria-label="Sugar Scratch Home"
          tabIndex={topTabIndex}
          onClick={goHome}
        >
          <img
            src="/svg/logoSugarScratch.svg"
            alt="Sugar Scratch"
            className="nav-test-top-brand-logo"
            draggable={false}
          />
        </button>

        <div className="nav-test-top-items" ref={topItemsRef}>
          {desktopTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = !packsActive && active === tab.id;
            const isDragTarget =
              isDraggingTopBubble && topDragHoverTab === tab.id;

            return (
              <div key={tab.id} className="nav-test-top-slot">
                <button
                  ref={(node) => {
                    topTabRefs.current[index] = node;
                    topTabRefs.current.length = desktopTabs.length;
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
                  tabIndex={topTabIndex}
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

        <div className="liquid-glass-desktop-utils nav-test-top-utils">
          {authed ? (
            <div ref={topUtilsRef} className="nav-test-top-utils-hover">
              <CurrencyBalances
                coins={coins}
                diamonds={diamonds}
                onOpenStore={onOpenStore}
              />
            </div>
          ) : null}
          {onOpenSearch ? (
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search"
              aria-pressed={searchActive}
              tabIndex={topTabIndex}
              className={[
                "inbox-utility-btn inbox-utility-btn--ghost relative grid size-11 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/85 active:scale-95",
                searchActive ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Search className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
            </button>
          ) : null}
          {authed && onOpenUnopenedPacks ? (
            <PacksButton
              ref={topCartRef}
              onOpen={onOpenUnopenedPacks}
              variant="ghost"
              active={packsActive || topDragHoverTab === "cart"}
              className={
                isDraggingTopBubble && topDragHoverTab === "cart"
                  ? "is-drag-target"
                  : ""
              }
            />
          ) : null}
          <button
            ref={topProfileRef}
            type="button"
            className={[
              "nav-test-top-profile",
              authed ? "" : "is-login",
              !packsActive && active === "profile" ? "is-active" : "",
              isDraggingTopBubble && topDragHoverTab === "profile"
                ? "is-drag-target"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={authed ? "Profile" : guestAuthLabel}
            aria-current={
              !packsActive && active === "profile" ? "page" : undefined
            }
            tabIndex={topTabIndex}
            onClick={() => selectTab("profile")}
          >
            {authed ? (
              <User
                className="nav-test-top-profile-icon"
                strokeWidth={
                  (!packsActive && active === "profile") ||
                  topDragHoverTab === "profile"
                    ? 2.1
                    : 1.8
                }
                fill={
                  (!packsActive && active === "profile") ||
                  topDragHoverTab === "profile"
                    ? "currentColor"
                    : "none"
                }
                fillOpacity={
                  (!packsActive && active === "profile") ||
                  topDragHoverTab === "profile"
                    ? 0.2
                    : 0
                }
                aria-hidden="true"
              />
            ) : (
              <>
                <LoginIcon className="nav-test-top-profile-icon" />
                <span className="nav-test-top-profile-label">{guestAuthLabel}</span>
              </>
            )}
          </button>
        </div>
      </nav>

      <div
        className="nav-test-dock-wrap"
        aria-hidden={dockKeyboard ? undefined : true}
        {...(!dockKeyboard ? { inert: true } : {})}
      >
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
                  ? dockTabs.find((t) => t.id === dragHoverTab)?.label
                  : dockTabs.find((t) => t.id === active)?.label
              }
              aria-hidden={bubble.visible ? undefined : true}
              onPointerDown={handleBubblePointerDown}
              onPointerMove={handleBubblePointerMove}
              onPointerUp={endBubbleDrag}
              onPointerCancel={endBubbleDrag}
            />

            {dockTabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = !packsActive && active === tab.id;
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
                      !authed ? "is-guest-disabled" : "",
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
                        tabIndex={dockTabIndex}
                        onClick={() => selectTab(tab.id)}
                      >
                        {authed ? (
                          <Icon
                            className="nav-test-dock-primary-icon"
                            aria-hidden="true"
                          />
                        ) : (
                          <GuestCollectionIcon className="nav-test-dock-primary-guest-card" />
                        )}
                      </button>
                    </BorderGlow>
                    {authed ? (
                      <span className="nav-test-dock-primary-label" aria-hidden="true">
                        {tab.label}
                      </span>
                    ) : null}
                  </div>
                );
              }

              const showInboxBadge =
                tab.id === "profile" && authed && inboxUnread > 0;
              const itemLabel =
                showInboxBadge
                  ? `${tab.label}, ${inboxUnread} unread`
                  : tab.label;

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
                  aria-label={itemLabel}
                  tabIndex={dockTabIndex}
                  onClick={() => selectTab(tab.id)}
                >
                  <span className="nav-test-dock-icon-wrap">
                    <Icon
                      className="nav-test-dock-icon"
                      strokeWidth={isActive || isDragTarget ? 2.1 : 1.8}
                      fill={isActive || isDragTarget ? "currentColor" : "none"}
                      fillOpacity={isActive || isDragTarget ? 0.2 : 0}
                      aria-hidden="true"
                    />
                    {showInboxBadge ? (
                      <InboxUtilityBadge count={inboxUnread} tone="inbox" />
                    ) : null}
                  </span>
                  <span className="nav-test-dock-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
