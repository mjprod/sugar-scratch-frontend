import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Compass,
  Gift,
  Home,
  Layers3,
  Menu,
  User,
} from "lucide-react";
import type { AppTab } from "@/types/app";

export type BottomNavTabId =
  | "home"
  | "explore"
  | "collection"
  | "rewards"
  | "profile";

type NavItemConfig = {
  id: BottomNavTabId;
  label: string;
  icon: typeof Home;
  appTab: AppTab;
  primary?: boolean;
};

const TABS: NavItemConfig[] = [
  { id: "home", label: "Home", icon: Home, appTab: "home" },
  { id: "explore", label: "Browse", icon: Compass, appTab: "feed" },
  {
    id: "collection",
    label: "Collection",
    icon: Layers3,
    appTab: "bag",
    primary: true,
  },
  { id: "rewards", label: "Hub", icon: Gift, appTab: "hub" },
  { id: "profile", label: "Profile", icon: User, appTab: "profile" },
];

const COLLAPSE_KEY = "sugar.v8.bottomNav.collapsed";

export type NavBadge =
  | { type: "dot" }
  | { type: "count"; value: number }
  | { type: "new" };

export type FooterBadge = NavBadge;

function appTabToBottom(tab: AppTab): BottomNavTabId | null {
  return TABS.find((t) => t.appTab === tab)?.id ?? null;
}

/**
 * BottomNav — collapsible frosted bar.
 * Expanded: full 5-tab nav. Collapsed: FAB bottom-right to reopen.
 */
export function BottomNav({
  tab,
  onChange,
  onReselect,
  hidden = false,
  badges,
}: {
  tab: AppTab | null;
  onChange: (tab: AppTab) => void;
  onReselect?: (tab: AppTab) => void;
  hidden?: boolean;
  badges?: Partial<Record<BottomNavTabId, NavBadge>>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(sessionStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function setCollapsedPersist(next: boolean) {
    setCollapsed(next);
    try {
      sessionStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  if (typeof document === "undefined") return null;

  const activeId = tab ? appTabToBottom(tab) : null;
  const ActiveIcon =
    TABS.find((t) => t.id === activeId)?.icon ?? Menu;
  const barHidden = hidden || collapsed;

  function handleSelect(entry: NavItemConfig) {
    if (activeId === entry.id) {
      onReselect?.(entry.appTab);
      window.dispatchEvent(
        new CustomEvent("sugar:footer-reselect", {
          detail: { tab: entry.appTab },
        }),
      );
      const scroller = document.querySelector<HTMLElement>("[data-page-scroll]");
      if (scroller && scroller.scrollTop > 2) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        scroller.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }
      return;
    }
    onChange(entry.appTab);
  }

  function a11yLabel(entry: NavItemConfig) {
    const badge = badges?.[entry.id];
    const base =
      activeId === entry.id ? `${entry.label}, current page` : entry.label;
    if (!badge) return base;
    if (badge.type === "count") {
      const n = badge.value > 99 ? "99+" : String(badge.value);
      return `${base}, ${n} notifications`;
    }
    if (badge.type === "new") return `${base}, new`;
    return `${base}, notification`;
  }

  return createPortal(
    <>
      <nav
        aria-label="Primary navigation"
        aria-hidden={barHidden || undefined}
        className={[
          "bottom-nav",
          barHidden ? "is-hidden" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          className="bottom-nav-collapse"
          tabIndex={barHidden ? -1 : undefined}
          aria-label="Hide navigation"
          onClick={() => setCollapsedPersist(true)}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>

        <div className="bottom-nav-surface">
          {TABS.map((entry) => {
            const isActive = activeId === entry.id;
            const badge = badges?.[entry.id];

            if (entry.primary) {
              const Icon = entry.icon;
              return (
                <div
                  key={entry.id}
                  className={[
                    "bottom-nav-collection",
                    isActive ? "is-active" : "",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    className="bottom-nav-collection-btn"
                    tabIndex={barHidden ? -1 : undefined}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={a11yLabel(entry)}
                    onClick={() => handleSelect(entry)}
                  >
                    <Icon className="bottom-nav-collection-icon" aria-hidden="true" />
                    {badge ? <NavBadgeMark badge={badge} /> : null}
                  </button>
                  <span className="bottom-nav-collection-label" aria-hidden="true">
                    {entry.label}
                  </span>
                </div>
              );
            }

            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                className={["bottom-nav-item", isActive ? "is-active" : ""].join(" ")}
                tabIndex={barHidden ? -1 : undefined}
                aria-current={isActive ? "page" : undefined}
                aria-label={a11yLabel(entry)}
                onClick={() => handleSelect(entry)}
              >
                <span className="bottom-nav-icon-wrap">
                  <Icon
                    className="bottom-nav-icon"
                    strokeWidth={isActive ? 2.1 : 1.8}
                    fill={isActive ? "currentColor" : "none"}
                    fillOpacity={isActive ? 0.2 : 0}
                    aria-hidden="true"
                  />
                  {badge ? <NavBadgeMark badge={badge} /> : null}
                </span>
                <span className="bottom-nav-label">{entry.label}</span>
                <span className="bottom-nav-indicator" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </nav>

      <button
        type="button"
        className={[
          "bottom-nav-fab",
          collapsed && !hidden ? "is-visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Show navigation"
        aria-hidden={!collapsed || hidden || undefined}
        tabIndex={collapsed && !hidden ? undefined : -1}
        onClick={() => setCollapsedPersist(false)}
      >
        <ActiveIcon className="bottom-nav-fab-icon" aria-hidden="true" />
        {badges?.collection ? (
          <span className="bottom-nav-fab-dot" aria-hidden="true" />
        ) : null}
      </button>
    </>,
    document.body,
  );
}

/** App-compatible wrapper */
export function FooterNav({
  active,
  onChange,
  visible = true,
  bagBadge,
  hidden,
}: {
  active: AppTab | null;
  onChange: (tab: AppTab) => void;
  visible?: boolean;
  bagBadge?: NavBadge | boolean;
  hidden?: boolean;
}) {
  if (!visible) return null;

  const badges: Partial<Record<BottomNavTabId, NavBadge>> | undefined =
    bagBadge === true
      ? { collection: { type: "dot" } }
      : bagBadge && typeof bagBadge === "object"
        ? { collection: bagBadge }
        : undefined;

  return (
    <BottomNav
      tab={active}
      onChange={onChange}
      hidden={hidden}
      badges={badges}
    />
  );
}

function NavBadgeMark({ badge }: { badge: NavBadge }) {
  if (badge.type === "dot") {
    return <span className="bottom-nav-badge is-dot" aria-hidden="true" />;
  }
  if (badge.type === "new") {
    return (
      <span className="bottom-nav-badge is-pill" aria-hidden="true">
        NEW
      </span>
    );
  }
  const n = badge.value > 99 ? "99+" : String(badge.value);
  return (
    <span className="bottom-nav-badge is-pill" aria-hidden="true">
      {n}
    </span>
  );
}
