import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { CurrencyBalances, formatBalance } from "@/components/CurrencyBalances";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useAuth } from "@/contexts/AuthContext";
import "@/components/LiquidGlassNav.css";

type MobileTopTarget = "pack-pocket" | "search";

type MobileTopBubble = {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  ready: boolean;
};

const HIDDEN_MOBILE_TOP_BUBBLE: MobileTopBubble = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  visible: false,
  ready: false,
};

function measureMobileTopBubble(
  parent: HTMLElement,
  target: HTMLElement,
): Omit<MobileTopBubble, "visible" | "ready"> {
  const parentRect = parent.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const padX = 8;
  const insetY = 4;
  const fullH = Math.max(0, rect.height - insetY * 2);
  const bubbleH = fullH * 2.4;
  return {
    x: rect.left - parentRect.left - padX,
    y: rect.top - parentRect.top + insetY + (fullH - bubbleH) / 2,
    w: Math.max(0, rect.width + padX * 2),
    h: bubbleH,
  };
}

/**
 * Compact diamond control — used on secondary subpage trailings (Store/Settings).
 * Mobile TopNav uses CurrencyBalances instead.
 */
export function MobileDiamondBalance({
  balance,
  onOpenStore,
  className = "",
  standalone = false,
}: {
  balance: number | null;
  /** Omit when already on Store (display only). */
  onOpenStore?: () => void;
  className?: string;
  /** Full pill chrome when shown alone (e.g. Store header). */
  standalone?: boolean;
}) {
  const label = formatBalance(balance);
  const classes = [
    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-1.5 py-1 transition active:scale-95",
    standalone
      ? "border border-white/[0.1] bg-[oklch(0.196_0_0)]/90 px-3 py-1.5 shadow-soft backdrop-blur-md"
      : "",
    onOpenStore ? "hover:bg-white/10" : "",
    className,
  ].join(" ");

  const inner = (
    <>
      <DiamondLottie className="shrink-0" size={14} aria-hidden />
      <span className="min-w-[1.25ch] text-[13px] font-semibold tabular-nums text-white">
        {label}
      </span>
    </>
  );

  if (onOpenStore) {
    return (
      <button
        type="button"
        onClick={onOpenStore}
        aria-label={`Diamond balance: ${label}. Open Store.`}
        className={classes}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={classes} aria-label={`Diamond balance: ${label}`} aria-live="polite">
      {inner}
    </span>
  );
}

/** Compact mobile utility HUD — brand + inline resources + inbox. lg:hidden. */
export function MobileDiamondUtility({
  coins,
  balance,
  onOpenStore,
  onOpenHome,
  onOpenPackPocket,
  onOpenSearch,
  packsActive = false,
  searchActive = false,
  visible = true,
  trailing,
  showBrand = true,
}: {
  coins?: number | null;
  balance: number | null;
  onOpenStore?: () => void;
  onOpenHome?: () => void;
  onOpenPackPocket?: () => void;
  onOpenSearch?: () => void;
  packsActive?: boolean;
  searchActive?: boolean;
  visible?: boolean;
  /** e.g. PacksButton (ghost) — sits beside balances. */
  trailing?: ReactNode;
  showBrand?: boolean;
}) {
  const { guest } = useAuth();
  const { pathname } = useLocation();
  const [loginReveal, setLoginReveal] = useState(false);
  const [logoutReveal, setLogoutReveal] = useState(false);
  const wasAuthedRef = useRef(!guest);
  const pendingLogoutRef = useRef(false);
  const headerRef = useRef<HTMLElement>(null);
  const trailingRef = useRef<HTMLDivElement>(null);
  const [cartBubble, setCartBubble] = useState<MobileTopBubble>(
    HIDDEN_MOBILE_TOP_BUBBLE,
  );
  const [isDraggingTopBubble, setIsDraggingTopBubble] = useState(false);
  const [dragHoverTarget, setDragHoverTarget] =
    useState<MobileTopTarget | null>(null);
  const topBubbleDragRef = useRef<{
    pointerId: number;
    grabOffsetX: number;
    originY: number;
    startX: number;
    moved: boolean;
    width: number;
    height: number;
  } | null>(null);
  const suppressUtilityClickRef = useRef(false);

  const activeTarget: MobileTopTarget | null = packsActive
    ? "pack-pocket"
    : searchActive
      ? "search"
      : null;

  const getTargetButton = useCallback((id: MobileTopTarget) => {
    const root = trailingRef.current;
    if (!root) return null;
    return root.querySelector<HTMLElement>(
      id === "pack-pocket"
        ? 'button[data-top-nav-target="pack-pocket"]'
        : 'button[data-top-nav-target="search"]',
    );
  }, []);

  const findNearestTopTarget = useCallback(
    (clientX: number): { id: MobileTopTarget; el: HTMLElement } | null => {
      const candidates: Array<{ id: MobileTopTarget; el: HTMLElement }> = [];
      const pack = getTargetButton("pack-pocket");
      const search = getTargetButton("search");
      if (pack) candidates.push({ id: "pack-pocket", el: pack });
      if (search) candidates.push({ id: "search", el: search });
      if (candidates.length === 0) return null;

      let best: { id: MobileTopTarget; el: HTMLElement; dist: number } | null =
        null;
      for (const candidate of candidates) {
        const rect = candidate.el.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - center);
        if (!best || dist < best.dist) {
          best = { ...candidate, dist };
        }
      }
      return best ? { id: best.id, el: best.el } : null;
    },
    [getTargetButton],
  );

  const updateTopBubble = useCallback(() => {
    const parent = headerRef.current;
    if (!parent || !activeTarget) {
      setCartBubble((prev) =>
        prev.visible ? { ...prev, visible: false } : prev,
      );
      return;
    }
    const target = getTargetButton(activeTarget);
    if (!target) {
      setCartBubble((prev) =>
        prev.visible ? { ...prev, visible: false } : prev,
      );
      return;
    }
    const measured = measureMobileTopBubble(parent, target);
    setCartBubble((prev) => ({
      ...measured,
      visible: true,
      ready: prev.ready && prev.visible,
    }));
  }, [activeTarget, getTargetButton]);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasAuthed = wasAuthedRef.current;
    wasAuthedRef.current = !guest;

    if (!guest) {
      pendingLogoutRef.current = false;
      setLogoutReveal(false);
      if (reduce) {
        setLoginReveal(false);
        return;
      }
      setLoginReveal(true);
      const timer = window.setTimeout(() => setLoginReveal(false), 1550);
      return () => window.clearTimeout(timer);
    }

    setLoginReveal(false);
    if (!wasAuthed || reduce) {
      pendingLogoutRef.current = false;
      setLogoutReveal(false);
      return;
    }

    pendingLogoutRef.current = true;
  }, [guest]);

  useEffect(() => {
    if (!pendingLogoutRef.current || !guest) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      pendingLogoutRef.current = false;
      setLogoutReveal(false);
      return;
    }

    let startTimer = 0;
    let endTimer = 0;
    startTimer = window.setTimeout(() => {
      pendingLogoutRef.current = false;
      setLogoutReveal(true);
      endTimer = window.setTimeout(() => setLogoutReveal(false), 1100);
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [guest, pathname]);

  useLayoutEffect(() => {
    if (isDraggingTopBubble) return;
    updateTopBubble();
    const parent = headerRef.current;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (topBubbleDragRef.current) return;
      updateTopBubble();
    });
    ro.observe(parent);
    if (trailingRef.current) ro.observe(trailingRef.current);
    window.addEventListener("resize", updateTopBubble);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateTopBubble);
    };
  }, [
    pathname,
    trailing,
    loginReveal,
    logoutReveal,
    packsActive,
    searchActive,
    isDraggingTopBubble,
    updateTopBubble,
  ]);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    if (!cartBubble.visible || cartBubble.ready || cartBubble.w <= 0) return;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setCartBubble((prev) =>
          prev.visible && !prev.ready && prev.w > 0
            ? { ...prev, ready: true }
            : prev,
        );
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [cartBubble.ready, cartBubble.visible, cartBubble.w]);

  const handleTopBubblePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (!cartBubble.visible) return;

      const parent = headerRef.current;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const grabOffsetX = event.clientX - parentRect.left - cartBubble.x;

      topBubbleDragRef.current = {
        pointerId: event.pointerId,
        grabOffsetX,
        originY: cartBubble.y,
        startX: event.clientX,
        moved: false,
        width: cartBubble.w,
        height: cartBubble.h,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDraggingTopBubble(true);
      setDragHoverTarget(activeTarget);
      event.preventDefault();
    },
    [
      activeTarget,
      cartBubble.h,
      cartBubble.visible,
      cartBubble.w,
      cartBubble.x,
      cartBubble.y,
    ],
  );

  const handleTopBubblePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = topBubbleDragRef.current;
      const parent = headerRef.current;
      if (!drag || !parent || event.pointerId !== drag.pointerId) return;

      const dx = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) > 4) {
        drag.moved = true;
      }

      const parentRect = parent.getBoundingClientRect();
      const nextX = event.clientX - parentRect.left - drag.grabOffsetX;
      const nextY = drag.originY;
      const nearest = findNearestTopTarget(event.clientX);
      setDragHoverTarget(nearest?.id ?? null);

      if (nearest) {
        const measured = measureMobileTopBubble(parent, nearest.el);
        setCartBubble((prev) => ({
          ...prev,
          x: nextX,
          y: nextY,
          w: measured.w,
          h: measured.h,
          visible: true,
          ready: true,
        }));
      } else {
        setCartBubble((prev) => ({
          ...prev,
          x: nextX,
          y: nextY,
          visible: true,
          ready: true,
        }));
      }
    },
    [findNearestTopTarget],
  );

  const endTopBubbleDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = topBubbleDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const parent = headerRef.current;
      const moved = drag.moved;
      topBubbleDragRef.current = null;
      setIsDraggingTopBubble(false);
      setDragHoverTarget(null);

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
        suppressUtilityClickRef.current = true;
        window.setTimeout(() => {
          suppressUtilityClickRef.current = false;
        }, 0);

        const nearest = findNearestTopTarget(event.clientX);
        if (nearest) {
          if (nearest.id === "pack-pocket") {
            onOpenPackPocket?.();
          } else {
            onOpenSearch?.();
          }
          const measured = measureMobileTopBubble(parent, nearest.el);
          setCartBubble({
            ...measured,
            visible: true,
            ready: true,
          });
          return;
        }
      }

      updateTopBubble();
    },
    [findNearestTopTarget, onOpenPackPocket, onOpenSearch, updateTopBubble],
  );

  if (!visible) return null;

  const cartBubbleStyle = {
    ["--top-bubble-x" as string]: `${cartBubble.x}px`,
    ["--top-bubble-y" as string]: `${cartBubble.y}px`,
    ["--top-bubble-w" as string]: `${cartBubble.w}px`,
    ["--top-bubble-h" as string]: `${cartBubble.h}px`,
    ["--top-bubble-radius" as string]: "0.5rem",
    ["--top-bubble-opacity" as string]: cartBubble.visible ? "1" : "0",
    ["--top-bubble-scale" as string]: "1",
    ["--top-bubble-duration" as string]:
      isDraggingTopBubble || !cartBubble.ready ? "0ms" : "420ms",
    ["--top-bubble-opacity-duration" as string]: isDraggingTopBubble
      ? "80ms"
      : "220ms",
  } satisfies CSSProperties;

  return (
    <header
      ref={headerRef}
      className={[
        "top-nav-mobile glass glass-strength-40 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface fixed top-0 z-[var(--app-top-nav-z-index,30)] lg:hidden",
        loginReveal ? "is-login-reveal" : "",
        logoutReveal ? "is-logout-reveal" : "",
        isDraggingTopBubble ? "is-dragging-top-bubble" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Utilities"
      style={cartBubbleStyle}
      data-top-drag-hover={dragHoverTarget ?? undefined}
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
          cartBubble.visible ? "is-interactive" : "",
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
      <div className="top-nav-mobile-inner">
        {showBrand ? (
          onOpenHome ? (
            <button
              type="button"
              onClick={onOpenHome}
              aria-label="Sugar Scratch Home"
              className="top-nav-brand shrink-0 transition hover:opacity-90"
            >
              <img
                src="/svg/logoSugarScratch.svg"
                alt="Sugar Scratch"
                className="top-nav-brand-logo h-9 w-auto"
                draggable={false}
              />
            </button>
          ) : (
            <span className="top-nav-brand shrink-0">
              <img
                src="/svg/logoSugarScratch.svg"
                alt="Sugar Scratch"
                className="top-nav-brand-logo h-9 w-auto"
                draggable={false}
              />
            </span>
          )
        ) : (
          <span className="flex-1" aria-hidden />
        )}
        <div className="top-nav-mobile-utils flex items-center gap-1.5">
          {!guest ? (
            <CurrencyBalances
              coins={coins ?? null}
              diamonds={balance}
              onOpenStore={onOpenStore}
            />
          ) : null}
          {trailing ? (
            <div
              ref={trailingRef}
              className={[
                "top-nav-mobile-trailing",
                isDraggingTopBubble ? "is-dragging-top-bubble" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClickCapture={(event) => {
                if (!suppressUtilityClickRef.current) return;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {trailing}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
