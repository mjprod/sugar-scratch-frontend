import { motion } from "framer-motion";
import { Gem, Search, Settings, Sparkles, UserRound } from "lucide-react";
import type { AppTab } from "../flow/types";

const DESKTOP_DESTINATIONS: { id: AppTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "feed", label: "Browse" },
  { id: "bag", label: "Collection" },
  { id: "hub", label: "Rewards" },
  { id: "profile", label: "Profile" },
];

/** Top Navigation 2.0 — page-specific mobile variants + desktop global header. */
export function TopNav({
  coins,
  diamonds,
  activeTab,
  onTabChange,
  onProfile,
  onSettings,
  onSearch,
  onOpenStore,
}: {
  coins: number;
  diamonds: number | null;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onProfile: () => void;
  onSettings: () => void;
  onSearch?: () => void;
  /** Diamond balance shortcut — same Store landing as the Rewards Store card. */
  onOpenStore?: () => void;
}) {
  return (
    <>
      <nav
        aria-label="Top navigation"
        className={[
          "pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-[max(12px,env(safe-area-inset-top))] lg:hidden",
          activeTab === "feed" ? "text-white" : "",
          activeTab === "home" || activeTab === "bag" || activeTab === "feed"
            ? "hidden"
            : "",
        ].join(" ")}
      >
        <motion.div
          key={activeTab}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={[
            "pointer-events-auto mx-auto flex h-14 w-full max-w-[420px] items-center px-3",
            activeTab === "feed"
              ? "bg-gradient-to-b from-black/65 to-transparent"
              : "rounded-[24px] border border-white/[0.08] bg-[#151515]/88 shadow-soft backdrop-blur-lg",
          ].join(" ")}
        >
          {activeTab === "home" ? (
            <>
              <span className="text-[21px] font-bold tracking-[-0.03em]">Sugar</span>
              <div className="ml-auto">
                <Balances coins={coins} diamonds={diamonds} onOpenStore={onOpenStore} />
              </div>
            </>
          ) : activeTab === "feed" ? (
            <>
              <span className="text-[16px] font-semibold">For You</span>
              <div className="ml-auto">
                <IconBtn label="Search Explore" onClick={onSearch ?? (() => {})}>
                  <Search className="size-5" />
                </IconBtn>
              </div>
            </>
          ) : activeTab === "hub" ? (
            <>
              <span className="text-[18px] font-bold">Rewards</span>
              <div className="ml-auto">
                <Balances coins={coins} diamonds={diamonds} onOpenStore={onOpenStore} />
              </div>
            </>
          ) : activeTab === "bag" ? (
            <>
              <span className="text-[18px] font-bold">Collection</span>
              <div className="ml-auto">
                <IconBtn label="Search Collection" onClick={onSearch ?? (() => {})}>
                  <Search className="size-5" />
                </IconBtn>
              </div>
            </>
          ) : (
            <>
              <span className="text-[18px] font-bold">Profile</span>
              <div className="ml-auto">
                <IconBtn label="Open Settings" onClick={onSettings}>
                  <Settings className="size-5" />
                </IconBtn>
              </div>
            </>
          )}
        </motion.div>
      </nav>

      <header className="sticky top-0 z-30 hidden h-[72px] border-b border-white/[0.08] bg-[#090909]/88 backdrop-blur-xl lg:block">
        <div className="mx-auto flex h-full max-w-[1280px] items-center gap-8 px-4">
          <button
            type="button"
            onClick={() => onTabChange("home")}
            className="text-[22px] font-bold tracking-[-0.03em]"
          >
            Sugar
          </button>
          <nav aria-label="Primary" className="flex items-center gap-1">
            {DESKTOP_DESTINATIONS.map((destination) => {
              const active = destination.id === activeTab;
              return (
                <button
                  key={destination.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onTabChange(destination.id)}
                  className={[
                    "relative h-11 rounded-full px-4 text-[14px] font-semibold transition-colors",
                    active ? "text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80",
                  ].join(" ")}
                >
                  {destination.label}
                  {active ? (
                    <motion.span
                      layoutId="v8-desktop-nav"
                      className="absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-[#8B5CF6]"
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Balances coins={coins} diamonds={diamonds} onOpenStore={onOpenStore} />
            <button
              type="button"
              aria-label="Open Profile"
              aria-current={activeTab === "profile" ? "page" : undefined}
              onClick={onProfile}
              className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/10"
            >
              <UserRound className="size-5" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

function formatBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}

function Balances({
  coins,
  diamonds,
  onOpenStore,
}: {
  coins: number;
  diamonds: number | null;
  onOpenStore?: () => void;
}) {
  const diamondLabel = formatBalance(diamonds);

  return (
    <div
      className="flex min-w-0 items-center justify-center gap-3"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5" aria-label={`${coins} Sugar Coins`}>
        <Sparkles className="size-3.5 shrink-0 text-champagne" aria-hidden />
        <span className="text-[13px] font-semibold tabular-nums text-white">
          {coins.toLocaleString()}
        </span>
      </div>
      <span className="h-3 w-px bg-white/20" aria-hidden />
      <button
        type="button"
        onClick={onOpenStore}
        aria-label={`${diamondLabel} Diamonds, open Store`}
        className="flex min-h-11 min-w-11 items-center gap-1.5 rounded-full px-2 transition active:scale-95 hover:bg-white/10"
      >
        <Gem className="size-3.5 shrink-0 text-sky-300" aria-hidden />
        <span className="text-[13px] font-semibold tabular-nums text-white">{diamondLabel}</span>
      </button>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
