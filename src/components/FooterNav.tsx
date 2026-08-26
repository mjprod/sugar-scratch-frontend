import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Compass,
  Home,
  Menu,
  User,
  type LucideIcon,
} from "lucide-react";
import type { AppTab } from "@/types/app";

export type BottomNavTabId =
  | "home"
  | "explore"
  | "collection"
  | "rewards"
  | "profile";

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

type NavItemConfig = {
  id: BottomNavTabId;
  label: string;
  icon: LucideIcon | typeof DiamondIcon | typeof CollectionIcon;
  appTab: AppTab;
  primary?: boolean;
};

const TABS: NavItemConfig[] = [
  { id: "home", label: "Discover", icon: Compass, appTab: "home" },
  { id: "explore", label: "Home", icon: Home, appTab: "feed" },
  {
    id: "collection",
    label: "My Collection",
    icon: CollectionIcon,
    appTab: "bag",
    primary: true,
  },
  { id: "rewards", label: "Store", icon: DiamondIcon, appTab: "hub" },
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
