import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import type { AppTab } from "../flow/types";
import { CurrencyBalances } from "./CurrencyBalances";
import { MobileDiamondUtility } from "./MobileDiamondBalance";

const DESKTOP_DESTINATIONS: { id: AppTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "feed", label: "Browse" },
  { id: "bag", label: "Collection" },
  { id: "hub", label: "Rewards" },
  { id: "profile", label: "Profile" },
];

/** Top Navigation — mobile Diamond utility + desktop global header. */
export function TopNav({
  coins,
  diamonds,
  activeTab,
  onTabChange,
  onProfile,
  onOpenStore,
  showBalances = true,
  showMobileDiamond = true,
}: {
  coins: number | null;
  diamonds: number | null;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onProfile: () => void;
  onSettings?: () => void;
  onSearch?: () => void;
  onOpenStore?: () => void;
  showBalances?: boolean;
  /** Immersive / guest flows set false via App shell. */
  showMobileDiamond?: boolean;
}) {
  return (
    <>
      <MobileDiamondUtility
        balance={diamonds}
        onOpenStore={onOpenStore}
        visible={showMobileDiamond && showBalances}
      />

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
                    active
                      ? "text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white/80",
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
            {showBalances ? (
              <CurrencyBalances
                coins={coins}
                diamonds={diamonds}
                onOpenStore={onOpenStore}
              />
            ) : null}
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
