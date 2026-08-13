import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import type { AppTab } from "@/types/app";
import { CurrencyBalances } from "@/components/CurrencyBalances";
import { InboxButton } from "@/components/InboxButton";
import { MobileDiamondUtility } from "@/components/MobileDiamondBalance";

const DESKTOP_DESTINATIONS: { id: AppTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "feed", label: "Browse" },
  { id: "bag", label: "Collection" },
  { id: "hub", label: "Hub" },
];

const SCROLL_SELECTOR = "[data-page-scroll], .hf-viewport, .app-page-shell, .inbox-page";

/** Top Navigation — mobile Diamond + Inbox utility + desktop global header. */
export function TopNav({
  coins,
  diamonds,
  activeTab,
  onTabChange,
  onProfile,
  onOpenStore,
  onOpenInbox,
  inboxUnreadCount = 0,
  inboxActive = false,
  storeActive = false,
  showBalances = true,
  showMobileDiamond = true,
  showInbox = true,
}: {
  coins: number | null;
  diamonds: number | null;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onProfile: () => void;
  onSettings?: () => void;
  onSearch?: () => void;
  onOpenStore?: () => void;
  onOpenInbox?: () => void;
  inboxUnreadCount?: number;
  /** Bell active while Inbox route is open — primary tabs stay neutral. */
  inboxActive?: boolean;
  /** Subtle diamond utility active while Store is open. */
  storeActive?: boolean;
  showBalances?: boolean;
  /** Immersive / guest flows set false via App shell. */
  showMobileDiamond?: boolean;
  /** Hide on Inbox route to avoid redundant self-nav. */
  showInbox?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const primaryActive = inboxActive || storeActive ? null : activeTab;

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll(SCROLL_SELECTOR)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );

    const readScrolled = () => {
      setScrolled(nodes.some((node) => node.scrollTop > 8));
    };

    readScrolled();
    nodes.forEach((node) => {
      node.addEventListener("scroll", readScrolled, { passive: true });
    });
    return () => {
      nodes.forEach((node) => {
        node.removeEventListener("scroll", readScrolled);
      });
    };
  }, [activeTab]);

  const mobileInbox =
    showInbox && onOpenInbox ? (
      <InboxButton
        unreadCount={inboxUnreadCount}
        onOpen={onOpenInbox}
        variant="ghost"
        active={inboxActive}
      />
    ) : null;

  const desktopInbox =
    showInbox && onOpenInbox ? (
      <InboxButton
        unreadCount={inboxUnreadCount}
        onOpen={onOpenInbox}
        variant="ghost"
        active={inboxActive}
      />
    ) : null;

  return (
    <>
      <MobileDiamondUtility
        coins={coins}
        balance={diamonds}
        onOpenStore={onOpenStore}
        onOpenHome={() => onTabChange("home")}
        visible={showMobileDiamond && showBalances}
        trailing={mobileInbox}
      />

      <header
        className={[
          "top-nav-desktop fixed inset-x-0 top-0 z-[var(--app-top-nav-z-index,30)] hidden h-[var(--app-top-nav-height,56px)] lg:block",
          scrolled ? "is-scrolled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="top-nav-desktop-inner mx-auto flex h-full max-w-[1280px] items-center gap-6 px-4 lg:px-8">
          <button
            type="button"
            onClick={() => onTabChange("home")}
            className="top-nav-brand shrink-0 text-[18px] font-bold tracking-[-0.03em] text-white/90 transition hover:text-white"
          >
            Sugar
          </button>
          <nav aria-label="Primary" className="top-nav-primary flex items-center gap-0.5">
            {DESKTOP_DESTINATIONS.map((destination) => {
              const active = destination.id === primaryActive;
              return (
                <button
                  key={destination.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onTabChange(destination.id)}
                  className={[
                    "top-nav-link relative h-9 px-3 text-[13px] font-semibold transition-colors",
                    active
                      ? "top-nav-link--active text-white/92"
                      : "text-white/45 hover:text-white/75",
                  ].join(" ")}
                >
                  {destination.label}
                  {active ? (
                    <motion.span
                      layoutId="v8-desktop-nav"
                      className="top-nav-link-indicator absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-brand"
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="top-nav-utils ml-auto flex items-center gap-3">
            {showBalances ? (
              <CurrencyBalances
                coins={coins}
                diamonds={diamonds}
                onOpenStore={storeActive ? undefined : onOpenStore}
                storeActive={storeActive}
              />
            ) : null}
            {desktopInbox}
            <button
              type="button"
              aria-label="Profile"
              aria-current={activeTab === "profile" ? "page" : undefined}
              onClick={onProfile}
              className={[
                "top-nav-profile grid min-h-10 min-w-10 place-items-center rounded-md transition active:scale-95",
                activeTab === "profile"
                  ? "top-nav-profile--active"
                  : "text-white/55 hover:bg-white/[0.06] hover:text-white/85",
              ].join(" ")}
            >
              <UserRound className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
