import {
  CalendarDays,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Ticket,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { AppPageShell } from "@/components/AppPageShell";
import { DailyRewardHero } from "@/components/rewards/DailyRewardHero";
import { HubRedeemSection } from "@/components/rewards/HubRedeemSection";
import type { RedeemReward } from "@/services/redeem";

/**
 * Hub — engagement / reward center.
 * Mobile: Claim → Act → Anticipate. Desktop composition preserved via CSS.
 */
export function HubScreen({
  onClaimDaily,
  onOpenStore,
  onDiamondReward,
  onPackReward,
  onOpenPack,
}: {
  onClaimDaily: (diamonds: number) => void;
  onOpenStore?: () => void;
  onDiamondReward: (amount: number) => void;
  onPackReward: (reward: Extract<RedeemReward, { type: "free_pack" }>) => {
    instanceId?: string;
  };
  onOpenPack: (input: {
    packId: string;
    packName: string;
    creator: string;
    instanceId?: string;
  }) => void;
}) {
  const [redeemOpen, setRedeemOpen] = useState(false);

  return (
    <AppPageShell aria-label="Hub" className="hub-page">
      <header className="hub-page-intro">
        <h1 className="hub-page-title">Hub</h1>
        <p className="hub-page-sub">
          Rewards, progress and things worth coming back for.
        </p>
      </header>

      <section className="hub-module hub-module--today" aria-labelledby="hub-today-heading">
        <h2 id="hub-today-heading" className="hub-section-label hub-section-label--today">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Today
        </h2>
        <DailyRewardHero onClaimed={onClaimDaily} />
      </section>

      <section className="hub-module" aria-labelledby="hub-active-heading">
        <h2 id="hub-active-heading" className="hub-section-label hub-section-label--active">
          <Zap className="size-3.5" aria-hidden="true" />
          Active
        </h2>
        <div className="hub-active-grid">
          <button type="button" className="hub-feature-tile" onClick={onOpenStore}>
            <span className="hub-feature-tile-icon is-store" aria-hidden="true">
              <ShoppingBag className="size-5" strokeWidth={1.6} />
            </span>
            <span className="hub-feature-tile-copy">
              <span className="hub-feature-tile-title">Store</span>
              <span className="hub-feature-tile-detail">
                Get Diamonds & packs
              </span>
            </span>
            <ChevronRight className="hub-feature-tile-chevron" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={[
              "hub-feature-tile",
              redeemOpen ? "is-expanded" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setRedeemOpen((open) => !open)}
            aria-expanded={redeemOpen}
            aria-controls="hub-redeem-panel"
          >
            <span className="hub-feature-tile-icon is-redeem" aria-hidden="true">
              <Ticket className="size-5" strokeWidth={1.6} />
            </span>
            <span className="hub-feature-tile-copy">
              <span className="hub-feature-tile-title">Redeem a Code</span>
              <span className="hub-feature-tile-detail">
                Unlock special rewards
              </span>
            </span>
            <ChevronRight className="hub-feature-tile-chevron" aria-hidden="true" />
          </button>

          {redeemOpen ? (
            <div id="hub-redeem-panel" className="hub-redeem-panel">
              <HubRedeemSection
                hideHeading
                onDiamondReward={onDiamondReward}
                onPackReward={onPackReward}
                onOpenPack={onOpenPack}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="hub-module" aria-labelledby="hub-upcoming-heading">
        <div className="hub-section-row">
          <h2 id="hub-upcoming-heading" className="hub-section-label hub-section-label--upcoming">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Upcoming
          </h2>
        </div>
        <div className="hub-upcoming-empty">
          <span className="hub-upcoming-empty-icon" aria-hidden="true">
            <CalendarDays className="size-5" />
          </span>
          <div className="hub-upcoming-empty-copy">
            <p className="hub-upcoming-empty-title">No live events right now.</p>
            <p className="hub-upcoming-empty-sub">Check back tomorrow.</p>
          </div>
          <span className="hub-upcoming-empty-atmosphere" aria-hidden="true" />
        </div>
      </section>
    </AppPageShell>
  );
}
